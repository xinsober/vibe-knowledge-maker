// 地球：一个会转、会推近的地球。"这件事发生在哪"、"从这里到那里"、"全世界有多少"都从这里起。
// 只画陆地和海岸线，不画国界——国界线在国内平台发布有标准地图的要求，画错了片子会被下架。
// 推到很近（z ≥ 6）以后换成真实地形（Terrain）接着讲，两个叠化一下就是"从太空落到这里"。
import React, {useLayoutEffect, useMemo, useRef} from 'react';
import {geoGraticule10, geoOrthographic, geoPath, GeoPermissibleObjects, GeoProjection} from 'd3-geo';
import {feature} from 'topojson-client';
import land110 from 'world-atlas/land-110m.json';
import land50 from 'world-atlas/land-50m.json';
import {glow, SIZE, useLook} from '../engine/look';
import {clamp, ease, mixHex, ramp, rgba} from '../engine/motion';

/* eslint-disable @typescript-eslint/no-explicit-any */
const LAND = {
  low: feature(land110 as any, (land110 as any).objects.land) as unknown as GeoPermissibleObjects,
  high: feature(land50 as any, (land50 as any).objects.land) as unknown as GeoPermissibleObjects,
};
const GRAT = geoGraticule10();

export type GlobeApi = {
  p: (lon: number, lat: number) => [number, number] | null; // 经纬度 → 屏幕坐标；在背面时返回 null
  path: (g: GeoPermissibleObjects) => string; // 任意 GeoJSON → SVG 路径（自动沿大圆、自动裁掉背面）
  R: number; // 地球在屏上的半径（像素）
};

type Props = {
  lon: number; // 正对镜头的经纬度
  lat: number;
  z?: number; // 1 = 地球直径约占画面高度的 80%；越大越近
  x?: number; // 地球中心在屏上的位置
  y?: number;
  f: number;
  at?: number; // 从第几帧开始出现
  grid?: boolean; // 经纬网
  children?: (g: GlobeApi) => React.ReactNode;
};

const projFor = (lon: number, lat: number, R: number, x: number, y: number): GeoProjection =>
  geoOrthographic().rotate([-lon, -lat, 0]).scale(R).translate([x, y]).clipAngle(90).precision(0.4);

export const Globe: React.FC<Props> = ({lon, lat, z = 1, x = 960, y = 540, f, at = 0, grid = true, children}) => {
  const L = useLook();
  const ref = useRef<HTMLCanvasElement>(null);
  const show = ramp(f, at, at + 24, ease.out3);
  const R = 430 * z * (0.92 + 0.08 * show);
  const proj = useMemo(() => projFor(lon, lat, R, x, y), [lon, lat, R, x, y]);
  const ocean = mixHex(L.bg, L.water, L.light ? 0.3 : 0.2);
  const land = L.light ? mixHex(L.bg, L.ink, 0.2) : L.ramp[3];

  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, 1920, 1080);
    const path = geoPath(proj, g);
    // 海
    const og = g.createRadialGradient(x - R * 0.35, y - R * 0.4, R * 0.1, x, y, R);
    og.addColorStop(0, mixHex(ocean, '#FFFFFF', L.light ? 0.25 : 0.12));
    og.addColorStop(1, mixHex(ocean, L.bg, 0.45));
    g.beginPath();
    path({type: 'Sphere'});
    g.fillStyle = og;
    g.fill();
    // 经纬网
    if (grid) {
      g.beginPath();
      path(GRAT);
      g.strokeStyle = rgba(L.ink, L.light ? 0.12 : 0.1);
      g.lineWidth = 1;
      g.stroke();
    }
    // 陆地：近了换细一级的海岸线。先往右下错开画一层暗的当"厚度"，再画亮面，再描一圈亮边
    const shape = z > 1.8 ? LAND.high : LAND.low;
    g.save();
    g.translate(2.5, 3.5);
    g.beginPath();
    path(shape);
    g.fillStyle = rgba('#000000', L.light ? 0.18 : 0.45);
    g.fill();
    g.restore();
    const lg = g.createRadialGradient(x - R * 0.4, y - R * 0.45, R * 0.05, x, y, R * 1.05);
    lg.addColorStop(0, mixHex(land, '#FFFFFF', 0.22));
    lg.addColorStop(0.6, land);
    lg.addColorStop(1, mixHex(land, L.bg, 0.45));
    g.beginPath();
    path(shape);
    g.fillStyle = lg;
    g.fill();
    g.strokeStyle = rgba(L.light ? L.ink : '#FFFFFF', L.light ? 0.35 : 0.4);
    g.lineWidth = 1.3;
    g.stroke();
    // 明暗：左上亮，右下暗，边缘一圈压暗——球才"圆"
    const sh = g.createRadialGradient(x - R * 0.45, y - R * 0.5, R * 0.05, x - R * 0.1, y - R * 0.1, R * 1.25);
    sh.addColorStop(0, 'rgba(255,255,255,0.10)');
    sh.addColorStop(0.55, 'rgba(0,0,0,0)');
    sh.addColorStop(1, `rgba(0,0,0,${L.light ? 0.25 : 0.6})`);
    g.beginPath();
    path({type: 'Sphere'});
    g.fillStyle = sh;
    g.fill();
  }, [proj, R, x, y, z, grid, L, ocean, land]);

  const api: GlobeApi = {
    p: (lo, la) => {
      const d = Math.acos(clamp(Math.sin((la * Math.PI) / 180) * Math.sin((lat * Math.PI) / 180) +
        Math.cos((la * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.cos(((lo - lon) * Math.PI) / 180), -1, 1));
      if (d > Math.PI / 2 - 0.02) return null;
      return proj([lo, la]) as [number, number];
    },
    path: (gj) => geoPath(proj)(gj) ?? '',
    R,
  };

  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, opacity: show}}>
      {/* 大气：球外一圈光 */}
      <div
        style={{
          position: 'absolute', left: x - R * 1.25, top: y - R * 1.25, width: R * 2.5, height: R * 2.5, borderRadius: '50%',
          background: `radial-gradient(circle closest-side, ${rgba(L.water, 0)} 77%, ${rgba(L.water, L.light ? 0.25 : 0.42)} 80.5%, ${rgba(L.water, L.light ? 0.08 : 0.12)} 86%, ${rgba(L.water, 0)} 100%)`,
        }}
      />
      <canvas ref={ref} width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}} />
      {children?.(api)}
    </div>
  );
};

