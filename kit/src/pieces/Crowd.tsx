// 点阵人口：一个点（或一个小人）代表一个人 / 一件事 / 一万块钱。
// 用来让观众"数得见"：1000 个人里有几个、两组差多少、一个比例到底是多大。
// 分组时点会跑到各自的组里，所以比例是"看出来"的，不是读出来的。
import React from 'react';
import {glow, useLook} from '../engine/look';
import {clamp, ease, hash, lerp, mixHex, rgba} from '../engine/motion';

export type Unit = 'dot' | 'person' | 'square';

type Props = {
  n: number; // 一共多少个
  x: number; // 整片的中心
  y: number;
  w: number; // 整片占多宽
  f: number;
  at?: number; // 从第几帧开始一个个出现
  appear?: number; // 全部出现用多少帧
  unit?: Unit;
  size?: number; // 单个的大小（不传就按宽度自动算）
  group?: (i: number) => number; // 每个点属于第几组（0 = 不分组）
  groupAt?: number; // 从第几帧开始分组
  groups?: {x: number; y: number; w: number}[]; // 每组摆在哪（下标 1 开始对应 group 返回的 1、2…）
  color?: (i: number) => string | undefined; // 每个点的颜色
  colorAt?: number; // 从第几帧开始上色（不传就一开始就是这个颜色）
  hi?: (i: number) => boolean; // 哪些点高亮（发光、放大）
  hiAt?: number;
};

const grid = (n: number, cx: number, cy: number, w: number, size: number) => {
  const gap = size * 1.35;
  const cols = Math.max(1, Math.floor(w / gap));
  const rows = Math.ceil(n / cols);
  return Array.from({length: n}, (_, i) => ({
    x: cx + ((i % cols) - (Math.min(n, cols) - 1) / 2) * gap,
    y: cy + (Math.floor(i / cols) - (rows - 1) / 2) * gap * (1.05),
  }));
};

const Person: React.FC<{x: number; y: number; s: number; c: string}> = ({x, y, s, c}) => (
  <g transform={`translate(${x},${y}) scale(${s / 20})`}>
    <circle cx={0} cy={-6.5} r={4.2} fill={c} />
    <path d="M-6.5,9 Q-7,0.5 -3.5,-0.8 L3.5,-0.8 Q7,0.5 6.5,9 Z" fill={c} />
  </g>
);

export const Crowd: React.FC<Props> = ({n, x, y, w, f, at = 0, appear = 30, unit = 'dot', size, group, groupAt = 0, groups, color, colorAt, hi, hiAt = 0}) => {
  const L = useLook();
  const auto = Math.sqrt((w * w * 0.56) / n) / 1.35;
  const sz = size ?? Math.max(4, Math.min(40, auto));
  const home = grid(n, x, y, w, sz);
  // 分组后的位置：每组各自排成网格
  const gpos: Record<number, {x: number; y: number}[]> = {};
  if (group && groups) {
    const members: Record<number, number[]> = {};
    for (let i = 0; i < n; i++) {
      const g = group(i);
      if (g) (members[g] ??= []).push(i);
    }
    Object.entries(members).forEach(([g, ids]) => {
      const G = groups[Number(g) - 1];
      if (!G) return;
      const pos = grid(ids.length, G.x, G.y, G.w, sz);
      ids.forEach((id, k) => ((gpos[id] ??= []).push(pos[k])));
    });
  }
  const items = [];
  for (let i = 0; i < n; i++) {
    const order = hash(i * 1.37); // 出现顺序打乱，像人群慢慢聚过来
    const p = ease.out3(clamp((f - at - order * appear) / 10));
    if (p <= 0) continue;
    const gp = gpos[i]?.[0];
    const gt = gp ? ease.inOut3(clamp((f - groupAt - hash(i * 3.3) * 18) / 26)) : 0;
    const px = gp ? lerp(home[i].x, gp.x, gt) : home[i].x;
    const py = gp ? lerp(home[i].y, gp.y, gt) - Math.sin(gt * Math.PI) * 30 : home[i].y;
    const isHi = hi?.(i) && f >= hiAt;
    const hp = isHi ? ease.out3(clamp((f - hiAt - hash(i) * 10) / 14)) : 0;
    const plain = mixHex(L.ink, L.bg, 0.25);
    const own = color?.(i);
    const base = own ? (colorAt === undefined ? own : mixHex(plain, own, ease.inOut2(clamp((f - colorAt - hash(i * 5.1) * 14) / 16)))) : plain;
    const c = isHi ? mixHex(base, L.accent, hp) : base;
    const s = sz * p * (1 + hp * 0.25);
    items.push({i, px, py, s, c, hp});
  }
  return (
    <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={1} height={1}>
      {items.map(({i, px, py, s, c, hp}) =>
        unit === 'person' ? (
          <g key={i} style={hp > 0.5 ? {filter: glow(L, rgba(L.accent, 0.6), 8)} : undefined}>
            <Person x={px} y={py} s={s} c={c} />
          </g>
        ) : unit === 'square' ? (
          <rect key={i} x={px - s / 2} y={py - s / 2} width={s} height={s} rx={s * 0.18} fill={c} />
        ) : (
          <circle key={i} cx={px} cy={py} r={s / 2} fill={c} style={hp > 0.5 ? {filter: glow(L, rgba(L.accent, 0.7), 6)} : undefined} />
        ),
      )}
    </svg>
  );
};
