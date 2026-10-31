// 开头：第一帧就是转着的地球和发光的黄河；一路俯冲落到真实地形上，真卫星图从河中间晕开盖满画面，
// 先拉一条直线（两头相距多远），再让河道一点点画出来，右边的里程跟着跳到 40 公里。
// 最后把两条线从地图上揭下来、拉直，并排放到数字底下：河道正好是直线的两倍长，数字变成眼睛看得见的长短。
import React from 'react';
import {GeoPermissibleObjects} from 'd3-geo';
import {World} from '../../engine/Camera';
import {useData} from '../../engine/data';
import {useScene} from '../../engine/Film';
import {glow, SIZE, useLook} from '../../engine/look';
import {ease, lerp, ramp, rgba} from '../../engine/motion';
import {GeoLine, Globe, Pin} from '../../pieces/Globe';
import {Satellite} from '../../pieces/Satellite';
import {Terrain, TerrainMeta} from '../../pieces/Terrain';
import {Odometer} from '../../pieces/Years';

type Main = {points: [number, number][]; lengthKm: number; straightKm: number};

const SITE = {lon: 110.43, lat: 36.71}; // 这段河的中心
const LAND = 70; // 第几帧从地球换到地形

export const Dive: React.FC = () => {
  const L = useLook();
  const {f, cue} = useScene();
  const rivers = useData<Record<string, GeoPermissibleObjects>>('world/rivers.json');
  const main = useData<Main>('sat/bends/main.json');
  const meta = useData<TerrainMeta>('terrain/bends/meta.json');
  if (!rivers || !main || !meta) return null;

  // 地球：越来越快地冲下去（ease.in），地形：越来越慢地落定（ease.out）——接起来就是一次俯冲
  const dive = ease.in2(Math.min(1, f / (LAND + 30)));
  const z = Math.exp(lerp(Math.log(1.3), Math.log(60), dive));
  const lon = lerp(96, SITE.lon, ease.inOut2(Math.min(1, f / LAND)));
  const lat = lerp(28, SITE.lat, ease.inOut2(Math.min(1, f / LAND)));
  const globeOut = ramp(f, LAND + 6, LAND + 28, ease.inOut2);

  const land = ramp(f, LAND, LAND + 50, ease.out3);
  const fit = 1080 / meta.height; // 整段河竖着刚好放下
  // 落定后往左让一点，右边留给数字
  const slide = ramp(f, cue(1) - 10, cue(1) + 30, ease.inOut3);
  const cam = {x: meta.width / 2 + (330 / fit) * slide, y: meta.height / 2, z: lerp(fit * 0.3, fit, land)};
  const scr = ([mx, my]: [number, number]): [number, number] => [960 + (mx - cam.x) * cam.z, 540 + (my - cam.y) * cam.z];

  const pts = main.points.map(([u, v]) => [u * meta.width, v * meta.height] as [number, number]);
  const a = scr(pts[0]);
  const b = scr(pts[pts.length - 1]);
  const straight = ramp(f, cue(1), cue(1) + 26, ease.inOut2);
  const draw = ramp(f, cue(2), cue(2) + 80, ease.inOut2);
  const riverD = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(0)},${p[1].toFixed(0)}`).join('');

  // 拉直：每个点按它在河道上的位置（走了多远）落到底下那根长条上，从上游一头开始先揭起来
  const PULL = cue(2) + 92;
  const BAR = {x: 1330, w: 520, yS: 506, yR: 776};
  const sp = pts.map(scr);
  const run = [0];
  for (let i = 1; i < sp.length; i++) run.push(run[i - 1] + Math.hypot(sp[i][0] - sp[i - 1][0], sp[i][1] - sp[i - 1][1]));
  const total = run[run.length - 1];
  const pulled = sp.map(([x, y], i) => {
    const s = run[i] / total;
    const t = ease.inOut3(ramp(f, PULL + s * 26, PULL + s * 26 + 34));
    return [lerp(x, BAR.x + s * BAR.w, t), lerp(y, BAR.yR, t)];
  });
  const lift = ramp(f, PULL, PULL + 20);
  const sBar = (BAR.w * main.straightKm) / main.lengthKm;
  const tS = ease.inOut3(ramp(f, PULL + 6, PULL + 46));
  const A: [number, number] = [lerp(a[0], BAR.x, tS), lerp(a[1], BAR.yS, tS)];
  const B: [number, number] = [lerp(b[0], BAR.x + sBar, tS), lerp(b[1], BAR.yS, tS)];

  return (
    <>
      {land > 0 && (
        <div style={{position: 'absolute', inset: 0, opacity: ramp(f, LAND, LAND + 20)}}>
          <World cam={cam}>
            <Terrain name="bends" riverMin={0.06} flow={f} feather={0.1} />
            <Satellite name="bends" reveal={ramp(f, LAND + 14, LAND + 70, ease.inOut2)} from={[SITE.lon, SITE.lat]} feather={0.1} dim={0.3 * draw} />
            <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={1} height={1}>
              <path d={riverD} pathLength={1} strokeDasharray={`${draw} 1`} fill="none" stroke={L.accent} strokeWidth={9 / fit} strokeLinecap="round"
                strokeLinejoin="round" opacity={1 - 0.65 * lift} style={{filter: glow(L, rgba(L.accent, 0.9), 14)}} />
            </svg>
          </World>
          {/* 直线：两头连起来；拉直时飞到「两头直线」底下 */}
          <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={1} height={1}>
            {tS > 0 && <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={L.ink} strokeWidth={4} strokeDasharray="14 10" opacity={0.3} />}
            <line x1={A[0]} y1={A[1]} x2={lerp(A[0], B[0], straight)} y2={lerp(A[1], B[1], straight)} stroke={L.ink} strokeWidth={lerp(4, 10, tS)}
              strokeDasharray={tS < 1 ? '14 10' : undefined} strokeLinecap="round" opacity={0.9} />
            {[A, B].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={12 * straight * (1 - 0.4 * tS)} fill={L.ink} style={{filter: glow(L, rgba(L.ink, 0.6), 10)}} />
            ))}
            {/* 河道：揭下来，拉直 */}
            {lift > 0 && (
              <path d={pulled.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('')} fill="none" stroke={L.accent}
                strokeWidth={lerp(9, 12, tS)} strokeLinecap="round" strokeLinejoin="round" opacity={lift} style={{filter: glow(L, rgba(L.accent, 0.9), 14)}} />
            )}
            {/* 在长条上标出直线那么长的位置：正好一半 */}
            <line x1={BAR.x + sBar} y1={BAR.yR - 22} x2={BAR.x + sBar} y2={BAR.yR + 22} stroke={L.ink} strokeWidth={4} strokeLinecap="round" opacity={ramp(f, PULL + 62, PULL + 74)} />
          </svg>
          {/* 右边的两行数：直线多远、河道多长 */}
          <div style={{position: 'absolute', left: 1330, top: 290, opacity: straight, fontFamily: L.font.label, fontWeight: 700, fontSize: SIZE.key, color: L.dim}}>两头直线</div>
          <div style={{position: 'absolute', left: 1330, top: 372, opacity: straight, fontFamily: L.font.num, fontWeight: 700, fontSize: 104, color: L.ink, lineHeight: 1}}>
            {main.straightKm.toFixed(0)}<span style={{fontSize: SIZE.key, color: L.dim, marginLeft: 12, fontFamily: L.font.label}}>公里</span>
          </div>
          <div style={{position: 'absolute', left: 1330, top: 536, opacity: ramp(f, cue(2), cue(2) + 12), fontFamily: L.font.label, fontWeight: 700, fontSize: SIZE.key, color: L.accent}}>
            河道
          </div>
          {draw > 0 && (
            <Odometer value={Math.round(main.lengthKm) * draw} x={1330} y={666} size={104} color={L.accent} digits={1} suffix="公里" />
          )}
        </div>
      )}
      {globeOut < 1 && (
        <div style={{position: 'absolute', inset: 0, opacity: 1 - globeOut}}>
          <Globe lon={lon} lat={lat} z={z} f={f} at={-40}>
            {(g) => (
              <>
                <GeoLine g={g} geo={rivers.Huang} p={0.35 + 0.65 * ramp(f, 0, 40, ease.inOut2)} width={4 + z * 0.4} />
                {z < 8 && <Pin g={g} lon={SITE.lon} lat={SITE.lat} label="黄河" f={f} at={22} />}
              </>
            )}
          </Globe>
        </div>
      )}
    </>
  );
};
