// 卫星图：scripts/satellite.py 裁出来的真彩色卫星影像（Sentinel-2，10 米一个像素）。
// 讲一个真实的地方时，真影像里的河道颜色、沙滩、田块、山脊是画不出来的，一眼就让人信。
// 和同名的 Terrain 逐像素对齐：放在同一个 World 里，先出地形、再把卫星图从一个点"晕开"盖上去，就是从地图落到真实世界。
import React from 'react';
import {Img, staticFile} from 'remotion';
import {useData} from '../engine/data';
import {useLook} from '../engine/look';
import {clamp} from '../engine/motion';
import {project, TerrainMeta} from './Terrain';

type SatMeta = TerrainMeta & {date: string; credit: string};

export const Satellite: React.FC<{
  name: string; // public/sat/名字
  reveal?: number; // 0–1：从 from 那一点往外晕开的进度（1 = 整张都盖上）
  from?: [number, number]; // 从哪儿晕开（经度、纬度），默认图中心
  grade?: number; // 0–1：往外观的色调上靠一点，和整片的颜色统一（默认 0：真实的颜色就是它的价值）
  dim?: number; // 整体压暗 0–1，让上面的标注更突出
  feather?: number; // 四边羽化（0–0.5），图比画面小的时候边缘融进背景
  children?: (meta: SatMeta, p: (lon: number, lat: number) => [number, number]) => React.ReactNode;
}> = ({name, reveal = 1, from, grade = 0, dim = 0, feather = 0, children}) => {
  const L = useLook();
  const meta = useData<SatMeta>(`sat/${name}/meta.json`);
  if (!meta) return null;
  const {width: w, height: h} = meta;
  const [cx, cy] = from ? project(meta, from[0], from[1]) : [w / 2, h / 2];
  // 晕开的圆要能盖到离中心最远的那个角
  const far = Math.max(...[[0, 0], [w, 0], [0, h], [w, h]].map(([x, y]) => Math.hypot(x - cx, y - cy)));
  const r = clamp(reveal) * far * 1.15;
  const masks = [
    reveal < 1 ? `radial-gradient(circle at ${cx}px ${cy}px, #000 ${r * 0.7}px, transparent ${r}px)` : '',
    feather > 0 ? `linear-gradient(to right, transparent, #000 ${feather * 100}%, #000 ${100 - feather * 100}%, transparent)` : '',
    feather > 0 ? `linear-gradient(to bottom, transparent, #000 ${feather * 100}%, #000 ${100 - feather * 100}%, transparent)` : '',
  ].filter(Boolean);
  const mask = masks.length ? masks.join(', ') : undefined;
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: w, height: h}}>
      <div style={{position: 'absolute', inset: 0, WebkitMaskImage: mask, WebkitMaskComposite: masks.length > 1 ? 'source-in' : undefined, maskComposite: masks.length > 1 ? 'intersect' : undefined}}>
        <Img src={staticFile(`sat/${name}/image.jpg`)} style={{width: w, height: h, display: 'block', filter: `brightness(${1 - dim * 0.6}) saturate(${1 - grade * 0.2})`}} />
        <div style={{position: 'absolute', inset: 0, background: L.ramp[3], mixBlendMode: 'color', opacity: grade * 0.3}} />
        <div style={{position: 'absolute', inset: 0, background: L.bg, mixBlendMode: L.light ? 'multiply' : 'soft-light', opacity: grade * 0.6}} />
      </div>
      {children?.(meta, (lon, lat) => project(meta, lon, lat))}
    </div>
  );
};
