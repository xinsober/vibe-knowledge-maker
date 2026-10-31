// 剖面块：把一块东西切开，看见里面一层一层。皮肤、土壤、河床、墙、电池、地壳都能用。
// 斜 45° 看过去的一块"蛋糕"：顶面、正面（剖面，画出各层和纹理）、侧面。
// 东西可以放在顶面上（top），也可以放进某一层里（inside）。
import React from 'react';
import {glow, useLook} from '../engine/look';
import {clamp, ease, hash, mixHex, ramp, rgba} from '../engine/motion';

export type Layer = {
  h: number; // 厚度（像素）
  color: string;
  label?: string;
  texture?: 'none' | 'dots' | 'grain' | 'cells' | 'fibers' | 'stones' | 'waves';
};

type Props = {
  x: number; // 正面左上角
  y: number;
  w: number; // 正面宽
  d?: number; // 纵深（向右上方斜出去的长度）
  layers: Layer[];
  f: number;
  at?: number; // 从第几帧开始一层层长出来
  labels?: boolean; // 在右边标出每层的名字
  labelAt?: number;
  open?: number; // 0–1：把顶面以上的东西"掀开"（顶面抬起、变透明），看里面
  surface?: string; // 顶面颜色，默认用第一层的颜色提亮
  top?: React.ReactNode; // 画在顶面上的东西（坐标原点是顶面左前角）
  inside?: React.ReactNode; // 画在剖面里的东西（坐标原点是正面左上角）
};

const Texture: React.FC<{kind: Layer['texture']; w: number; h: number; c: string; seed: number}> = ({kind, w, h, c, seed}) => {
  const n = Math.round((w * h) / 900);
  const items: React.ReactNode[] = [];
  if (kind === 'dots' || kind === 'grain')
    for (let i = 0; i < n * (kind === 'grain' ? 2 : 0.6); i++) {
      const r = kind === 'grain' ? 1.2 + hash(seed + i * 3) * 1.6 : 2 + hash(seed + i * 3) * 4;
      items.push(<circle key={i} cx={hash(seed + i) * w} cy={hash(seed + i * 7 + 1) * h} r={r} fill={c} opacity={0.35 + hash(seed + i * 5) * 0.4} />);
    }
  if (kind === 'stones')
    for (let i = 0; i < n * 0.25; i++) {
      const r = 6 + hash(seed + i * 3) * 16;
      items.push(
        <ellipse key={i} cx={hash(seed + i) * w} cy={hash(seed + i * 7 + 1) * h} rx={r} ry={r * (0.55 + hash(i) * 0.3)} fill={c} opacity={0.5}
          transform={`rotate(${hash(seed + i * 11) * 180} ${hash(seed + i) * w} ${hash(seed + i * 7 + 1) * h})`} />,
      );
    }
  if (kind === 'cells') {
    const s = 34;
    for (let yy = 0; yy < h + s; yy += s * 0.86)
      for (let xx = 0; xx < w + s; xx += s) {
        const ox = (Math.round(yy / (s * 0.86)) % 2) * s * 0.5;
        items.push(<ellipse key={`${xx},${yy}`} cx={xx + ox} cy={yy} rx={s * 0.44} ry={s * 0.36} fill="none" stroke={c} strokeWidth={1.6} opacity={0.5} />);
        items.push(<circle key={`n${xx},${yy}`} cx={xx + ox + 3} cy={yy} r={4} fill={c} opacity={0.45} />);
      }
  }
  if (kind === 'fibers')
    for (let i = 0; i < n * 0.35; i++) {
      const yy = hash(seed + i) * h;
      const xx = hash(seed + i * 9) * w;
      items.push(<path key={i} d={`M${xx},${yy} q${30},${-8} ${60},0 t60,0`} stroke={c} strokeWidth={1.8} fill="none" opacity={0.45} />);
    }
  if (kind === 'waves')
    for (let yy = 8; yy < h; yy += 14)
      items.push(<path key={yy} d={`M0,${yy} ${Array.from({length: Math.ceil(w / 40)}, (_, i) => `q10,-5 20,0 t20,0`).join(' ')}`} stroke={c} strokeWidth={1.5} fill="none" opacity={0.35} />);
  return <>{items}</>;
};

