// 时间：像里程表一样滚动的数字（年份、人数、钱），和一条会走的时间轴。
// "年份一路往前推"的讲法就靠这两样：左上角年份滚动，画面跟着时代换。
import React from 'react';
import {glow, SIZE, useLook} from '../engine/look';
import {clamp, ease, ramp, rgba} from '../engine/motion';

// 里程表数字：value 可以是小数（滚动中），整数位一位位翻上去
export const Odometer: React.FC<{
  value: number;
  x: number;
  y: number;
  size?: number;
  digits?: number; // 至少显示几位
  prefix?: string; // 例如 '公元前 '、'¥'
  suffix?: string; // 例如 ' 年'、' 万'
  color?: string;
  comma?: boolean; // 千分位逗号
  decimals?: number; // 小数位，例如 82.3 写 1
  align?: 'left' | 'center' | 'right';
}> = ({value, x, y, size = 96, digits = 1, prefix = '', suffix = '', color, comma = false, decimals = 0, align = 'left'}) => {
  const L = useLook();
  const v = Math.max(0, value) * 10 ** decimals;
  const n = Math.max(digits + decimals, Math.floor(v).toString().length);
  const cols = [];
  // 每一位只在下一位走完 9→0 的最后那一下才翻过去，停着的时候数字是端正的
  const lastStep = ease.inOut2(clamp((v - Math.floor(v) - 0.7) / 0.3));
  for (let k = n - 1; k >= 0; k--) {
    const p = 10 ** k;
    const base = Math.floor(v / p) % 10;
    const low = Math.floor(v) % p;
    const carry = k === 0 ? lastStep : low === p - 1 ? lastStep : 0;
    cols.push({k, pos: base + carry});
    if (decimals && k === decimals) cols.push({k: -2, pos: 0});
    if (comma && (k - decimals) % 3 === 0 && k > decimals) cols.push({k: -1, pos: 0});
  }
  const c = color ?? L.ink;
  const tx = align === 'center' ? '-50%' : align === 'right' ? '-100%' : '0';
  const font: React.CSSProperties = {fontFamily: L.font.num, fontWeight: 700, fontSize: size, color: c, lineHeight: 1};
  return (
    <div data-qa="one" style={{position: 'absolute', left: x, top: y, transform: `translate(${tx}, -50%)`, display: 'flex', alignItems: 'baseline', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums'}}>
      {prefix && <span style={{...font, fontSize: size * 0.42, marginRight: size * 0.12, color: L.dim, fontFamily: L.font.label}}>{prefix}</span>}
      {cols.map((col, i) =>
        col.k < 0 ? (
          <span key={i} style={font}>{col.k === -2 ? '.' : ','}</span>
        ) : (
          <span key={i} style={{display: 'inline-block', height: size, overflow: 'hidden', position: 'relative', width: size * 0.62}}>
            <span style={{position: 'absolute', left: 0, top: -col.pos * size, display: 'flex', flexDirection: 'column'}}>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d, j) => (
                <span key={j} style={{...font, height: size, display: 'block', textAlign: 'center', width: size * 0.62}}>{d}</span>
              ))}
            </span>
          </span>
        ),
      )}
      {suffix && <span style={{...font, fontSize: size * 0.42, marginLeft: size * 0.1, color: L.dim, fontFamily: L.font.label}}>{suffix}</span>}
    </div>
  );
};

// 年份显示：负数写成"公元前"
export const Year: React.FC<{year: number; x: number; y: number; size?: number; color?: string}> = ({year, x, y, size = 80, color}) => (
  <Odometer value={Math.abs(year)} x={x} y={y} size={size} color={color} prefix={year < 0 ? '公元前' : ''} suffix="年" />
);

