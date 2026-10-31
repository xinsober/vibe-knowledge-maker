// 流动：成千上万个亮点顺着一个速度场流动——水流、气流、血流、人流、热对流、电流。
// 你只要写一个函数告诉它"每个位置往哪流、流多快"，它先把流线算好，再让亮点沿流线跑。
// 快的地方亮点拉长、变成强调色，慢的地方暗，观众一眼看出哪里急、哪里缓。
import React, {useLayoutEffect, useMemo, useRef} from 'react';
import {useLook} from '../engine/look';
import {hash, hexToRgb} from '../engine/motion';

export type Field = (x: number, y: number) => [number, number];

type Props = {
  id: string; // 这个流场的名字（同名就不重算流线）
  x?: number;
  y?: number;
  w: number;
  h: number;
  field: Field; // 坐标是相对这块区域的像素；返回每帧走多少像素
  f: number;
  count?: number; // 流线条数
  perLine?: number; // 每条流线上的亮点数
  trail?: number; // 拖尾长度（帧）
  mask?: (x: number, y: number) => boolean; // 返回 true 的地方不画（障碍物、岸）
  seeds?: 'left' | 'grid' | 'top'; // 流线从哪里出发
  color?: string; // 慢的颜色，默认 ink
  fast?: string; // 快的颜色，默认 accent
  vmax?: number; // 多快算"快"（每帧像素），默认自动
  opacity?: number;
  width?: number; // 亮点粗细
};

type Stream = {pts: Float32Array; speed: Float32Array; len: number};

const trace = (field: Field, w: number, h: number, sx: number, sy: number, mask?: Props['mask']): Stream | null => {
  const pts: number[] = [];
  const sp: number[] = [];
  let x = sx;
  let y = sy;
  for (let i = 0; i < 1400; i++) {
    if (x < -20 || y < -20 || x > w + 20 || y > h + 20) break;
    if (mask?.(x, y)) break;
    const [u1, v1] = field(x, y);
    const [u2, v2] = field(x + u1 * 0.5, y + v1 * 0.5);
    const s = Math.hypot(u2, v2);
    if (s < 0.02) break;
    pts.push(x, y);
    sp.push(s);
    x += u2;
    y += v2;
  }
  if (pts.length < 20) return null;
  return {pts: Float32Array.from(pts), speed: Float32Array.from(sp), len: sp.length};
};

const cache = new Map<string, Stream[]>();

export const Flow: React.FC<Props> = ({
  id, x = 0, y = 0, w, h, field, f, count = 220, perLine = 3, trail = 10, mask, seeds = 'left',
  color, fast, vmax, opacity = 1, width = 2.4,
}) => {
  const L = useLook();
  const ref = useRef<HTMLCanvasElement>(null);
  const key = `${id}|${w}|${h}|${count}|${seeds}`;
  const streams = useMemo(() => {
    if (cache.has(key)) return cache.get(key)!;
    const out: Stream[] = [];
    for (let i = 0; i < count; i++) {
      const sx = seeds === 'left' ? -10 + hash(i * 3.1) * 40 : hash(i * 3.1) * w;
      const sy = seeds === 'top' ? -10 + hash(i * 5.7) * 40 : seeds === 'left' ? (i + hash(i * 5.7)) * (h / count) : hash(i * 5.7) * h;
      const s = trace(field, w, h, sx, sy, mask);
      if (s) out.push(s);
    }
    cache.set(key, out);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const top = useMemo(() => {
    if (vmax) return vmax;
    let m = 0;
    for (const s of streams) for (let i = 0; i < s.len; i += 5) m = Math.max(m, s.speed[i]);
    return m * 0.85 || 1;
  }, [streams, vmax]);

  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, w, h);
    g.lineCap = 'round';
    const slow = hexToRgb(color ?? L.ink);
    const quick = hexToRgb(fast ?? L.accent);
    streams.forEach((s, si) => {
      for (let k = 0; k < perLine; k++) {
        // 每个亮点沿流线走：位置 = (帧号 + 错开的相位) 对流线长度取余。只由帧号决定。
        const head = Math.floor((f * 1 + hash(si * 13 + k * 7) * s.len + (k * s.len) / perLine) % s.len);
        const tail = Math.max(0, head - trail);
        if (head - tail < 2) continue;
        const v = Math.min(1, s.speed[head] / top);
        const col = slow.map((c0, j) => Math.round(c0 + (quick[j] - c0) * v));
        // 出生和走到尽头时淡入淡出，不会凭空冒出来
        const life = Math.min(1, head / 12, (s.len - head) / 12);
        g.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${(0.25 + 0.75 * v) * life * opacity})`;
        g.lineWidth = width * (0.7 + 0.6 * v);
        g.beginPath();
        g.moveTo(s.pts[tail * 2], s.pts[tail * 2 + 1]);
        for (let i = tail + 1; i <= head; i++) g.lineTo(s.pts[i * 2], s.pts[i * 2 + 1]);
        g.stroke();
      }
    });
  }, [f, streams, w, h, perLine, trail, top, color, fast, opacity, width, L]);

  return <canvas ref={ref} width={w} height={h} style={{position: 'absolute', left: x, top: y, width: w, height: h, mixBlendMode: L.light ? 'multiply' : 'screen'}} />;
};

// 常用的速度场
export const fields = {
  // 绕过一个圆柱（理想流体）：桥墩、石头、机翼的简化
  aroundCircle: (cx: number, cy: number, r: number, u = 3): Field => (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const r2 = dx * dx + dy * dy;
    if (r2 < r * r) return [0, 0];
    const k = (r * r) / (r2 * r2);
    return [u * (1 - k * (dx * dx - dy * dy)), u * (-k * 2 * dx * dy)];
  },
  // 河道：中间快、两岸慢；bend 让河道弯起来，外侧更快
  channel: (h: number, u = 3, bend = 0): Field => (x, y) => {
    const c = h / 2 + Math.sin(x / 260) * bend;
    const t = 1 - ((y - c) / (h / 2)) ** 2;
    const dydx = (Math.cos(x / 260) * bend) / 260;
    const outer = 1 + 0.4 * Math.sign(-Math.sin(x / 260)) * ((y - c) / (h / 2)) * (bend ? 1 : 0);
    const s = Math.max(0.05, t) * u * outer;
    return [s, s * dydx];
  },
  // 漩涡（台风、排水口、星系）
  vortex: (cx: number, cy: number, u = 3, inward = 0.25): Field => (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const r = Math.hypot(dx, dy) + 30;
    const s = (u * 200) / r;
    return [(-dy / r) * s - (dx / r) * s * inward, (dx / r) * s - (dy / r) * s * inward];
  },
  // 热对流：一格一格上升下降的环流
  convection: (cell = 320, u = 2): Field => (x, y) => [
    u * Math.sin((Math.PI * x) / cell) * Math.cos((Math.PI * y) / cell),
    -u * Math.cos((Math.PI * x) / cell) * Math.sin((Math.PI * y) / cell),
  ],
};
