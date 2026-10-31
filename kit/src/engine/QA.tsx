// 自动质检：只在 inputProps.qa = true 时挂上（scripts/qa.mjs 会这样渲）。
// 每一帧量一遍屏上所有的字，把问题打到浏览器日志里，脚本收集后汇总：
//   small    字太小（按实际缩放后的字号算，低于 SIZE.min）
//   edge     字出了画面或贴边（离边不到 24px）
//   caption  别的字压在字幕上
//   overlap  两段字叠在一起
// 只出现在一个采样帧里的（东西正好飞过去、叠化中途）由 scripts/qa.mjs 过滤掉。
// 故意的装饰性小字（比如刻度上密密的数字）加 data-qa="skip"。字幕自己带 data-qa="caption"。
// 一组字本来就是一个整体（里程表的一列列数字）加 data-qa="one"，组内不查互相叠住。
import React, {useEffect} from 'react';
import {continueRender, delayRender, useCurrentFrame, useVideoConfig} from 'remotion';
import {SIZE} from './look';

type Box = {x: number; y: number; w: number; h: number; text: string; el: Element; cap: boolean; o: number};

const visibleOpacity = (el: Element | null) => {
  let o = 1;
  while (el && el instanceof Element) {
    const cs = getComputedStyle(el);
    o *= Number(cs.opacity);
    if (cs.visibility === 'hidden' || cs.display === 'none') return 0;
    el = el.parentElement;
  }
  return o;
};

const skipped = (el: Element | null) => !!el?.closest('[data-qa="skip"]');

// 被 overflow:hidden 的祖先裁掉的部分不算（比如里程表滚动列里藏着的数字）
const clipRect = (el: Element, r: DOMRect) => {
  let x0 = r.left;
  let y0 = r.top;
  let x1 = r.right;
  let y1 = r.bottom;
  for (let a = el.parentElement; a && a.id !== 'kf-root'; a = a.parentElement) {
    if (getComputedStyle(a).overflow === 'visible') continue;
    const c = a.getBoundingClientRect();
    x0 = Math.max(x0, c.left);
    y0 = Math.max(y0, c.top);
    x1 = Math.min(x1, c.right);
    y1 = Math.min(y1, c.bottom);
  }
  return x1 - x0 > 1 && y1 - y0 > 1 ? {left: x0, top: y0, width: x1 - x0, height: y1 - y0} : null;
};

const effectiveSize = (el: Element) => {
  const fs = parseFloat(getComputedStyle(el).fontSize) || 0;
  const r = el.getBoundingClientRect();
  if (el instanceof HTMLElement && el.offsetHeight > 0) return fs * (r.height / el.offsetHeight);
  if (el instanceof SVGGraphicsElement) {
    const bb = el.getBBox();
    if (bb.height > 0) return fs * (r.height / bb.height);
  }
  return fs;
};

const inter = (a: Box, b: Box) => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};

export const QA: React.FC = () => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  useEffect(() => {
    const handle = delayRender('qa');
    requestAnimationFrame(() => {
      const issues: string[] = [];
      const boxes: Box[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const seen = new Set<Element>();
      // 合成画面在页面里的位置和缩放（studio 里会缩放预览）
      const root = document.getElementById('kf-root');
      const rr = root?.getBoundingClientRect();
      const k = rr ? rr.width / width : 1;
      const ox = rr?.left ?? 0;
      const oy = rr?.top ?? 0;
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const text = (node.textContent ?? '').trim();
        const el = node.parentElement;
        if (!text || !el || skipped(el)) continue;
        const o = visibleOpacity(el);
        if (o < 0.35) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const cap = !!el.closest('[data-qa="caption"]');
        for (const raw of Array.from(range.getClientRects())) {
          const r = clipRect(el, raw);
          if (!r || r.width < 2 || r.height < 2) continue;
          boxes.push({x: (r.left - ox) / k, y: (r.top - oy) / k, w: r.width / k, h: r.height / k, text, el, cap, o});
        }
        if (!seen.has(el) && !cap) {
          seen.add(el);
          const s = effectiveSize(el) / k;
          if (s > 0 && s < SIZE.min) issues.push(`small ${Math.round(s)}px「${text.slice(0, 12)}」`);
        }
      }
      for (const b of boxes) {
        const m = 24;
        if (b.x < m || b.y < m || b.x + b.w > width - m || b.y + b.h > height - m) {
          // 完全在画外的不算（镜头外的东西）
          const out = b.x + b.w < 0 || b.y + b.h < 0 || b.x > width || b.y > height;
          if (!out) issues.push(`edge「${b.text.slice(0, 12)}」@${Math.round(b.x)},${Math.round(b.y)}`);
        }
      }
      // 叠化中途两边都是半透明，不算压字；两边都清楚可见（≥0.55）才算
      const caps = boxes.filter((b) => b.cap && b.o >= 0.55);
      const rest = boxes.filter((b) => !b.cap && b.o >= 0.55);
      for (const c of caps) for (const b of rest) if (inter(c, b) > 0.15 * Math.min(c.w * c.h, b.w * b.h)) issues.push(`caption 压字「${b.text.slice(0, 12)}」`);
      for (let i = 0; i < rest.length; i++)
        for (let j = i + 1; j < rest.length; j++) {
          const a = rest[i];
          const b = rest[j];
          if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue;
          const ua = a.el.closest('[data-qa="one"]');
          if (ua && ua === b.el.closest('[data-qa="one"]')) continue;
          if (inter(a, b) > 0.2 * Math.min(a.w * a.h, b.w * b.h)) issues.push(`overlap「${a.text.slice(0, 8)}」×「${b.text.slice(0, 8)}」`);
        }
      const uniq = Array.from(new Set(issues));
      console.log('KFQA ' + JSON.stringify({frame, issues: uniq}));
      continueRender(handle);
    });
  }, [frame, width, height]);
  return null;
};
