// 分叉：一件事往下分成几种可能，每种再分——概率、决策、因果链、族谱、淘汰赛都是这个形状。
// 从左往右一层层长出来；weight 让枝的粗细等于概率，"哪条路最常见"一眼就看出来。
// hi 里列出的那条路最后亮起来，其他变暗。
import React from 'react';
import {glow, SIZE, useLook} from '../engine/look';
import {ease, mixHex, ramp, rgba} from '../engine/motion';

export type TreeNode = {
  id: string;
  label: string;
  edge?: string; // 连到它的那根枝上写的字，例如 '1/2'
  weight?: number; // 0–1，枝的粗细（不传就一样粗）
  value?: string; // 末端结果，写在节点右边
  children?: TreeNode[];
};

type Placed = {n: TreeNode; depth: number; x: number; y: number; parent?: Placed};

const textW = (s: string, size: number) => [...s].reduce((w, ch) => w + (ch.charCodeAt(0) > 255 ? size : size * 0.58), 0);

export const Tree: React.FC<{
  root: TreeNode;
  x: number; // 整棵树占的区域
  y: number;
  w: number;
  h: number;
  f: number;
  at?: number;
  gap?: number; // 每长一层隔多少帧
  hi?: string[]; // 要点亮的那条路上的节点 id
  hiAt?: number;
  size?: number; // 节点字号
}> = ({root, x, y, w, h, f, at = 0, gap = 24, hi = [], hiAt = Infinity, size = SIZE.key}) => {
  const L = useLook();
  const placed: Placed[] = [];
  let leaves = 0;
  let maxD = 0;
  const count = (n: TreeNode, d: number): void => {
    maxD = Math.max(maxD, d);
    if (!n.children?.length) leaves++;
    n.children?.forEach((c) => count(c, d + 1));
  };
  count(root, 0);
  let li = 0;
  const place = (n: TreeNode, d: number, parent?: Placed): Placed => {
    const me: Placed = {n, depth: d, x: x + (maxD ? (d / maxD) * w : 0), y: 0, parent};
    placed.push(me);
    if (n.children?.length) {
      const kids = n.children.map((c) => place(c, d + 1, me));
      me.y = (kids[0].y + kids[kids.length - 1].y) / 2;
    } else {
      me.y = y + (leaves > 1 ? (li++ / (leaves - 1)) * h : h / 2);
    }
    return me;
  };
  place(root, 0);
  const hp = ramp(f, hiAt, hiAt + 20, ease.inOut2);
  const on = (id: string) => hi.includes(id);
  const nodeW = (n: TreeNode) => textW(n.label, size) + 48;
  return (
    <div style={{position: 'absolute', left: 0, top: 0}}>
      <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={1} height={1}>
        {placed.map((p, i) => {
          if (!p.parent) return null;
          const t = ramp(f, at + (p.depth - 0.6) * gap, at + (p.depth - 0.6) * gap + gap * 0.9, ease.inOut2);
          if (t <= 0) return null;
          const x0 = p.parent.x + nodeW(p.parent.n) / 2;
          const y0 = p.parent.y;
          const x1 = p.x - nodeW(p.n) / 2;
          const y1 = p.y;
          const mx = (x0 + x1) / 2;
          const d = `M${x0},${y0} C${mx},${y0} ${mx},${y1} ${x1},${y1}`;
          const len = Math.hypot(x1 - x0, y1 - y0) * 1.25;
          const lit = on(p.n.id) && on(p.parent.n.id);
          const c = mixHex(mixHex(L.ink, L.bg, 0.35), L.accent, lit ? hp : 0);
          const sw = p.n.weight !== undefined ? 3 + p.n.weight * 26 : 4;
          return (
            <path key={i} d={d} fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" opacity={1 - (!lit ? hp * 0.6 : 0)}
              strokeDasharray={len} strokeDashoffset={len * (1 - t)} style={lit && hp > 0 ? {filter: glow(L, rgba(L.accent, 0.6 * hp), 12)} : undefined} />
          );
        })}
      </svg>
      {placed.map((p, i) => {
        const appear = ramp(f, at + p.depth * gap, at + p.depth * gap + 16, ease.back);
        if (appear <= 0) return null;
        const lit = on(p.n.id);
        const dimmed = !lit ? hp * 0.6 : 0;
        const nw = nodeW(p.n);
        const edgeP = ramp(f, at + p.depth * gap + 6, at + p.depth * gap + 20);
        return (
          <React.Fragment key={i}>
            <div style={{
              position: 'absolute', left: p.x - nw / 2, top: p.y - size * 0.85, width: nw, height: size * 1.7, borderRadius: size * 0.85,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: lit && hp > 0 ? mixHex(L.panel, L.accent, 0.85 * hp) : L.panel,
              border: `2px solid ${lit ? mixHex(L.line, L.accent, hp) : L.line}`,
              boxShadow: lit && hp > 0 && !L.light ? `0 0 30px ${rgba(L.accent, 0.5 * hp)}` : `0 6px 20px rgba(0,0,0,${L.light ? 0.1 : 0.35})`,
              fontFamily: L.font.label, fontWeight: 700, fontSize: size, color: lit && hp > 0.5 ? (L.light ? '#FFFFFF' : L.bg) : L.ink,
              transform: `scale(${appear})`, opacity: 1 - dimmed, whiteSpace: 'nowrap',
            }}>
              {p.n.label}
            </div>
            {p.n.edge && p.parent ? (
              <div style={{
                position: 'absolute', left: (p.parent.x + nodeW(p.parent.n) / 2 + p.x - nw / 2) / 2, top: (p.parent.y + p.y) / 2 - SIZE.label * 0.7 - (p.y < p.parent.y ? 22 : p.y > p.parent.y ? -22 : 30),
                transform: 'translateX(-50%)', fontFamily: L.font.num, fontWeight: 700, fontSize: SIZE.label, color: lit && hp > 0 ? L.accent : L.dim,
                opacity: edgeP * (1 - dimmed), whiteSpace: 'nowrap', textShadow: L.light ? 'none' : `0 2px 10px ${L.bg}`,
              }}>
                {p.n.edge}
              </div>
            ) : null}
            {p.n.value ? (
              <div style={{position: 'absolute', left: p.x + nw / 2 + 24, top: p.y - size * 0.62, fontFamily: L.font.num, fontWeight: 700, fontSize: size,
                color: lit && hp > 0 ? L.accent : L.ink, opacity: edgeP * (1 - dimmed), whiteSpace: 'nowrap'}}>
                {p.n.value}
              </div>
            ) : null}
          </React.Fragment>
        );
      })}
    </div>
  );
};
