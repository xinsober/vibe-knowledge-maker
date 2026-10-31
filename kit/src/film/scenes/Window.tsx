// 结尾：坐在飞机靠窗的位置往下看。窗外是一条弯弯的河，云从下面飘过；镜头慢慢往窗口推。
// 指给观众看：陡的一边是外侧，有沙滩的一边是内侧——看完这条片子，你自己也认得出来。
import React from 'react';
import {useScene} from '../../engine/Film';
import {useLook} from '../../engine/look';
import {ease, hash, lerp, mixHex, ramp} from '../../engine/motion';
import {Tag} from '../../pieces/Draw';
import {bends, Floodplain, meander, RiverPlan} from './River';

const WIN = {x: 960, y: 470, w: 700, h: 800, r: 250};

export const Window: React.FC = () => {
  const L = useLook();
  const {f, dur, cue} = useScene();
  // 镜头往窗口推：机舱推得多，窗外的地面远，推得少（视差）
  const t = ease.inOut2(ramp(f, 0, dur, ease.linear));
  const zc = lerp(1, 1.16, t);
  const zo = lerp(1, 1.06, t);
  const C = (p: [number, number], z: number): [number, number] => [WIN.x + (p[0] - WIN.x) * z, WIN.y + (p[1] - WIN.y) * z];

  const s = meander(1.75, 3, 480, 0.6);
  // 地面在窗外慢慢往后退（飞机在往前飞）
  const w = 1500;
  const drift = (fr: number) => 220 - fr * 0.9;
  const y = 530;
  const width = 52;
  const S = (p: [number, number], fr = f): [number, number] => [drift(fr) + p[0] * w, y + p[1] * w];
  // 要指的那道弯：标注出现时最靠近窗口中间的那道，之后一直跟着它
  const pick = cue(1);
  const b = bends(s).reduce((a, c) => (Math.abs(S(c.at, pick)[0] - WIN.x) < Math.abs(S(a.at, pick)[0] - WIN.x) ? c : a));
  const [ax, ay] = S(b.at);
  const outer = C([ax + b.n[0] * (width / 2 + 8), ay + b.n[1] * (width / 2 + 8)], zo);
  const inner = C([ax - b.n[0] * (width / 2 + 40), ay - b.n[1] * (width / 2 + 40)], zo);
  const clouds = Array.from({length: 5}, (_, i) => ({
    x: ((hash(i * 3.3) * 2400 - f * (2.2 + hash(i) * 1.4)) % 2400 + 2400) % 2400 - 240,
    y: 140 + hash(i * 7.1) * 700,
    r: 90 + hash(i * 5.5) * 120,
  }));
  const hole = {x: WIN.x - (WIN.w / 2) * zc, y: WIN.y - (WIN.h / 2) * zc, w: WIN.w * zc, h: WIN.h * zc, r: WIN.r * zc};
  const wallHi = mixHex(L.panel, '#FFF1DC', 0.22);
  return (
    <>
      {/* 窗外 */}
      <div style={{position: 'absolute', inset: 0, transformOrigin: `${WIN.x}px ${WIN.y}px`, transform: `scale(${zo})`}}>
        <Floodplain seed={9} />
        <RiverPlan shape={s} x={drift(f)} y={y} w={w} width={width} f={f + 400} bars={1} cutBank={1} flow={0.7} />
        {clouds.map((c, i) => (
          <div key={i} style={{position: 'absolute', left: c.x - c.r, top: c.y - c.r * 0.45, width: c.r * 2, height: c.r * 0.9, borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(255,255,255,0.4), rgba(255,255,255,0) 70%)', filter: 'blur(10px)'}} />
        ))}
      </div>
      {/* 机舱壁和窗框：用遮罩挖出一个圆角窗；窗口透进来的光把周围的壁板照亮一点 */}
      <svg style={{position: 'absolute', left: 0, top: 0}} width={1920} height={1080}>
        <defs>
          <mask id="win-hole">
            <rect width={1920} height={1080} fill="#FFFFFF" />
            <rect x={hole.x} y={hole.y} width={hole.w} height={hole.h} rx={hole.r} fill="#000000" />
          </mask>
          <radialGradient id="win-wall" cx={WIN.x} cy={WIN.y} r={1200 * zc} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={wallHi} />
            <stop offset="0.45" stopColor={mixHex(L.panel, '#000000', 0.05)} />
            <stop offset="1" stopColor={mixHex(L.panel, '#000000', 0.45)} />
          </radialGradient>
          <linearGradient id="win-bezel" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={mixHex(wallHi, '#FFFFFF', 0.25)} />
            <stop offset="1" stopColor={mixHex(L.panel, '#000000', 0.2)} />
          </linearGradient>
          <linearGradient id="win-glass" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity={0.16} />
            <stop offset="0.35" stopColor="#FFFFFF" stopOpacity={0} />
            <stop offset="0.62" stopColor="#FFFFFF" stopOpacity={0} />
            <stop offset="0.7" stopColor="#FFFFFF" stopOpacity={0.07} />
            <stop offset="0.78" stopColor="#FFFFFF" stopOpacity={0} />
          </linearGradient>
        </defs>
        <rect width={1920} height={1080} fill="url(#win-wall)" mask="url(#win-hole)" />
        {/* 窗框：外圈的塑料框（有受光面），里圈是窗洞的厚度（暗） */}
        <rect x={hole.x - 46 * zc} y={hole.y - 46 * zc} width={hole.w + 92 * zc} height={hole.h + 92 * zc} rx={hole.r + 46 * zc} fill="none" stroke="url(#win-bezel)" strokeWidth={56 * zc} mask="url(#win-hole)" />
        <rect x={hole.x - 10 * zc} y={hole.y - 10 * zc} width={hole.w + 20 * zc} height={hole.h + 20 * zc} rx={hole.r + 10 * zc} fill="none" stroke="#000000" strokeWidth={22 * zc} opacity={0.5} />
        <rect x={hole.x} y={hole.y} width={hole.w} height={hole.h} rx={hole.r} fill="url(#win-glass)" />
        {/* 遮光板拉到顶，露出一截 */}
        <rect x={hole.x + 30 * zc} y={hole.y - 4 * zc} width={hole.w - 60 * zc} height={34 * zc} rx={12 * zc} fill={mixHex(wallHi, '#FFFFFF', 0.1)} opacity={0.95} />
      </svg>
      {/* 标注画在窗框上面，字可以伸到窗外 */}
      <Tag x={outer[0]} y={outer[1]} dx={b.n[0] >= 0 ? 190 : -190} dy={b.n[1] >= 0 ? 70 : -70} text="陡岸：外侧" f={f} at={cue(1) + 6} color={L.accent2} />
      <Tag x={inner[0]} y={inner[1]} dx={b.n[0] >= 0 ? -150 : 150} dy={b.n[1] >= 0 ? -110 : 110} text="沙滩：内侧" f={f} at={cue(1) + 30} color={L.accent} />
    </>
  );
};