// 时间轴：from 到 to 年，游标停在 now；eras 是一段段时代，events 是点
export const TimeRibbon: React.FC<{
  x: number;
  y: number;
  w: number;
  from: number;
  to: number;
  now: number;
  f: number;
  at?: number;
  step?: number; // 刻度间隔（年）
  eras?: {from: number; to: number; label: string}[];
  events?: {year: number; label: string; up?: boolean}[];
  fmt?: (y: number) => string;
}> = ({x, y, w, from, to, now, f, at = 0, step, eras = [], events = [], fmt}) => {
  const L = useLook();
  const grow = ramp(f, at, at + 30, ease.inOut3);
  const X = (yr: number) => x + ((yr - from) / (to - from)) * w;
  const st = step ?? Math.pow(10, Math.floor(Math.log10((to - from) / 4)));
  const ticks: number[] = [];
  for (let t = Math.ceil(from / st) * st; t <= to; t += st) ticks.push(t);
  const label = fmt ?? ((yr: number) => (yr < 0 ? `前${-yr}` : `${yr}`));
  const cx = X(clamp(now, from, to));
  return (
    <div style={{position: 'absolute', left: 0, top: 0}}>
      <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={1} height={1}>
        <line x1={x} x2={x + w * grow} y1={y} y2={y} stroke={rgba(L.ink, 0.35)} strokeWidth={3} />
        <line x1={x} x2={Math.min(cx, x + w * grow)} y1={y} y2={y} stroke={L.accent} strokeWidth={4} style={{filter: glow(L, rgba(L.accent, 0.6), 8)}} />
        {eras.map((e, i) => (
          <rect key={i} x={X(e.from)} y={y - 14} width={Math.max(2, X(e.to) - X(e.from) - 3)} height={28} rx={4}
            fill={rgba(i % 2 ? L.ink : L.accent, now >= e.from && now < e.to ? 0.32 : 0.1)} opacity={grow} />
        ))}
        {ticks.map((t, i) => (
          <line key={i} x1={X(t)} x2={X(t)} y1={y + 18} y2={y + 30} stroke={rgba(L.ink, 0.5)} strokeWidth={2} opacity={grow} />
        ))}
        {events.map((e, i) => {
          const p = ramp(now, e.year - (to - from) * 0.01, e.year + (to - from) * 0.01);
          return <circle key={i} cx={X(e.year)} cy={y} r={7 + 5 * p} fill={p > 0.5 ? L.accent : L.ink} opacity={0.4 + 0.6 * p} />;
        })}
        <circle cx={cx} cy={y} r={11} fill={L.accent} opacity={grow} style={{filter: glow(L, rgba(L.accent, 0.8), 14)}} />
      </svg>
      {ticks.map((t, i) => (
        <div key={i} data-qa="skip" style={{position: 'absolute', left: X(t), top: y + 36, transform: 'translateX(-50%)', fontFamily: L.font.num, fontSize: SIZE.min, color: L.dim, opacity: grow, whiteSpace: 'nowrap'}}>
          {label(t)}
        </div>
      ))}
      {eras.map((e, i) => (
        <div key={i} style={{position: 'absolute', left: (X(e.from) + X(e.to)) / 2, top: y - 64, transform: 'translateX(-50%)', fontFamily: L.font.label, fontSize: SIZE.label, fontWeight: 700,
          color: now >= e.from && now < e.to ? L.ink : L.dim, opacity: grow * (now >= e.from && now < e.to ? 1 : 0.6), whiteSpace: 'nowrap'}}>
          {e.label}
        </div>
      ))}
      {events.map((e, i) => {
        const p = ramp(now, e.year, e.year + (to - from) * 0.02);
        if (p <= 0) return null;
        return (
          <div key={i} style={{position: 'absolute', left: X(e.year), top: e.up === false ? y + 80 : y - 120, transform: `translate(-50%, ${(1 - p) * 10}px)`, opacity: p,
            fontFamily: L.font.label, fontWeight: 700, fontSize: SIZE.label, color: L.ink, whiteSpace: 'nowrap'}}>
            {e.label}
          </div>
        );
      })}
    </div>
  );
};
