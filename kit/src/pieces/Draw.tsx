// 画面里最常用的几样小东西：标注、箭头、圈重点、大字。镜头库里的组件都用它们。
// 坐标都是画面像素（或者所在 World 的世界坐标）。
import React from 'react';
import {glow, SIZE, useLook} from '../engine/look';
import {ease, ramp, rgba} from '../engine/motion';

// 标注：一个点 + 一根引线 + 一段字。先出点，再拉线，最后出字
export const Tag: React.FC<{
  x: number; // 被标的那个点
  y: number;
  dx?: number; // 字相对点的位置
  dy?: number;
  text: string;
  sub?: string; // 第二行小字
  f: number;
  at?: number; // 从第几帧开始出现
  color?: string;
  size?: number;
  align?: 'left' | 'right';
  out?: number; // 从第几帧开始消失
}> = ({x, y, dx = 120, dy = -70, text, sub, f, at = 0, color, size = SIZE.key, align, out}) => {
  const L = useLook();
  const c = color ?? L.ink;
  const p1 = ramp(f, at, at + 8);
  const p2 = ramp(f, at + 4, at + 18, ease.inOut2);
  const p3 = ramp(f, at + 12, at + 26);
  const o = out !== undefined ? 1 - ramp(f, out, out + 12, ease.in2) : 1;
  if (p1 <= 0 || o <= 0) return null;
  const al = align ?? (dx >= 0 ? 'left' : 'right');
  const ex = x + dx * p2;
  const ey = y + dy * p2;
  const hx = al === 'left' ? 46 : -46;
  return (
    <div style={{position: 'absolute', left: 0, top: 0, opacity: o}}>
      <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={1} height={1}>
        <circle cx={x} cy={y} r={7 * p1} fill={c} style={{filter: glow(L, rgba(c, 0.6), 8)}} />
        <circle cx={x} cy={y} r={14 + 10 * p1} fill="none" stroke={rgba(c, 0.35 * (1 - p2 * 0.6))} strokeWidth={2} />
        <polyline
          points={`${x},${y} ${ex},${ey} ${ex + hx * p3},${ey}`}
          fill="none"
          stroke={rgba(c, 0.8)}
          strokeWidth={2}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: al === 'left' ? ex + hx + 12 : undefined,
          right: al === 'right' ? -(ex + hx - 12) : undefined,
          top: ey - size * 0.72,
          opacity: p3,
          transform: `translateX(${(1 - p3) * (al === 'left' ? -10 : 10)}px)`,
          textAlign: al,
          whiteSpace: 'nowrap',
          fontFamily: L.font.label,
          fontWeight: 700,
          fontSize: size,
          color: c,
          lineHeight: 1.25,
          textShadow: L.light ? 'none' : `0 2px 12px ${rgba(L.bg, 0.95)}, 0 0 4px ${rgba(L.bg, 0.8)}`,
        }}
      >
        {text}
        {sub ? <div style={{fontSize: Math.max(SIZE.min, size * 0.72), fontWeight: 500, color: L.dim}}>{sub}</div> : null}
      </div>
    </div>
  );
};

