// 分子：一颗颗有光泽的原子球，按真实的键长和键角摆好。水为什么能被微波加热、盐怎么溶进水、二氧化碳怎么吸热……
// 讲到"东西里面的小颗粒"时，画真的分子，比画一堆圆点让人信。
// 坐标单位是埃（Å），size 是 1 埃在屏上多少像素；rot 是在画面里转，spin 是绕竖轴转（看得出"翻过来"）。
import React from 'react';
import {SIZE, useLook} from '../engine/look';

type El = 'H' | 'C' | 'N' | 'O' | 'Na' | 'Cl' | 'S';
export type Atom = {el: El; x: number; y: number; z?: number};

// 原子的颜色（化学课本里通行的配色）和画出来的半径（埃，比真实范德华半径小一点，键才看得见）
const COLOR: Record<El, string> = {H: '#F4F4F2', C: '#4A4A4E', N: '#3F63D8', O: '#E0402F', Na: '#9A5CD0', Cl: '#3FB34F', S: '#E8C23A'};
const R: Record<El, number> = {H: 0.42, C: 0.62, N: 0.6, O: 0.62, Na: 0.95, Cl: 0.9, S: 0.8};

// 常见分子：真实的键长、键角
export const MOLECULES: Record<string, Atom[]> = {
  // 水：O–H 0.96 Å，H–O–H 104.5°
  H2O: [{el: 'O', x: 0, y: -0.12}, {el: 'H', x: -0.757, y: 0.466}, {el: 'H', x: 0.757, y: 0.466}],
  CO2: [{el: 'C', x: 0, y: 0}, {el: 'O', x: -1.16, y: 0}, {el: 'O', x: 1.16, y: 0}],
  O2: [{el: 'O', x: -0.6, y: 0}, {el: 'O', x: 0.6, y: 0}],
  N2: [{el: 'N', x: -0.55, y: 0}, {el: 'N', x: 0.55, y: 0}],
  // 甲烷：四面体，画成立体的样子
  CH4: [{el: 'C', x: 0, y: 0}, {el: 'H', x: 0, y: -1.09, z: 0}, {el: 'H', x: -1.03, y: 0.36, z: 0.3}, {el: 'H', x: 0.51, y: 0.36, z: -0.89}, {el: 'H', x: 0.51, y: 0.36, z: 0.89}],
  NaCl: [{el: 'Na', x: -1.18, y: 0}, {el: 'Cl', x: 1.18, y: 0}],
};

// 原子球的渐变：左上角高光，右下角暗，看起来是个球
export const AtomDefs: React.FC = () => (
  <defs>
    {(Object.keys(COLOR) as El[]).map((el) => (
      <radialGradient key={el} id={`atom-${el}`} cx="0.36" cy="0.32" r="0.75">
        <stop offset="0" stopColor="#FFFFFF" stopOpacity={0.95} />
        <stop offset="0.18" stopColor={COLOR[el]} />
        <stop offset="0.85" stopColor={COLOR[el]} stopOpacity={1} />
        <stop offset="1" stopColor="#000000" stopOpacity={0.55} />
      </radialGradient>
    ))}
  </defs>
);

type Props = {
  kind?: keyof typeof MOLECULES;
  atoms?: Atom[];
  x: number;
  y: number;
  size?: number; // 1 Å 多少像素
  rot?: number; // 在画面里转（度）
  spin?: number; // 绕竖轴转（度），180 = 翻个面
  o?: number;
  glow?: number; // 0–1：整颗发光（被加热、被选中）
  charges?: boolean; // 标出哪头带正电、哪头带负电（δ+ δ−）
  defs?: boolean; // 一个 svg 里画很多颗时，只让第一颗带上渐变定义
};

// 一颗分子（画在 svg 里：外面自己包一层 <svg>，或者用 <MoleculeSvg>）
export const Molecule: React.FC<Props> = ({kind = 'H2O', atoms, x, y, size = 60, rot = 0, spin = 0, o = 1, glow = 0, charges, defs = true}) => {
  const L = useLook();
  const list = atoms ?? MOLECULES[kind];
  const a = (rot * Math.PI) / 180;
  const s = (spin * Math.PI) / 180;
  const pts = list.map((p) => {
    const z0 = p.z ?? 0;
    const x1 = p.x * Math.cos(s) - z0 * Math.sin(s);
    const z1 = p.x * Math.sin(s) + z0 * Math.cos(s);
    return {el: p.el, X: x + (x1 * Math.cos(a) - p.y * Math.sin(a)) * size, Y: y + (x1 * Math.sin(a) + p.y * Math.cos(a)) * size, Z: z1};
  });
  // 键：和中心原子（第一个）相连
  const bonds = pts.slice(1).map((p, i) => ({a: pts[0], b: p, k: i}));
  const order = [...pts].sort((p, q) => q.Z - p.Z);
  const negative = list.length > 1 ? pts.reduce((m, p) => (R[p.el] > R[m.el] ? p : m), pts[0]) : null;
  return (
    <g opacity={o} style={glow > 0 ? {filter: `drop-shadow(0 0 ${8 + glow * 18}px ${L.accent})`} : undefined}>
      {defs && <AtomDefs />}
      {bonds.map(({a: p, b: q, k}) => (
        <line key={k} x1={p.X} y1={p.Y} x2={q.X} y2={q.Y} stroke="#B8B4AC" strokeWidth={size * 0.16} strokeLinecap="round" />
      ))}
      {order.map((p, i) => (
        // 浅色底上白色的氢会看不见：描一圈细边
        <circle key={i} cx={p.X} cy={p.Y} r={R[p.el] * size * (1 - p.Z * 0.06)} fill={`url(#atom-${p.el})`} stroke={L.light ? 'rgba(60,45,30,0.35)' : 'none'} strokeWidth={Math.max(1, size * 0.03)} />
      ))}
      {charges && negative && (
        <>
          <text x={negative.X} y={negative.Y - R[negative.el] * size - 14} textAnchor="middle" fontFamily={L.font.label} fontWeight={700} fontSize={Math.max(SIZE.label, size * 0.5)} fill={L.ink}>
            −
          </text>
          {pts
            .filter((p) => p !== negative)
            .map((p, i) => {
              const dx = p.X - negative.X;
              const dy = p.Y - negative.Y;
              const d = Math.hypot(dx, dy) || 1;
              return (
                <text key={i} x={p.X + (dx / d) * (R[p.el] * size + 22)} y={p.Y + (dy / d) * (R[p.el] * size + 22) + size * 0.17} textAnchor="middle"
                  fontFamily={L.font.label} fontWeight={700} fontSize={Math.max(SIZE.label, size * 0.5)} fill={L.ink}>
                  +
                </text>
              );
            })}
        </>
      )}
    </g>
  );
};

// 放在普通 div 层里用：自己带一层铺满画面的 svg
export const MoleculeSvg: React.FC<Props> = (p) => (
  <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={1920} height={1080}>
    <Molecule {...p} />
  </svg>
);
