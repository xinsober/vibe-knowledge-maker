// 质感：自己画一样东西（微波炉、碗、杯子、手机、零件）时，用它给形状上材质，比平涂的色块像真的得多。
// 光统一从左上来：亮面、暗面、高光、落在地上的影子，四样都有，东西就"立"起来了。
// 用法：<svg><defs><Mat id="mw-body" kind="metal" color="#C9CDD2" /></defs><rect fill="url(#mw-body)" … /></svg>
// id 全片唯一（用场景名做前缀）。
import React from 'react';
import {mixHex} from '../engine/motion';

export type MatKind = 'metal' | 'plastic' | 'ceramic' | 'glass' | 'matte' | 'liquid';

const STOPS: Record<MatKind, (c: string) => [number, string, number][]> = {
  // 金属：上亮下暗，中间偏下一道窄的反光带
  metal: (c) => [[0, mixHex(c, '#FFFFFF', 0.45), 1], [0.42, mixHex(c, '#000000', 0.18), 1], [0.55, mixHex(c, '#FFFFFF', 0.55), 1], [0.62, mixHex(c, '#000000', 0.05), 1], [1, mixHex(c, '#000000', 0.4), 1]],
  // 塑料：柔和的明暗，没有硬反光
  plastic: (c) => [[0, mixHex(c, '#FFFFFF', 0.22), 1], [0.55, c, 1], [1, mixHex(c, '#000000', 0.28), 1]],
  // 瓷：釉面亮，边缘一点灰
  ceramic: (c) => [[0, mixHex(c, '#FFFFFF', 0.6), 1], [0.35, mixHex(c, '#FFFFFF', 0.2), 1], [0.85, mixHex(c, '#000000', 0.1), 1], [1, mixHex(c, '#000000', 0.3), 1]],
  // 玻璃：几乎透明，两边厚的地方颜色深一点
  glass: (c) => [[0, c, 0.45], [0.12, c, 0.12], [0.5, c, 0.06], [0.88, c, 0.14], [1, c, 0.5]],
  // 哑光：纸、布、木头、食物
  matte: (c) => [[0, mixHex(c, '#FFFFFF', 0.1), 1], [1, mixHex(c, '#000000', 0.18), 1]],
  // 液体：上面亮一层（液面反光），往下越来越深
  liquid: (c) => [[0, mixHex(c, '#FFFFFF', 0.35), 0.95], [0.08, c, 0.9], [1, mixHex(c, '#000000', 0.35), 0.95]],
};

export const Mat: React.FC<{id: string; kind: MatKind; color: string; dir?: 'v' | 'h'}> = ({id, kind, color, dir = kind === 'glass' ? 'h' : 'v'}) => (
  <linearGradient id={id} x1="0" y1="0" x2={dir === 'h' ? 1 : 0.25} y2={dir === 'h' ? 0 : 1}>
    {STOPS[kind](color).map(([o, c, a], i) => (
      <stop key={i} offset={o} stopColor={c} stopOpacity={a} />
    ))}
  </linearGradient>
);

// 落在地上的影子：东西不飘
export const ContactShadow: React.FC<{x: number; y: number; w: number; h?: number; o?: number; id: string}> = ({x, y, w, h = w * 0.12, o = 0.45, id}) => (
  <>
    <defs>
      <radialGradient id={id}>
        <stop offset="0" stopColor="#000000" stopOpacity={o} />
        <stop offset="1" stopColor="#000000" stopOpacity={0} />
      </radialGradient>
    </defs>
    <ellipse cx={x} cy={y} rx={w / 2} ry={h / 2} fill={`url(#${id})`} />
  </>
);

// 高光：左上角一道弧形的亮，玻璃、瓷、塑料都用得上
export const Gloss: React.FC<{x: number; y: number; w: number; h: number; o?: number}> = ({x, y, w, h, o = 0.5}) => (
  <path d={`M${x},${y + h} Q${x},${y} ${x + w},${y}`} fill="none" stroke="#FFFFFF" strokeWidth={Math.max(3, w * 0.08)} strokeLinecap="round" opacity={o} />
);
