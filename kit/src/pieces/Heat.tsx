// 热成像：把"哪里热、哪里凉"直接画成颜色（冷蓝 → 热红），像红外相机拍出来的那样。
// 加热、散热、体温、保温、冷热不均……温度看不见，涂上颜色观众一眼就知道热在哪、怎么走。
// field 返回每个位置此刻的温度（0 = 最冷，1 = 最热）；最好是真的算出来的（比如一步步解热传导），不是随手画的渐变。
import React, {useEffect, useRef} from 'react';
import {heat, SIZE, useLook} from '../engine/look';
import {hexToRgb} from '../engine/motion';

type Props = {
  x: number;
  y: number;
  w: number;
  h: number;
  field: (u: number, v: number) => number; // u、v 是区域里的相对位置 0–1；返回 0–1，返回负数表示这里不画（透明）
  res?: number; // 每格多少像素，越小越细（也越慢），默认 6
  o?: number;
  legend?: [string, string]; // 色标两头的字，例如 ['4°C', '75°C']；不传不画色标
  frame?: boolean; // 画红外相机的取景角
  clip?: string; // 形状的轮廓（svg path，坐标从这块区域的左上角算）：边缘按它裁得圆滑，不会一格一格的
};

export const HeatField: React.FC<Props> = ({x, y, w, h, field, res = 6, o = 1, legend, frame, clip}) => {
  const L = useLook();
  const ref = useRef<HTMLCanvasElement>(null);
  const cw = Math.ceil(w / res);
  const ch = Math.ceil(h / res);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(cw, ch);
    for (let j = 0; j < ch; j++)
      for (let i = 0; i < cw; i++) {
        const t = field((i + 0.5) / cw, (j + 0.5) / ch);
        const k = (j * cw + i) * 4;
        if (t < 0) {
          img.data[k + 3] = 0;
          continue;
        }
        const [r, g, b] = hexToRgb(heat(t));
        img.data[k] = r;
        img.data[k + 1] = g;
        img.data[k + 2] = b;
        img.data[k + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
  });
  const corner = 40;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: o}}>
      {/* 低分辨率画，再放大并稍微糊一下：像真的热像，不是一格一格的 */}
      <div style={{position: 'absolute', inset: 0, clipPath: clip ? `path('${clip}')` : undefined}}>
        <canvas ref={ref} width={cw} height={ch} style={{position: 'absolute', inset: 0, width: w, height: h, filter: `blur(${res * 0.6}px)`}} />
      </div>
      {frame && (
        <svg style={{position: 'absolute', left: -16, top: -16, overflow: 'visible'}} width={w + 32} height={h + 32}>
          {[[0, 0, 1, 1], [w + 32, 0, -1, 1], [0, h + 32, 1, -1], [w + 32, h + 32, -1, -1]].map(([cx, cy, sx, sy], i) => (
            <path key={i} d={`M${cx},${cy + sy * corner} L${cx},${cy} L${cx + sx * corner},${cy}`} fill="none" stroke={L.ink} strokeWidth={3} opacity={0.8} />
          ))}
        </svg>
      )}
      {legend && (
        <div style={{position: 'absolute', left: w + 40, top: 0, height: h, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between'}}>
          <div style={{fontFamily: L.font.num, fontSize: SIZE.label, color: L.ink, fontWeight: 700}}>{legend[1]}</div>
          <div style={{flex: 1, width: 18, margin: '12px 0', borderRadius: 9, background: `linear-gradient(to top, ${[0, 0.25, 0.5, 0.75, 1].map((t) => heat(t)).join(', ')})`}} />
          <div style={{fontFamily: L.font.num, fontSize: SIZE.label, color: L.ink, fontWeight: 700}}>{legend[0]}</div>
        </div>
      )}
    </div>
  );
};

// 把网格（比如 conduct 的结果）变成 field：格子之间平滑过渡；inside 外面的格子不参与，全在外面返回 -1
export const sampleGrid = (T: ArrayLike<number>, nx: number, ny: number, inside: (i: number, j: number) => boolean = () => true) => (u: number, v: number) => {
  const gx = u * nx - 0.5;
  const gy = v * ny - 0.5;
  const i0 = Math.floor(gx);
  const j0 = Math.floor(gy);
  let sum = 0;
  let wsum = 0;
  for (const [di, dj] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const i = Math.max(0, Math.min(nx - 1, i0 + di));
    const j = Math.max(0, Math.min(ny - 1, j0 + dj));
    if (!inside(i, j)) continue;
    const wgt = (di ? gx - i0 : 1 - (gx - i0)) * (dj ? gy - j0 : 1 - (gy - j0));
    sum += T[j * nx + i] * wgt;
    wsum += wgt;
  }
  return wsum > 1e-6 ? sum / wsum : -1;
};

// 一个最简单的热传导模拟：一块网格从边上受热，热一格格往里传。返回第 step 步的温度网格。
// 用法：const T = conduct(60, 40, 300, (i, j) => 是不是热源); 然后 field = (u, v) => T[...]
// 想要更真，就照这个写法把你那个东西的形状、热源、散热换进去——屏上的颜色就是真的算出来的。
export const conduct = (nx: number, ny: number, steps: number, source: (i: number, j: number) => boolean, inside: (i: number, j: number) => boolean = () => true, k = 0.22) => {
  let T = new Float32Array(nx * ny);
  const at = (A: Float32Array, i: number, j: number) => A[Math.max(0, Math.min(ny - 1, j)) * nx + Math.max(0, Math.min(nx - 1, i))];
  for (let s = 0; s < steps; s++) {
    const N = new Float32Array(nx * ny);
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        if (!inside(i, j)) continue;
        if (source(i, j)) {
          N[j * nx + i] = 1;
          continue;
        }
        const c = at(T, i, j);
        const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([di, dj]) => (inside(i + di, j + dj) ? at(T, i + di, j + dj) : c));
        N[j * nx + i] = c + k * (nb.reduce((a, b) => a + b, 0) - 4 * c);
      }
    T = N;
  }
  return T;
};
