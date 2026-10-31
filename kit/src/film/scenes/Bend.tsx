// 直河 → 有了一点弯。两个场景用同一条河、同一个机位，叠化时看不出接缝，像是同一条河自己弯了。
import React from 'react';
import {useScene} from '../../engine/Film';
import {glow, useLook} from '../../engine/look';
import {clamp, ease, keyed, lerp, mixHex, ramp, rgba} from '../../engine/motion';
import {Tag} from '../../pieces/Draw';
import {bends, Floodplain, LANES, meander, RiverPlan, Shape, speedAt} from './River';

// 机位：谷从画面左外到右外，河宽 170
export const VALLEY = {x: 0, w: 1920, y: 470, width: 210};

// 流速剖面：在第 i 个点横着排一排箭头，箭头越长水越快——"中间快、两边慢"一眼就看出来
const Profile: React.FC<{s: Shape; i: number; x: number; y: number; w: number; width: number; p: number}> = ({s, i, x, y, w, width, p}) => {
  const L = useLook();
  if (p <= 0) return null;
  const kw = s.k[i] * (width / w);
  const [cx, cy] = [x + s.pts[i][0] * w, y + s.pts[i][1] * w];
  const [tx, ty] = s.tan[i];
  const [nx, ny] = s.nor[i];
  const tips = LANES.map((o) => {
    const v = speedAt(o, kw);
    const bx = cx + nx * o * width * 1.2;
    const by = cy + ny * o * width * 1.2;
    const len = 230 * v * p;
    return {bx, by, ex: bx + tx * len, ey: by + ty * len, v};
  });
  return (
    <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={1} height={1}>
      <line x1={tips[0].bx} y1={tips[0].by} x2={tips[6].bx} y2={tips[6].by} stroke={L.ink} strokeWidth={3} opacity={0.8} />
      <path d={tips.map((t, k) => `${k ? 'L' : 'M'}${t.ex},${t.ey}`).join('')} fill="none" stroke={rgba(L.ink, 0.55)} strokeWidth={2} strokeDasharray="6 6" />
      {tips.map((t, k) => {
        const c = mixHex(L.ink, L.accent, clamp((t.v - 0.7) / 0.6));
        const ang = (Math.atan2(t.ey - t.by, t.ex - t.bx) * 180) / Math.PI;
        return (
          <g key={k} style={{filter: glow(L, rgba(c, 0.6), 6)}}>
            <line x1={t.bx} y1={t.by} x2={t.ex} y2={t.ey} stroke={c} strokeWidth={5} strokeLinecap="round" />
            <path d="M0,0 L-16,-9 L-12,0 L-16,9 Z" fill={c} transform={`translate(${t.ex},${t.ey}) rotate(${ang})`} />
          </g>
        );
      })}
    </svg>
  );
};

export const Straight: React.FC = () => {
  const L = useLook();
  const {f, cue} = useScene();
  const s = meander(0);
  const i = Math.round(s.a + (s.b - s.a) * 0.58);
  const {x, y, w, width} = VALLEY;
  const [cx, cy] = [x + s.pts[i][0] * w, y + s.pts[i][1] * w];
  return (
    <>
      <Floodplain />
      <RiverPlan shape={s} x={x} y={y} w={w} width={width} f={f + 300} bars={0} />
      <Profile s={s} i={i} x={x} y={y} w={w} width={width} p={ramp(f, cue(1), cue(1) + 24, ease.out3)} />
      <Tag x={cx + 240} y={cy} dx={90} dy={-190} text="中间最快" f={f} at={cue(1) + 22} color={L.accent} />
      <Tag x={cx + 110} y={cy + width * 0.46} dx={120} dy={170} text="贴岸最慢" f={f} at={cue(1) + 34} />
    </>
  );
};

export const Fling: React.FC = () => {
  const L = useLook();
  const {f, cue} = useScene();
  const om = keyed(f, [[6, 0], [56, 0.8]], ease.inOut2);
  const s = meander(om);
  const {x, y, w, width} = VALLEY;
  // 选画面中间那道弯，推近去看
  const apex = bends(meander(0.8)).reduce((a, b) => (Math.abs(b.at[0] - 0.5) < Math.abs(a.at[0] - 0.5) ? b : a));
  const zoom = keyed(f, [[cue(1) - 16, 1], [cue(1) + 30, 1.45]], ease.inOut3);
  const fx = lerp(960, x + apex.at[0] * w, ease.inOut3(clamp((zoom - 1) / 0.45)));
  const fy = lerp(540, y + apex.at[1] * w, ease.inOut3(clamp((zoom - 1) / 0.45)));
  const X = 960 + (x - fx) * zoom;
  const Y = 540 + (y - fy) * zoom;
  const W = w * zoom;
  const Wd = width * zoom;
  const show = ramp(f, cue(1) + 20, cue(1) + 44, ease.out3);
  const i = apex.i;
  const [ax, ay] = [X + s.pts[i][0] * W, Y + s.pts[i][1] * W];
  const out = (d: number): [number, number] => [ax + apex.n[0] * d, ay + apex.n[1] * d];
  const o1 = out(Wd * 0.62);
  const o2 = out(-Wd * 0.62);
  return (
    <>
      <Floodplain />
      <RiverPlan shape={s} x={X} y={Y} w={W} width={Wd} f={f + 300} bars={0} />
      <Profile s={s} i={i} x={X} y={Y} w={W} width={Wd} p={show} />
      <Tag x={o1[0]} y={o1[1]} dx={apex.n[0] >= 0 ? 120 : -120} dy={apex.n[1] >= 0 ? 110 : -110} text="外侧：水急" f={f} at={cue(1) + 40} color={L.accent} />
      <Tag x={o2[0]} y={o2[1]} dx={apex.n[0] >= 0 ? -120 : 120} dy={apex.n[1] >= 0 ? -110 : 110} text="内侧：水缓" f={f} at={cue(1) + 52} />
    </>
  );
};
