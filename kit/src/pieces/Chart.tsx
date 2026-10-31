// 图表：条形（谁多谁少、排名怎么变）和曲线（随时间怎么变、最后收敛到哪）。
// 数字是真数据就标出处；数值可以随帧变化（传进来的 values 每帧不同），条会自己重新排序、平滑超车。
import React from 'react';
import {glow, SIZE, useLook} from '../engine/look';
import {clamp, ease, fmt, lerp, mixHex, ramp, rgba, stagger} from '../engine/motion';

export type Bar = {label: string; value: number; color?: string; hi?: boolean; note?: string};

// 横条：标签在左，数值在条的末端跟着长
export const Bars: React.FC<{
  data: Bar[];
  x: number; // 整块的左上角（标签区从这里开始）
  y: number;
  w: number; // 整块宽（含标签区）
  rowH?: number; // 每行高
  labelW?: number; // 标签区宽
  max?: number; // 满格是多少；不传就按当前最大值
  sort?: boolean; // 按数值从大到小排（数值变了会平滑换位置）
  digits?: number;
  unit?: string;
  f: number;
  at?: number;
}> = ({data, x, y, w, rowH = 92, labelW = 260, max, sort = false, digits = 0, unit = '', f, at = 0}) => {
  const L = useLook();
  const top = max ?? Math.max(...data.map((d) => d.value)) * 1.08;
  const span = Math.max(1e-9, top);
  // 软排名：每对之间用平滑的比较，超车是滑过去的，不是跳过去的。
  // 一样多的时候排在前面的那个先占位（±4），两条不会叠在一起
  const eps = span * 0.005;
  const rank = data.map((d, i) =>
    sort ? data.reduce((r, e, j) => (j === i ? r : r + 1 / (1 + Math.exp(-((e.value - d.value) / eps + (j < i ? 4 : -4))))), 0) : i,
  );
  const bw = w - labelW - 160;
  return (
    <div style={{position: 'absolute', left: 0, top: 0}}>
      {data.map((d, i) => {
        const g = stagger(f, i, at, 5, 26, ease.out3);
        const yy = y + rank[i] * rowH;
        const len = Math.max(0, (d.value / span) * bw * g);
        const c = d.color ?? (d.hi ? L.accent : mixHex(L.ink, L.bg, 0.45));
        return (
          <div key={i} style={{position: 'absolute', left: x, top: yy, width: w, height: rowH, opacity: ramp(f, at + i * 5, at + i * 5 + 10)}}>
            <div style={{position: 'absolute', left: 0, width: labelW - 24, top: 0, height: rowH, display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
              fontFamily: L.font.label, fontWeight: 700, fontSize: SIZE.key, color: d.hi ? L.ink : L.dim, whiteSpace: 'nowrap'}}>
              {d.label}
            </div>
            <div style={{position: 'absolute', left: labelW, top: rowH * 0.2, height: rowH * 0.6, width: len, borderRadius: 6,
              background: `linear-gradient(90deg, ${mixHex(c, L.bg, 0.25)}, ${c})`, boxShadow: d.hi && !L.light ? `0 0 26px ${rgba(c, 0.45)}` : undefined}} />
            <div style={{position: 'absolute', left: labelW + len + 18, top: 0, height: rowH, display: 'flex', alignItems: 'center',
              fontFamily: L.font.num, fontWeight: 700, fontSize: SIZE.key, color: d.hi ? L.accent : L.ink, whiteSpace: 'nowrap'}}>
              {fmt(d.value * g, digits)}{unit}
              {d.note ? <span style={{fontFamily: L.font.label, fontSize: SIZE.min, color: L.dim, marginLeft: 14, fontWeight: 500}}>{d.note}</span> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// 竖柱：适合按时间排的少量几根（年份、月份），柱顶写数
export const Columns: React.FC<{
  data: Bar[];
  x: number; // 底边左端
  y: number; // 底边（基线）的高度
  w: number;
  h: number; // 最高那根的高度
  max?: number;
  digits?: number;
  unit?: string;
  f: number;
  at?: number;
  gap?: number; // 柱与柱之间的空隙占比 0–1
}> = ({data, x, y, w, h, max, digits = 0, unit = '', f, at = 0, gap = 0.35}) => {
  const L = useLook();
  const top = max ?? Math.max(...data.map((d) => d.value));
  const cw = w / data.length;
  return (
    <div style={{position: 'absolute', left: 0, top: 0}}>
      <div style={{position: 'absolute', left: x - 20, top: y, width: w + 40, height: 2, background: rgba(L.ink, 0.4)}} />
      {data.map((d, i) => {
        const g = stagger(f, i, at, 4, 28, ease.out3);
        const bh = (d.value / top) * h * g;
        const c = d.color ?? (d.hi ? L.accent : mixHex(L.ink, L.bg, 0.45));
        const cx = x + cw * (i + 0.5);
        return (
          <React.Fragment key={i}>
            <div style={{position: 'absolute', left: cx - (cw * (1 - gap)) / 2, top: y - bh, width: cw * (1 - gap), height: bh, borderRadius: '6px 6px 0 0',
              background: `linear-gradient(180deg, ${c}, ${mixHex(c, L.bg, 0.35)})`, boxShadow: d.hi && !L.light ? `0 0 30px ${rgba(c, 0.4)}` : undefined}} />
            <div style={{position: 'absolute', left: cx, top: y - bh - 58, transform: 'translateX(-50%)', opacity: g, fontFamily: L.font.num, fontWeight: 700,
              fontSize: SIZE.label, color: d.hi ? L.accent : L.ink, whiteSpace: 'nowrap'}}>
              {fmt(d.value * g, digits)}{unit}
            </div>
            <div style={{position: 'absolute', left: cx, top: y + 16, transform: 'translateX(-50%)', fontFamily: L.font.label, fontWeight: 700, fontSize: SIZE.min,
              color: d.hi ? L.ink : L.dim, whiteSpace: 'nowrap', opacity: ramp(f, at, at + 12)}}>
              {d.label}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export type Series = {pts: [number, number][]; color?: string; label?: string; width?: number; area?: boolean; dots?: boolean};

// 好看的刻度：1、2、5 × 10ⁿ
const niceTicks = (a: number, b: number, n = 5) => {
  const raw = (b - a) / n;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((k) => k * p).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let t = Math.ceil(a / step) * step; t <= b + 1e-9; t += step) out.push(+t.toFixed(10));
  return out;
};

// 曲线：reveal 从 0 到 1 时，线从左往右画出来，线头有个发光的点带着当前数值
export const Plot: React.FC<{
  series: Series[];
  x: number; // 坐标区左上角
  y: number;
  w: number;
  h: number;
  xr?: [number, number]; // x 范围；不传按数据
  yr?: [number, number];
  reveal: number; // 0–1
  f: number;
  at?: number;
  xLabel?: (v: number) => string; // 刻度怎么写
  yLabel?: (v: number) => string;
  xTicks?: number[];
  yTicks?: number[];
  refs?: {y: number; label: string}[]; // 水平参考线（理论值、及格线）
  head?: (v: number) => string; // 线头上写什么；不传不写
}> = ({series, x, y, w, h, xr, yr, reveal, f, at = 0, xLabel = (v) => fmt(v), yLabel = (v) => fmt(v), xTicks, yTicks, refs = [], head}) => {
  const L = useLook();
  const all = series.flatMap((s) => s.pts);
  const X0 = xr?.[0] ?? Math.min(...all.map((p) => p[0]));
  const X1 = xr?.[1] ?? Math.max(...all.map((p) => p[0]));
  const Y0 = yr?.[0] ?? Math.min(0, ...all.map((p) => p[1]));
  const Y1 = yr?.[1] ?? Math.max(...all.map((p) => p[1])) * 1.1;
  const sx = (v: number) => x + ((v - X0) / (X1 - X0)) * w;
  const sy = (v: number) => y + h - ((v - Y0) / (Y1 - Y0)) * h;
  const ax = ramp(f, at, at + 20, ease.inOut3);
  const xt = xTicks ?? niceTicks(X0, X1);
  const yt = yTicks ?? niceTicks(Y0, Y1, 4);
  const cut = lerp(X0, X1, clamp(reveal));
  return (
    <div style={{position: 'absolute', left: 0, top: 0}}>
      <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={1} height={1}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={i} id={`plot-area-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={s.color ?? L.accent} stopOpacity={0.32} />
              <stop offset="1" stopColor={s.color ?? L.accent} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        {yt.map((t, i) => (
          <line key={i} x1={x} x2={x + w * ax} y1={sy(t)} y2={sy(t)} stroke={rgba(L.ink, t === 0 ? 0.4 : 0.1)} strokeWidth={t === 0 ? 2 : 1.5} />
        ))}
        <line x1={x} x2={x} y1={y + h} y2={y + h - h * ax} stroke={rgba(L.ink, 0.4)} strokeWidth={2} />
        <line x1={x} x2={x + w * ax} y1={y + h} y2={y + h} stroke={rgba(L.ink, 0.4)} strokeWidth={2} />
        {refs.map((r, i) => (
          <line key={i} x1={x} x2={x + w * ax} y1={sy(r.y)} y2={sy(r.y)} stroke={L.accent2} strokeWidth={2.5} strokeDasharray="10 8" opacity={0.9} />
        ))}
        {series.map((s, i) => {
          const pts = s.pts.filter((p) => p[0] <= cut);
          if (pts.length < 2) return null;
          // 线头精确停在 cut 上
          const nxt = s.pts.find((p) => p[0] > cut);
          const last = pts[pts.length - 1];
          if (nxt) pts.push([cut, lerp(last[1], nxt[1], (cut - last[0]) / (nxt[0] - last[0]))]);
          const d = pts.map((p, k) => `${k ? 'L' : 'M'}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join('');
          const c = s.color ?? L.accent;
          return (
            <g key={i}>
              {s.area ? <path d={`${d}L${sx(pts[pts.length - 1][0])},${sy(Y0)}L${sx(pts[0][0])},${sy(Y0)}Z`} fill={`url(#plot-area-${i})`} /> : null}
              <path d={d} fill="none" stroke={c} strokeWidth={s.width ?? 5} strokeLinejoin="round" strokeLinecap="round" style={{filter: glow(L, rgba(c, 0.55), 10)}} />
              {s.dots ? pts.map((p, k) => <circle key={k} cx={sx(p[0])} cy={sy(p[1])} r={6} fill={c} />) : null}
            </g>
          );
        })}
      </svg>
      {xt.map((t, i) => (
        <div key={i} data-qa="skip" style={{position: 'absolute', left: sx(t), top: y + h + 16, transform: 'translateX(-50%)', fontFamily: L.font.num, fontSize: SIZE.min, color: L.dim, opacity: ax, whiteSpace: 'nowrap'}}>
          {xLabel(t)}
        </div>
      ))}
      {yt.map((t, i) => (
        <div key={i} data-qa="skip" style={{position: 'absolute', left: x - 18, transform: 'translateX(-100%)', top: sy(t) - 20, fontFamily: L.font.num, fontSize: SIZE.min, color: L.dim, opacity: ax, whiteSpace: 'nowrap'}}>
          {yLabel(t)}
        </div>
      ))}
      {refs.map((r, i) => (
        <div key={i} style={{position: 'absolute', left: x + 16, top: sy(r.y) - SIZE.label - 18, fontFamily: L.font.label, fontWeight: 700, fontSize: SIZE.label, color: L.accent2, opacity: ax, whiteSpace: 'nowrap'}}>
          {r.label}
        </div>
      ))}
      {series.map((s, i) => {
        if (reveal <= 0) return null;
        const pts = s.pts;
        const nxt = pts.findIndex((p) => p[0] > cut);
        const k = nxt <= 0 ? pts.length - 1 : nxt;
        const a = pts[Math.max(0, k - 1)];
        const b = pts[k];
        const vy = nxt <= 0 ? b[1] : lerp(a[1], b[1], (cut - a[0]) / Math.max(1e-9, b[0] - a[0]));
        const c = s.color ?? L.accent;
        const hx = sx(Math.min(cut, pts[pts.length - 1][0]));
        const hy = sy(vy);
        return (
          <React.Fragment key={i}>
            <div style={{position: 'absolute', left: hx - 11, top: hy - 11, width: 22, height: 22, borderRadius: '50%', background: '#FFFFFF', boxShadow: `0 0 0 5px ${c}, 0 0 26px 6px ${rgba(c, 0.6)}`}} />
            {head ? (
              <div style={{position: 'absolute', left: hx + 26, top: hy - 64, fontFamily: L.font.num, fontWeight: 700, fontSize: SIZE.key, color: c, whiteSpace: 'nowrap',
                textShadow: L.light ? 'none' : `0 2px 14px ${rgba(L.bg, 0.9)}`}}>
                {head(vy)}
              </div>
            ) : null}
            {s.label && reveal >= 1 ? (
              <div style={{position: 'absolute', left: hx + 26, top: hy - 4, fontFamily: L.font.label, fontWeight: 700, fontSize: SIZE.label, color: c, whiteSpace: 'nowrap'}}>{s.label}</div>
            ) : null}
          </React.Fragment>
        );
      })}
    </div>
  );
};
