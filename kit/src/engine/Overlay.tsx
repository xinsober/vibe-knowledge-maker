// 常驻版式：左上章节、右上出处、顶部状态条、底部进度、右下署名。
// 它们让片子有"知识感"，也让观众知道自己看到哪了。内容全部来自 film/script.ts，场景里不用管。
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {useLook} from './look';
import {ease, ramp, rgba} from './motion';
import {Timeline} from './timeline';

// 一段文字换内容时：旧的淡出上移，新的淡入
const Swap: React.FC<{items: {key: string; from: number; node: React.ReactNode}[]; f: number}> = ({items, f}) => (
  <>
    {items.map((it, i) => {
      const next = items[i + 1];
      const a = ramp(f, it.from, it.from + 14);
      const b = next ? ramp(f, next.from - 4, next.from + 8, ease.in2) : 0;
      const o = Math.min(a, 1 - b);
      if (o <= 0.001) return null;
      return (
        <div key={it.key + i} style={{position: 'absolute', inset: 0, opacity: o, transform: `translateY(${(1 - a) * 10 - b * 10}px)`}}>
          {it.node}
        </div>
      );
    })}
  </>
);

export const Overlay: React.FC<{tl: Timeline; credit?: string; hideAfter?: number}> = ({tl, credit, hideAfter}) => {
  const L = useLook();
  const f = useCurrentFrame();
  const label: React.CSSProperties = {fontFamily: L.font.label, color: L.dim, fontSize: 30, fontWeight: 500, letterSpacing: '0.04em'};
  const hide = hideAfter ? ramp(f, hideAfter, hideAfter + 20) : 0;

  // 章节：同名的连续场景算一章
  const chapters: {name: string; from: number; to: number}[] = [];
  tl.scenes.forEach((s) => {
    if (!s.chapterNow) return;
    const last = chapters[chapters.length - 1];
    if (last && last.name === s.chapterNow) last.to = s.from + s.dur;
    else chapters.push({name: s.chapterNow, from: s.from + (s.index === 0 ? 0 : 10), to: s.from + s.dur});
  });

  // 出处：句子上的 src 优先，否则用场景的 src
  const srcs: {key: string; from: number; node: React.ReactNode}[] = [];
  const pushSrc = (text: string | undefined, from: number) => {
    const last = srcs[srcs.length - 1];
    if ((last?.key ?? '') === (text ?? '')) return;
    srcs.push({
      key: text ?? '',
      from,
      node: text ? (
        <div style={{position: 'absolute', right: 0, top: 0, textAlign: 'right'}}>
          <div style={{...label, fontSize: 28, color: L.dim}}>{text}</div>
          <div style={{marginLeft: 'auto', marginTop: 10, width: 64, height: 2, background: L.accent, opacity: 0.8}} />
        </div>
      ) : null,
    });
  };
  tl.scenes.forEach((s) => {
    const ls = tl.lines.filter((l) => l.scene === s.index);
    pushSrc(s.src, s.from + 10);
    ls.forEach((l) => l.src && pushSrc(l.src, l.from));
    if (ls.some((l) => l.src)) pushSrc(s.src, s.from + s.dur);
  });

  const badges = tl.scenes.map((s) => ({
    key: s.badge ?? '',
    from: s.from + 10,
    node: s.badge ? (
      <div style={{position: 'absolute', left: '50%', top: 0, transform: 'translateX(-50%)'}}>
        <div
          style={{
            ...label,
            color: L.ink,
            fontSize: 30,
            padding: '8px 26px',
            borderRadius: 40,
            border: `1.5px solid ${rgba(L.ink, 0.25)}`,
            background: rgba(L.panel, 0.55),
            whiteSpace: 'nowrap',
          }}
        >
          {s.badge}
        </div>
      </div>
    ) : null,
  }));

  return (
    <AbsoluteFill style={{pointerEvents: 'none', opacity: 1 - hide}}>
      {/* 左上：章节号 + 章节名 */}
      <div style={{position: 'absolute', left: 64, top: 50, width: 700, height: 60}}>
        <Swap
          f={f}
          items={chapters.map((c, i) => ({
            key: c.name,
            from: c.from,
            node: (
              <div style={{display: 'flex', alignItems: 'baseline', gap: 16}}>
                <span style={{fontFamily: L.font.num, fontSize: 34, color: L.accent, fontWeight: 700}}>{String(i + 1).padStart(2, '0')}</span>
                <span style={{...label, fontSize: 32, color: L.ink, fontWeight: 700}}>{c.name}</span>
              </div>
            ),
          }))}
        />
      </div>
      {/* 右上：出处 */}
      <div style={{position: 'absolute', right: 64, top: 54, width: 900, height: 80}}>
        <Swap f={f} items={srcs} />
      </div>
      {/* 顶部居中：状态条 */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 46, height: 60}}>
        <Swap f={f} items={badges.filter((b, i) => i === 0 || b.key !== badges[i - 1].key)} />
      </div>
      {/* 底部：按章节分段的进度条 */}
      {chapters.length > 1 && (
        <div style={{position: 'absolute', left: 64, right: 64, bottom: 22, height: 4, display: 'flex', gap: 6}}>
          {chapters.map((c, i) => {
            const p = Math.max(0, Math.min(1, (f - c.from) / Math.max(1, c.to - c.from)));
            return (
              <div key={i} style={{flex: c.to - c.from, background: rgba(L.ink, 0.14), borderRadius: 2, overflow: 'hidden'}}>
                <div style={{width: `${p * 100}%`, height: '100%', background: L.accent, opacity: 0.85}} />
              </div>
            );
          })}
        </div>
      )}
      {/* 右下：署名（可选） */}
      {credit ? (
        <div style={{position: 'absolute', right: 64, bottom: 40, ...label, fontSize: 28, color: L.dim, opacity: 0.9}}>{credit}</div>
      ) : null}
    </AbsoluteFill>
  );
};
