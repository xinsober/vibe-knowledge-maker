// 字幕：一屏一句，逐字浮现，【】里的字用强调色。
// 默认放在底部居中；一句话在讲画面上某个东西时，可以用 pos 把它放到那个东西旁边。
import React from 'react';
import {useLook, glow} from './look';
import {CapPos} from './timeline';
import {ease, ramp, rgba} from './motion';

type Tok = {ch: string; hi: boolean};

const PUNCT = '，、：；。！？';

// 拆成字符，记下哪些在【】里
const tokenize = (s: string): Tok[] => {
  const out: Tok[] = [];
  let hi = false;
  for (const ch of s) {
    if (ch === '【') hi = true;
    else if (ch === '】') hi = false;
    else out.push({ch, hi});
  }
  return out;
};

// 超过 maxChars 就在靠近中间的标点处断行；也可以自己写 \n
export const wrap = (s: string, maxChars = 15): Tok[][] => {
  const rows: Tok[][] = [];
  for (const seg of s.split('\n')) {
    const toks = tokenize(seg);
    if (toks.length <= maxChars) {
      rows.push(toks);
      continue;
    }
    // 在标点处断：逗号句号优先，顿号次之，都没有就从中间断
    const mid = toks.length / 2;
    let best = Math.round(mid);
    let bestD = 99;
    toks.forEach((t, i) => {
      if (!PUNCT.includes(t.ch) || i < 3 || i > toks.length - 4) return;
      const d = Math.abs(i + 1 - mid) + (t.ch === '、' ? 4 : 0);
      if (d < bestD) {
        best = i + 1;
        bestD = d;
      }
    });
    rows.push(toks.slice(0, best), toks.slice(best));
  }
  // 行尾的逗号句号去掉，屏幕字幕不需要
  return rows.map((r) => (r.length && '，。、'.includes(r[r.length - 1].ch) ? r.slice(0, -1) : r));
};

export const Caption: React.FC<{text: string; f: number; dur: number; pos?: CapPos; size?: number}> = ({
  text,
  f,
  dur,
  pos = 'bottom',
  size,
}) => {
  const L = useLook();
  const hero = pos === 'center';
  const fs = size ?? (hero ? 88 : 64);
  const rows = wrap(text, hero ? 12 : 18);
  const out = ramp(f, dur - 8, dur, ease.in2);
  let k = 0;
  const box: React.CSSProperties =
    typeof pos === 'object'
      ? {left: pos.x, top: pos.y, width: pos.w ?? 900, textAlign: pos.align ?? 'left'}
      : pos === 'top'
        ? {left: 160, right: 160, top: 120, textAlign: 'center'}
        : pos === 'center'
          ? {left: 160, right: 160, top: 540, transform: 'translateY(-50%)', textAlign: 'center'}
          : {left: 140, right: 140, bottom: rows.length > 1 ? 70 : 92, textAlign: 'center'};
  return (
    <div
      data-qa="caption"
      style={{
        position: 'absolute',
        ...box,
        fontFamily: L.font.cap,
        fontWeight: hero ? L.titleWeight : L.capWeight,
        fontSize: fs,
        lineHeight: 1.3,
        letterSpacing: '0.04em',
        color: L.ink,
        opacity: 1 - out,
        filter: out > 0 ? `blur(${out * 8}px)` : undefined,
        textShadow: L.light ? 'none' : `0 2px 18px ${rgba(L.bg, 0.9)}`,
      }}
    >
      {rows.map((r, ri) => (
        <div key={ri} style={{whiteSpace: 'nowrap'}}>
          {r.map((t) => {
            const i = k++;
            const p = ramp(f, i * 0.9, i * 0.9 + 10, ease.out3);
            return (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  opacity: p,
                  transform: `translateY(${(1 - p) * 14}px)`,
                  filter:
                    [p < 1 ? `blur(${(1 - p) * 6}px)` : '', t.hi && !L.light ? glow(L, rgba(L.accent, 0.45), 14) : '']
                      .join(' ')
                      .trim() || undefined,
                  color: t.hi ? L.accent : undefined,
                }}
              >
                {t.ch === ' ' ? ' ' : t.ch}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

// 底部字幕后面的暗带，保证字幕在任何画面上都读得清
export const CaptionBand: React.FC<{opacity: number}> = ({opacity}) => {
  const L = useLook();
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 300,
        opacity,
        background: `linear-gradient(to top, ${rgba(L.bg, L.light ? 0.85 : 0.82)} 0%, ${rgba(L.bg, L.light ? 0.5 : 0.45)} 55%, ${rgba(L.bg, 0)} 100%)`,
      }}
    />
  );
};