export const Cutaway: React.FC<Props> = ({x, y, w, d = 260, layers, f, at = 0, labels = true, labelAt, open = 0, surface, top, inside}) => {
  const L = useLook();
  const dx = d * 0.82;
  const dy = -d * 0.5;
  const H = layers.reduce((s, l) => s + l.h, 0);
  const grow = ramp(f, at, at + 26 + layers.length * 6, ease.out3);
  const id = `cut-${Math.round(x)}-${Math.round(y)}`;
  let acc = 0;
  const top0 = surface ?? mixHex(layers[0].color, '#FFFFFF', 0.12);
  const lift = ease.inOut3(clamp(open)) * 140;
  return (
    <div style={{position: 'absolute', left: 0, top: 0}}>
      <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={1} height={1}>
        <defs>
          <clipPath id={id}>
            <rect x={x} y={y} width={w} height={H * grow} />
          </clipPath>
          <linearGradient id={id + 's'} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#000000" stopOpacity={0.38} />
            <stop offset="1" stopColor="#000000" stopOpacity={0.55} />
          </linearGradient>
          <linearGradient id={id + 'f'} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity={0.1} />
            <stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0} />
            <stop offset="1" stopColor="#000000" stopOpacity={0.22} />
          </linearGradient>
        </defs>
        {/* 投影 */}
        <ellipse cx={x + w / 2 + dx / 2} cy={y + H + 30} rx={w * 0.62} ry={40} fill="#000000" opacity={(L.light ? 0.12 : 0.4) * grow} />
        {/* 侧面：每层的侧边 */}
        {layers.map((l, i) => {
          const y0 = y + layers.slice(0, i).reduce((s, q) => s + q.h, 0) * grow;
          const h = l.h * grow;
          return (
            <path key={i} d={`M${x + w},${y0} l${dx},${dy} l0,${h} l${-dx},${-dy} Z`} fill={mixHex(l.color, '#000000', 0.32)} />
          );
        })}
        <path d={`M${x + w},${y} l${dx},${dy} l0,${H * grow} l${-dx},${-dy} Z`} fill={`url(#${id}s)`} opacity={0.3} />
        {/* 正面：剖面 */}
        <g clipPath={`url(#${id})`}>
          {layers.map((l, i) => {
            const y0 = y + acc;
            acc += l.h;
            return (
              <g key={i}>
                <rect x={x} y={y0} width={w} height={l.h + 1} fill={l.color} />
                <g transform={`translate(${x},${y0})`}>
                  <Texture kind={l.texture ?? 'none'} w={w} h={l.h} c={mixHex(l.color, L.light ? '#000000' : '#FFFFFF', 0.35)} seed={i * 97 + 3} />
                </g>
                {i > 0 && <line x1={x} x2={x + w} y1={y0} y2={y0} stroke={mixHex(l.color, '#000000', 0.25)} strokeWidth={2} />}
              </g>
            );
          })}
          <rect x={x} y={y} width={w} height={H} fill={`url(#${id}f)`} />
          {inside ? <g transform={`translate(${x},${y})`}>{inside}</g> : null}
        </g>
        {/* 顶面（掀开时往上抬、变淡） */}
        <g transform={`translate(0,${-lift})`} opacity={1 - open * 0.75}>
          <path d={`M${x},${y} l${dx},${dy} l${w},0 l${-dx},${-dy} Z`} fill={top0} opacity={grow} />
          <path d={`M${x},${y} l${w},0`} stroke={rgba('#FFFFFF', 0.35)} strokeWidth={2} opacity={grow} />
        </g>
        {top ? <g transform={`translate(${x},${y - lift})`} opacity={grow}>{top}</g> : null}
      </svg>
      {labels &&
        layers.map((l, i) => {
          if (!l.label) return null;
          const yc = y + layers.slice(0, i).reduce((s, q) => s + q.h, 0) + l.h / 2;
          const p = ramp(f, (labelAt ?? at + 30) + i * 8, (labelAt ?? at + 30) + i * 8 + 16);
          if (p <= 0) return null;
          const lx = x + w + dx + 40;
          return (
            <div key={i} style={{position: 'absolute', left: 0, top: 0, opacity: p}}>
              <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={1} height={1}>
                <line x1={x + w - 30} y1={yc} x2={lx - 10} y2={yc} stroke={rgba(L.ink, 0.55)} strokeWidth={1.5} strokeDasharray="4 5" />
                <circle cx={x + w - 30} cy={yc} r={5} fill={L.ink} style={{filter: glow(L, rgba(L.ink, 0.5), 6)}} />
              </svg>
              <div style={{position: 'absolute', left: lx, top: yc - 22, fontFamily: L.font.label, fontSize: 36, fontWeight: 700, color: L.ink, whiteSpace: 'nowrap', transform: `translateX(${(1 - p) * -12}px)`}}>
                {l.label}
              </div>
            </div>
          );
        })}
    </div>
  );
};