// 地球上的一个点：一圈圈往外扩的波纹 + 名字
export const Pin: React.FC<{g: GlobeApi; lon: number; lat: number; label?: string; f: number; at?: number; out?: number; color?: string; side?: 'left' | 'right'}> = ({
  g, lon, lat, label, f, at = 0, out = Infinity, color, side = 'right',
}) => {
  const L = useLook();
  const pt = g.p(lon, lat);
  const p = ramp(f, at, at + 14, ease.back) * (1 - ramp(f, out, out + 12));
  if (!pt || p <= 0) return null;
  const [x, y] = pt;
  const c = color ?? L.accent;
  const rings = [0, 1, 2].map((k) => ((f - at + k * 18) % 54) / 54);
  return (
    <>
      <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={1} height={1}>
        {rings.map((t, k) => (
          <circle key={k} cx={x} cy={y} r={10 + t * 46} fill="none" stroke={rgba(c, (1 - t) * 0.7 * p)} strokeWidth={3} />
        ))}
        <circle cx={x} cy={y} r={11 * p} fill={c} style={{filter: glow(L, rgba(c, 0.9), 14)}} />
        <circle cx={x} cy={y} r={4 * p} fill={L.light ? '#FFFFFF' : L.bg} />
      </svg>
      {label ? (
        <div
          style={{
            position: 'absolute', left: side === 'right' ? x + 36 : undefined, right: side === 'left' ? 1920 - x + 36 : undefined, top: y - SIZE.key * 0.68,
            fontFamily: L.font.label, fontWeight: 700, fontSize: SIZE.key, color: L.ink, whiteSpace: 'nowrap', opacity: Math.min(p, ramp(f, at + 8, at + 22)),
            textShadow: L.light ? 'none' : `0 2px 12px ${rgba(L.bg, 0.9)}`,
          }}
        >
          {label}
        </div>
      ) : null}
    </>
  );
};

// 两点之间沿大圆飞过去的一条线（航线、迁徙、传播）。p 是画出来的进度 0–1
export const Route: React.FC<{g: GlobeApi; from: [number, number]; to: [number, number]; p: number; color?: string; width?: number}> = ({
  g, from, to, p, color, width = 4,
}) => {
  const L = useLook();
  if (p <= 0) return null;
  const c = color ?? L.accent;
  const n = 64;
  const pts: [number, number][] = [];
  // 大圆插值
  const toV = ([lo, la]: [number, number]) => {
    const a = (lo * Math.PI) / 180;
    const b = (la * Math.PI) / 180;
    return [Math.cos(b) * Math.cos(a), Math.cos(b) * Math.sin(a), Math.sin(b)];
  };
  const A = toV(from);
  const B = toV(to);
  const om = Math.acos(clamp(A[0] * B[0] + A[1] * B[1] + A[2] * B[2], -1, 1)) || 1e-6;
  for (let i = 0; i <= n * clamp(p); i++) {
    const t = i / n;
    const s1 = Math.sin((1 - t) * om) / Math.sin(om);
    const s2 = Math.sin(t * om) / Math.sin(om);
    const v = [0, 1, 2].map((k) => s1 * A[k] + s2 * B[k]);
    pts.push([(Math.atan2(v[1], v[0]) * 180) / Math.PI, (Math.asin(clamp(v[2], -1, 1)) * 180) / Math.PI]);
  }
  if (pts.length < 2) return null;
  const d = g.path({type: 'LineString', coordinates: pts});
  const head = g.p(pts[pts.length - 1][0], pts[pts.length - 1][1]);
  return (
    <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={1} height={1}>
      <path d={d} fill="none" stroke={c} strokeWidth={width} strokeLinecap="round" style={{filter: glow(L, rgba(c, 0.7), 10)}} />
      {head && p < 1 ? <circle cx={head[0]} cy={head[1]} r={width * 2} fill="#FFFFFF" style={{filter: glow(L, rgba(c, 1), 16)}} /> : null}
    </svg>
  );
};

// 地球上的一条线：河、海岸、边界以外的任何走向（GeoJSON）。p 是画出来的进度 0–1。
// 世界大河的数据用 scripts/rivers.py 下载到 public/world/rivers.json，用 useData 读进来
export const GeoLine: React.FC<{g: GlobeApi; geo: GeoPermissibleObjects; p?: number; color?: string; width?: number}> = ({g, geo, p = 1, color, width = 3}) => {
  const L = useLook();
  if (p <= 0) return null;
  const c = color ?? L.water;
  return (
    <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={1} height={1}>
      <path d={g.path(geo)} pathLength={1} strokeDasharray={`${p} 1`} fill="none" stroke={c} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round"
        style={{filter: glow(L, rgba(c, 0.8), 8)}} />
    </svg>
  );
};
