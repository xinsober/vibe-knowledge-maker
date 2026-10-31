// 逐步演算：把一个过程一步一步真的演出来——排序、配对、排队、分组、投票、淘汰、传染……
// 先用脚本（或直接在代码里）把每一步每个东西在哪、什么颜色算好，交给它；
// 它负责在两步之间把每个东西平滑地挪过去，错开一点先后，看起来像在"发生"。
// 屏上的每个数字都应该能从上一步算出来：真的算一遍，比画示意图有说服力得多。
import React from 'react';
import {glow, SIZE, useLook} from '../engine/look';
import {clamp, ease, lerp, mixHex, rgba} from '../engine/motion';

export type TokenState = {
  x: number;
  y: number;
  s?: number; // 缩放，默认 1
  o?: number; // 不透明度，默认 1
  c?: string; // 颜色（6 位 hex）
  r?: number; // 旋转（度）
  hi?: boolean; // 高亮（加光圈）
  label?: string; // 这一步显示的字
};

export type Step = {at: number; items: Record<string, TokenState>};

type Props = {
  f: number;
  steps: Step[];
  dur?: number; // 每次挪动用多少帧
  stagger?: number; // 东西之间错开几帧
  arc?: number; // 挪动时往上拱的高度（像素），像被拿起来放下
  render?: (id: string, s: Required<Omit<TokenState, 'label' | 'hi'>> & {label?: string; hi: number}, i: number) => React.ReactNode;
};

const mixState = (a: TokenState, b: TokenState, t: number, arc: number) => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t) - Math.sin(Math.PI * t) * arc * Math.min(1, Math.hypot(b.x - a.x, b.y - a.y) / 200),
  s: lerp(a.s ?? 1, b.s ?? 1, t),
  o: lerp(a.o ?? 1, b.o ?? 1, t),
  c: a.c && b.c ? mixHex(a.c, b.c, t) : (b.c ?? a.c ?? ''),
  r: lerp(a.r ?? 0, b.r ?? 0, t),
  hi: lerp(a.hi ? 1 : 0, b.hi ? 1 : 0, t),
  label: t < 0.5 ? a.label : b.label,
});

// 默认的样子：一枚圆形筹码，里面一个字
export const Chip: React.FC<{x: number; y: number; s?: number; o?: number; c?: string; hi?: number; label?: string; size?: number}> = ({
  x, y, s = 1, o = 1, c, hi = 0, label, size = 72,
}) => {
  const L = useLook();
  const col = c || L.ink;
  const r = (size / 2) * s;
  return (
    <div style={{position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, opacity: o}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: `radial-gradient(circle at 35% 30%, ${mixHex(col, '#FFFFFF', 0.25)}, ${col} 60%, ${mixHex(col, '#000000', 0.25)})`,
          boxShadow: `0 ${4 * s}px ${12 * s}px rgba(0,0,0,${L.light ? 0.18 : 0.45})`,
          filter: hi > 0 ? glow(L, rgba(L.accent, 0.8 * hi), 22 * hi) : undefined,
        }}
      />
      {hi > 0 && <div style={{position: 'absolute', inset: -10 * s, borderRadius: '50%', border: `${3 * s}px solid ${rgba(L.accent, hi)}`}} />}
      {label ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: L.font.num,
            fontWeight: 700,
            fontSize: Math.max(SIZE.min, size * 0.46) * s,
            color: L.light ? '#FFFFFF' : L.bg,
          }}
        >
          {label}
        </div>
      ) : null}
    </div>
  );
};

export const Choreo: React.FC<Props> = ({f, steps, dur = 22, stagger = 2, arc = 40, render}) => {
  const ids = Object.keys(steps[0].items);
  steps.forEach((st) => Object.keys(st.items).forEach((k) => !ids.includes(k) && ids.push(k)));
  return (
    <>
      {ids.map((id, i) => {
        // 这个东西在每一步的状态（它没出现的步就跳过；要让它消失，在那一步写 o: 0）
        const own = steps.filter((st) => st.items[id]).map((st) => ({at: st.at + i * stagger, s: st.items[id]}));
        if (!own.length || f < own[0].at) return null;
        let k = 0;
        while (k + 1 < own.length && own[k + 1].at <= f) k++;
        const prev: TokenState = k === 0 ? {...own[0].s, o: 0, s: 0.6} : own[k - 1].s;
        const t = ease.inOut3(clamp((f - own[k].at) / dur));
        const st = mixState(prev, own[k].s, t, k === 0 ? 0 : arc) as unknown as TokenState;
        if (!st) return null;
        const full = {x: st.x, y: st.y, s: st.s ?? 1, o: st.o ?? 1, c: st.c ?? '', r: st.r ?? 0, hi: typeof st.hi === 'number' ? (st.hi as unknown as number) : st.hi ? 1 : 0, label: st.label};
        return <React.Fragment key={id}>{render ? render(id, full, i) : <Chip {...full} />}</React.Fragment>;
      })}
    </>
  );
};

// 排版小工具：一行、一列、一个网格、一个圆上的位置
export const layout = {
  row: (n: number, cx: number, cy: number, gap: number) => Array.from({length: n}, (_, i) => ({x: cx + (i - (n - 1) / 2) * gap, y: cy})),
  col: (n: number, cx: number, cy: number, gap: number) => Array.from({length: n}, (_, i) => ({x: cx, y: cy + (i - (n - 1) / 2) * gap})),
  grid: (n: number, cols: number, cx: number, cy: number, gap: number) => {
    const rows = Math.ceil(n / cols);
    return Array.from({length: n}, (_, i) => ({x: cx + ((i % cols) - (cols - 1) / 2) * gap, y: cy + (Math.floor(i / cols) - (rows - 1) / 2) * gap}));
  },
  circle: (n: number, cx: number, cy: number, r: number, start = -90) =>
    Array.from({length: n}, (_, i) => {
      const a = ((start + (360 * i) / n) * Math.PI) / 180;
      return {x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r};
    }),
};
