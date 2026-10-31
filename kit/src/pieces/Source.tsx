// 出处：一页真的"纸"——期刊论文、书、报告、新闻——滑进画面，关键那句被荧光笔划出来。
// 开头放一个反直觉的结论时，配上它，观众就知道"这不是瞎说的"。
// 只写真实存在、查得到的出处（刊名、年份、机构），内容要和原文一致，不编造。
import React from 'react';
import {useLook} from '../engine/look';
import {ease, hash, ramp, rgba} from '../engine/motion';

const PAPER = '#F6F1E6';
const INK = '#1E1A15';
const GREY = '#6F675B';

const Filler: React.FC<{n: number; seed: number; w: number}> = ({n, seed, w}) => (
  <>
    {Array.from({length: n}, (_, i) => (
      <div key={i} style={{height: 12, borderRadius: 6, margin: '16px 0', background: 'rgba(30,26,21,0.13)', width: i === n - 1 ? w * (0.35 + 0.3 * hash(seed + i)) : w * (0.86 + 0.14 * hash(seed + i))}} />
    ))}
  </>
);

export const Source: React.FC<{
  x: number; // 纸的中心
  y: number;
  w?: number;
  venue: string; // 刊名 / 出版社 / 机构，例如 'Nature'、'中国科学院'
  year?: string;
  title: string; // 论文或文章标题（原文）
  meta?: string; // 第二行小字：机构、卷期
  quote?: string; // 被划出来的那句（可以是原文的中文转述，但意思必须一致）
  f: number;
  at?: number;
  markAt?: number; // 荧光笔从第几帧开始划，默认进场后 24 帧
  tilt?: number; // 纸歪的角度（度）
}> = ({x, y, w = 920, venue, year, title, meta, quote, f, at = 0, markAt, tilt = -2.5}) => {
  const L = useLook();
  const p = ramp(f, at, at + 26, ease.out3);
  if (p <= 0) return null;
  const m = ramp(f, markAt ?? at + 24, (markAt ?? at + 24) + 26, ease.inOut2);
  const settle = ramp(f, at, at + 160, ease.out2);
  const pad = 64;
  const inner = w - pad * 2;
  const isLatin = /^[\x00-\x7F\s]+$/.test(venue);
  return (
    <div
      style={{
        position: 'absolute', left: x, top: y, width: w,
        transform: `translate(-50%, -50%) perspective(1600px) translateY(${(1 - p) * 120}px) rotateX(${(1 - p) * 28}deg) rotate(${tilt * (0.6 + 0.4 * (1 - settle))}deg) scale(${0.98 + 0.03 * settle})`,
        opacity: p,
      }}
    >
      {/* 后面两张纸，看起来是一叠 */}
      {[2, 1].map((k) => (
        <div key={k} style={{position: 'absolute', inset: 0, background: PAPER, filter: `brightness(${1 - k * 0.06})`, transform: `translate(${k * 10}px, ${k * 8}px) rotate(${k * 1.2}deg)`, boxShadow: '0 10px 40px rgba(0,0,0,0.25)'}} />
      ))}
      <div
        style={{
          position: 'relative', padding: `${pad - 8}px ${pad}px ${pad}px`, background: `linear-gradient(170deg, #FBF8F1, ${PAPER} 60%, #EDE6D6)`,
          boxShadow: `0 40px 90px rgba(0,0,0,${L.light ? 0.22 : 0.55}), 0 6px 18px rgba(0,0,0,0.2)`, color: INK,
        }}
      >
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: `2px solid ${INK}`, paddingBottom: 14, marginBottom: 26}}>
          <div style={{fontFamily: isLatin ? L.font.latin : L.font.label, fontSize: 40, fontWeight: 700, letterSpacing: isLatin ? '0.08em' : '0.12em', fontStyle: isLatin ? 'italic' : 'normal'}}>{venue}</div>
          {year ? <div style={{fontFamily: L.font.num, fontSize: 32, color: GREY}}>{year}</div> : null}
        </div>
        <div style={{fontFamily: /^[\x00-\x7F\s]+$/.test(title) ? L.font.latin : L.font.title, fontWeight: 700, fontSize: 46, lineHeight: 1.22}}>{title}</div>
        {meta ? <div style={{fontFamily: L.font.label, fontSize: 30, color: GREY, marginTop: 14}}>{meta}</div> : null}
        <Filler n={3} seed={7} w={inner} />
        {quote ? (
          <div style={{fontFamily: L.font.cap, fontWeight: 700, fontSize: 46, lineHeight: 1.5, margin: '8px 0'}}>
            <span
              style={{
                backgroundImage: `linear-gradient(${rgba(L.accent, L.light ? 0.35 : 0.5)}, ${rgba(L.accent, L.light ? 0.35 : 0.5)})`,
                backgroundRepeat: 'no-repeat', backgroundSize: `${m * 100}% 42%`, backgroundPosition: '0 88%',
                boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone',
              }}
            >
              {quote}
            </span>
          </div>
        ) : null}
        <Filler n={2} seed={19} w={inner} />
      </div>
    </div>
  );
};
