// 真实地形：scripts/terrain.py 生成的山体阴影 + 海拔，按外观的色阶上色，
// 再把从高程里追出来的河网一条条"流"出来。地点、地理、河流、城市、战争路线都从这里起。
// 用法见 docs/pieces.md「真实地形」。外面套 <World cam> 就能在上面推拉摇。
import React from 'react';
import {Img, staticFile} from 'remotion';
import {useData} from '../engine/data';
import {useLook} from '../engine/look';
import {clamp, hexToRgb, rgba} from '../engine/motion';

export type TerrainMeta = {west: number; south: number; east: number; north: number; width: number; height: number};
type Rivers = {lines: [number, number, number][][]};

const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

// 经纬度 → 地形图上的像素
export const project = (m: TerrainMeta, lon: number, lat: number): [number, number] => [
  ((lon - m.west) / (m.east - m.west)) * m.width,
  ((mercY(m.north) - mercY(lat)) / (mercY(m.north) - mercY(m.south))) * m.height,
];

// 把色阶做成 SVG 滤镜：灰度海拔 → 外观的颜色
const TintFilter: React.FC<{id: string; ramp: string[]}> = ({id, ramp}) => {
  const ch = [0, 1, 2].map((k) => ramp.map((c) => (hexToRgb(c)[k] / 255).toFixed(3)).join(' '));
  return (
    <svg width={0} height={0} style={{position: 'absolute'}}>
      <filter id={id} colorInterpolationFilters="sRGB">
        <feColorMatrix type="saturate" values="0" />
        <feComponentTransfer>
          <feFuncR type="table" tableValues={ch[0]} />
          <feFuncG type="table" tableValues={ch[1]} />
          <feFuncB type="table" tableValues={ch[2]} />
        </feComponentTransfer>
      </filter>
    </svg>
  );
};

export const Terrain: React.FC<{
  name: string; // public/terrain/名字
  rivers?: number; // 河网画出来的进度 0–1（从大河到小溪依次出现）
  riverMin?: number; // 汇水比例小于这个的细流不画（默认 0.002）；想要更密的河网就调小
  flow?: number; // 河面上流动的亮点，传场景帧号就会动
  shade?: number; // 阴影强度 0–1
  dim?: number; // 整体压暗 0–1，让上面的标注更突出
  feather?: number; // 地图四边羽化掉多少（0–0.5，占边长的比例）；地图比画面小的时候，边缘就融进背景
  children?: (meta: TerrainMeta, p: (lon: number, lat: number) => [number, number]) => React.ReactNode;
}> = ({name, rivers = 1, riverMin = 0.002, flow, shade = 1, dim = 0, feather = 0, children}) => {
  const L = useLook();
  const meta = useData<TerrainMeta>(`terrain/${name}/meta.json`);
  const riv = useData<Rivers>(`terrain/${name}/rivers.json`);
  if (!meta || !riv) return null;
  const {width: W, height: H} = meta;
  const id = `tint-${L.name}`;
  const lines = riv.lines
    .map((pts) => ({pts, acc: Math.max(...pts.map((p) => p[2]))}))
    .filter((r) => r.acc >= riverMin)
    .sort((a, b) => b.acc - a.acc);
  const maxAcc = lines[0]?.acc ?? 1;
  return (
    <div
      style={{
        position: 'absolute', left: 0, top: 0, width: W, height: H,
        ...(feather > 0
          ? (() => {
              const e = `${feather * 100}%`;
              const m = `linear-gradient(to right, transparent, #000 ${e}, #000 calc(100% - ${e}), transparent), linear-gradient(to bottom, transparent, #000 ${e}, #000 calc(100% - ${e}), transparent)`;
              return {maskImage: m, WebkitMaskImage: m, maskComposite: 'intersect', WebkitMaskComposite: 'source-in'} as React.CSSProperties;
            })()
          : {}),
      }}
    >
      <TintFilter id={id} ramp={L.ramp} />
      <Img src={staticFile(`terrain/${name}/height.png`)} style={{position: 'absolute', width: W, height: H, filter: `url(#${id})`}} />
      <Img
        src={staticFile(`terrain/${name}/shade.png`)}
        style={{position: 'absolute', width: W, height: H, mixBlendMode: L.light ? 'multiply' : 'overlay', opacity: shade * (L.light ? 0.55 : 0.95)}}
      />
      {!L.light && (
        <Img
          src={staticFile(`terrain/${name}/shade.png`)}
          style={{position: 'absolute', width: W, height: H, mixBlendMode: 'multiply', opacity: shade * 0.45}}
        />
      )}
      {dim > 0 && <div style={{position: 'absolute', inset: 0, background: rgba(L.bg, dim)}} />}
      <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
        {lines.map((r, i) => {
          // 大河先出，小溪后出
          const order = i / Math.max(1, lines.length - 1);
          const p = clamp((rivers - order * 0.6) / 0.4);
          if (p <= 0) return null;
          const w = 1 + 6 * Math.sqrt(r.acc / maxAcc);
          const d = r.pts.map((q, k) => `${k ? 'L' : 'M'}${(q[0] * W).toFixed(1)},${(q[1] * H).toFixed(1)}`).join('');
          const len = r.pts.length * (W / 600) * 1.5;
          return (
            <g key={i}>
              <path d={d} fill="none" stroke={rgba(L.water, 0.25)} strokeWidth={w * 3} strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray={len} strokeDashoffset={len * (1 - p)} />
              <path d={d} fill="none" stroke={L.water} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray={len} strokeDashoffset={len * (1 - p)} opacity={0.9} />
              {flow !== undefined && w > 4 && (
                <path d={d} fill="none" stroke={rgba('#FFFFFF', 0.55)} strokeWidth={w * 0.45} strokeLinecap="round"
                  strokeDasharray={`${w * 2} ${w * 9}`} strokeDashoffset={-flow * 2.2} opacity={p} />
              )}
            </g>
          );
        })}
      </svg>
      {children?.(meta, (lon, lat) => project(meta, lon, lat))}
    </div>
  );
};