// 箭头：从 a 画到 b，可以带弧度（bend 是弧顶偏离直线的像素）
export const Arrow: React.FC<{
  from: [number, number];
  to: [number, number];
  f: number;
  at?: number;
  dur?: number;
  bend?: number;
  color?: string;
  width?: number;
  dashed?: boolean;
}> = ({from, to, f, at = 0, dur = 20, bend = 0, color, width = 4, dashed}) => {
  const L = useLook();
  const c = color ?? L.accent;
  const p = ramp(f, at, at + dur, ease.inOut2);
  if (p <= 0) return null;
  const [x1, y1] = from;
  const [x2, y2] = to;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = -(y2 - y1) / len;
  const ny = (x2 - x1) / len;
  const cx = mx + nx * bend;
  const cy = my + ny * bend;
  // 二次贝塞尔上 t 处的点和切线
  const at2 = (t: number) => [
    (1 - t) ** 2 * x1 + 2 * (1 - t) * t * cx + t * t * x2,
    (1 - t) ** 2 * y1 + 2 * (1 - t) * t * cy + t * t * y2,
  ];
  const [hx, hy] = at2(p);
  const [px, py] = at2(Math.max(0, p - 0.02));
  const ang = Math.atan2(hy - py, hx - px);
  const d = `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`;
  const total = len * 1.2;
  return (
    <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={1} height={1}>
      <path
        d={d}
        fill="none"
        stroke={c}
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={dashed ? `${width * 3} ${width * 3}` : `${total}`}
        strokeDashoffset={dashed ? 0 : total * (1 - p)}
        style={{filter: glow(L, rgba(c, 0.5), 10), clipPath: dashed ? undefined : undefined}}
        opacity={dashed ? p : 1}
      />
      <path
        d={`M0,0 L${-width * 4.5},${-width * 2.6} L${-width * 3.4},0 L${-width * 4.5},${width * 2.6} Z`}
        fill={c}
        transform={`translate(${hx},${hy}) rotate(${(ang * 180) / Math.PI})`}
        opacity={ramp(p, 0.1, 0.3)}
      />
    </svg>
  );
};

// 圈重点：手画感的椭圆圈，画两圈不闭合
export const Ring: React.FC<{x: number; y: number; rx: number; ry?: number; f: number; at?: number; color?: string}> = ({
  x,
  y,
  rx,
  ry,
  f,
  at = 0,
  color,
}) => {
  const L = useLook();
  const c = color ?? L.accent;
  const p = ramp(f, at, at + 22, ease.inOut2);
  if (p <= 0) return null;
  const R = ry ?? rx * 0.6;
  const pts: string[] = [];
  const n = 80;
  for (let i = 0; i <= n * p; i++) {
    const t = (i / n) * Math.PI * 2 * 1.12 - 0.6;
    const wob = 1 + 0.04 * Math.sin(t * 3 + 1);
    pts.push(`${x + Math.cos(t) * rx * wob},${y + Math.sin(t) * R * wob}`);
  }
  return (
    <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={1} height={1}>
      <polyline points={pts.join(' ')} fill="none" stroke={c} strokeWidth={5} strokeLinecap="round" style={{filter: glow(L, rgba(c, 0.5), 10)}} />
    </svg>
  );
};

// 画面里的大字（不是字幕）：标题、关键数字、结论词
export const Big: React.FC<{
  x: number;
  y: number;
  children: React.ReactNode;
  size?: number;
  f: number;
  at?: number;
  color?: string;
  font?: 'title' | 'num' | 'label' | 'latin';
  weight?: number;
  align?: 'left' | 'center' | 'right';
  out?: number;
}> = ({x, y, children, size = 96, f, at = 0, color, font = 'title', weight, align = 'center', out}) => {
  const L = useLook();
  const p = ramp(f, at, at + 18);
  const o = out !== undefined ? 1 - ramp(f, out, out + 12, ease.in2) : 1;
  if (p <= 0 || o <= 0) return null;
  const tx = align === 'center' ? '-50%' : align === 'right' ? '-100%' : '0';
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(${tx}, -50%) translateY(${(1 - p) * 16}px) scale(${0.96 + 0.04 * p})`,
        opacity: p * o,
        filter: p < 1 ? `blur(${(1 - p) * 8}px)` : undefined,
        fontFamily: L.font[font],
        fontWeight: weight ?? (font === 'title' ? L.titleWeight : 700),
        fontSize: size,
        color: color ?? L.ink,
        whiteSpace: 'nowrap',
        letterSpacing: font === 'title' ? '0.06em' : '0.01em',
        textShadow: L.light ? 'none' : `0 0 30px ${rgba(color ?? L.ink, 0.25)}`,
        lineHeight: 1.1,
        textAlign: align,
      }}
    >
      {children}
    </div>
  );
};
