// 人：比例接近真人（约 5.7 个头高，头稍大一点显得亲切），有体积和明暗，
// 表情按眉、眼、嘴分别画，读得出是高兴、惊讶、担心、难过、生气还是在想。
// 姿势用两段手臂的角度描述，换姿势时角度会平滑过渡；会眨眼、会呼吸、能走路；能转过去（背影：排队、看远处、走开）。
// 坐标：(x, y) 是两脚中间落地的点，h 是身高像素。
import React from 'react';
import {useLook} from '../engine/look';
import {clamp, ease, hash, lerp, mixHex, noise} from '../engine/motion';

export type Mood = 'neutral' | 'happy' | 'laugh' | 'surprised' | 'worried' | 'sad' | 'angry' | 'thinking' | 'calm';
export type Pose = 'down' | 'wave' | 'point' | 'raise' | 'hips' | 'think' | 'shrug' | 'hold' | 'cross' | 'reach';
export type Hair = 'short' | 'side' | 'long' | 'bob' | 'bun' | 'curly' | 'none';
export type Facing = 'front' | 'left' | 'right' | 'back';

export const SKIN = ['#F2C9A8', '#E3B08A', '#C98F6A', '#9C6B4A', '#6E4A33'];
export const CLOTH = ['#C8553D', '#3E6E8E', '#5E8C61', '#D9A441', '#7A5C99', '#2F3A4A', '#B9B2A6', '#D46A8A'];
export const HAIR = ['#2A211C', '#4A3326', '#7A5534', '#B88A52', '#D8D2C8', '#1C1C24'];

// 每个姿势：[左上臂, 左前臂, 右上臂, 右前臂] 的角度（度，0 = 竖直向下，正 = 向身体外侧抬），
// 后两个数是左右上臂的长度比例：手臂朝向镜头时上臂会"变短"（透视），手才够得到下巴、胸前
const POSES: Record<Pose, [number, number, number, number, number?, number?]> = {
  down: [10, 6, 10, 6],
  wave: [8, 4, 150, 30],
  point: [8, 4, 82, 4],
  raise: [155, 15, 155, 15],
  hips: [38, -95, 38, -95],
  think: [10, 6, 22, -158, 1, 0.5],
  shrug: [28, 70, 28, 70],
  hold: [14, -112, 14, -112, 0.75, 0.75],
  cross: [12, -122, 12, -122, 0.85, 0.85],
  reach: [8, 4, 120, 10],
};

type Props = {
  x: number;
  y: number;
  h?: number;
  f: number; // 场景帧号（眨眼、呼吸、走路都靠它）
  mood?: Mood;
  pose?: Pose;
  from?: Pose; // 从哪个姿势过渡来
  poseT?: number; // 过渡进度 0–1
  facing?: Facing;
  walk?: number; // 走路的相位（每 1.0 走一步）；不走就不传
  skin?: string;
  hair?: Hair;
  hairColor?: string;
  top?: string;
  bottom?: string;
  seed?: number; // 让一群人的眨眼和呼吸错开
  look?: number; // 眼睛往哪看：-1 左 … 1 右
  dim?: number; // 压暗（背景人物、虚化的远处）0–1
  hold?: React.ReactNode; // 手里拿的东西（画在右手位置，坐标原点是右手）
};

const rad = (d: number) => (d * Math.PI) / 180;

export const Figure: React.FC<Props> = (p) => {
  const L = useLook();
  const {x, y, h = 420, f, mood = 'neutral', pose = 'down', facing = 'front', seed = 1} = p;
  const skin = p.skin ?? SKIN[1];
  const hairC = p.hairColor ?? HAIR[0];
  const top = p.top ?? CLOTH[0];
  const bottom = p.bottom ?? '#3A3F4B';
  const hairStyle = p.hair ?? 'short';
  const k = h / 1000;
  const side = facing === 'left' ? -1 : facing === 'right' ? 1 : 0;
  const isBack = facing === 'back';

  // 姿势插值
  const A = POSES[p.from ?? pose];
  const B = POSES[pose];
  const t = ease.inOut3(clamp(p.poseT ?? 1));
  const ang = [0, 1, 2, 3, 4, 5].map((i) => lerp(A[i] ?? 1, B[i] ?? 1, t));
  // 走路：腿前后摆、手反向摆、身体上下起伏
  const wp = p.walk !== undefined ? Math.sin(p.walk * Math.PI) : 0;
  const walking = p.walk !== undefined;
  const bob = walking ? -Math.abs(Math.cos(p.walk! * Math.PI)) * 14 : 0;
  // 招手
  const waveSwing = pose === 'wave' ? Math.sin(f * 0.35 + seed) * 18 * t : 0;
  // 呼吸
  const breath = noise(f * 0.03 + seed * 3, 7) * 0.5 + Math.sin(f * 0.1 + seed) * 0.5;

  // 眨眼：每 2.5–4.5 秒一次，持续 5 帧
  const period = 75 + Math.floor(hash(seed) * 60);
  const ph = (f + Math.floor(hash(seed + 1) * period)) % period;
  const blink = ph < 5 ? Math.sin((ph / 5) * Math.PI) : 0;

  const shade = (c: string, a: number) => mixHex(c, L.light ? '#2A2018' : '#0A0806', a);
  const light = (c: string, a: number) => mixHex(c, '#FFFFFF', a);

  // 关节位置（身体坐标，脚底 = 0，向上为负）
  const hipY = -470 + bob;
  const shY = -742 + bob + breath * 3;
  const shX = 118;
  const headY = -880 + bob + breath * 2;
  const limb = (x0: number, y0: number, a1: number, l1: number, a2: number, l2: number, dir: number) => {
    const x1 = x0 + Math.sin(rad(a1)) * l1 * dir;
    const y1 = y0 + Math.cos(rad(a1)) * l1;
    const x2 = x1 + Math.sin(rad(a1 + a2)) * l2 * dir;
    const y2 = y1 + Math.cos(rad(a1 + a2)) * l2;
    return [x1, y1, x2, y2];
  };
  // 手臂：dir -1 是画面左边那只
  const armL = limb(-shX + 2, shY + 22, ang[0] - wp * 22, 190 * ang[4], ang[1], 168, -1);
  const armR = limb(shX - 2, shY + 22, ang[2] + wp * 22 + waveSwing, 190 * ang[5], ang[3] + waveSwing * 0.6, 168, 1);
  // 腿
  const legL = limb(-52, hipY + 10, -wp * 24, 236, wp > 0 ? wp * 18 : 0, 232, 1);
  const legR = limb(52, hipY + 10, wp * 24, 236, wp < 0 ? -wp * 18 : 0, 232, 1);

  const Limb = ({x0, y0, j, w1, w2, c1, c2, end}: {x0: number; y0: number; j: number[]; w1: number; w2: number; c1: string; c2: string; end?: React.ReactNode}) => (
    <g>
      <path d={`M${x0},${y0} L${j[0]},${j[1]}`} stroke={c1} strokeWidth={w1} strokeLinecap="round" />
      <path d={`M${j[0]},${j[1]} L${j[2]},${j[3]}`} stroke={c2} strokeWidth={w2} strokeLinecap="round" />
      <path d={`M${x0 - w1 * 0.18},${y0} L${j[0] - w1 * 0.18},${j[1]}`} stroke={light(c1, 0.18)} strokeWidth={w1 * 0.22} strokeLinecap="round" opacity={0.35} />
      {end}
    </g>
  );

  const hand = (j: number[]) => <circle cx={j[2]} cy={j[3]} r={31} fill={skin} />;
  const shoe = (j: number[], s: number) => (
    <path d={`M${j[2] - 26 + s * 6},${j[3] - 8} q${s * 30 + 20},-14 ${s * 22 + 52},4 q4,14 -6,18 l${-(s * 22 + 70)},0 q-8,-10 2,-22 z`} fill={shade(bottom, 0.55)} />
  );

  // —— 脸 ——
  const fx = side * 22; // 侧向时五官往那边挪
  const eyeGap = side ? 26 : 31;
  const M = {
    neutral: {brow: 0, browIn: 0, eye: 1, mouth: 'flat'},
    calm: {brow: 0, browIn: 0, eye: 0.55, mouth: 'smile'},
    happy: {brow: 4, browIn: 0, eye: 0.75, mouth: 'smile'},
    laugh: {brow: 6, browIn: 0, eye: 0.3, mouth: 'open'},
    surprised: {brow: 16, browIn: 0, eye: 1.35, mouth: 'o'},
    worried: {brow: 6, browIn: 12, eye: 1.05, mouth: 'wavy'},
    sad: {brow: 2, browIn: 14, eye: 0.85, mouth: 'frown'},
    angry: {brow: -4, browIn: -14, eye: 0.7, mouth: 'tight'},
    thinking: {brow: 6, browIn: -4, eye: 0.9, mouth: 'side'},
  }[mood];
  const eyeOpen = M.eye * (1 - blink * 0.92);
  const lookX = (p.look ?? side * 0.6) * 5;
  const lookY = mood === 'thinking' ? -5 : mood === 'sad' ? 4 : 0;
  const eyeY = headY + 6;
  const browY = headY - 26 - M.brow;
  const mouthY = headY + 46;
  const mx = fx * 1.1;
  const mouth = (() => {
    const c = shade(skin, 0.62);
    switch (M.mouth) {
      case 'smile':
        return <path d={`M${mx - 20},${mouthY - 3} Q${mx},${mouthY + 14} ${mx + 20},${mouthY - 3}`} stroke={c} strokeWidth={5.5} fill="none" strokeLinecap="round" />;
      case 'open':
        return <path d={`M${mx - 24},${mouthY - 6} Q${mx},${mouthY - 2} ${mx + 24},${mouthY - 6} Q${mx + 18},${mouthY + 24} ${mx},${mouthY + 26} Q${mx - 18},${mouthY + 24} ${mx - 24},${mouthY - 6} Z`} fill={shade(skin, 0.7)} />;
      case 'o':
        return <ellipse cx={mx} cy={mouthY + 6} rx={9} ry={13} fill={shade(skin, 0.7)} />;
      case 'frown':
        return <path d={`M${mx - 18},${mouthY + 8} Q${mx},${mouthY - 6} ${mx + 18},${mouthY + 8}`} stroke={c} strokeWidth={5.5} fill="none" strokeLinecap="round" />;
      case 'wavy':
        return <path d={`M${mx - 18},${mouthY + 4} q9,-7 18,0 q9,7 18,0`} stroke={c} strokeWidth={5} fill="none" strokeLinecap="round" />;
      case 'tight':
        return <path d={`M${mx - 17},${mouthY + 5} L${mx + 17},${mouthY + 2}`} stroke={c} strokeWidth={6} strokeLinecap="round" />;
      case 'side':
        return <path d={`M${mx - 6},${mouthY + 2} Q${mx + 8},${mouthY + 6} ${mx + 18},${mouthY - 2}`} stroke={c} strokeWidth={5} fill="none" strokeLinecap="round" />;
      default:
        return <path d={`M${mx - 15},${mouthY + 2} Q${mx},${mouthY + 6} ${mx + 15},${mouthY + 2}`} stroke={c} strokeWidth={5} fill="none" strokeLinecap="round" />;
    }
  })();
  const eye = (ex: number, s: number) => {
    const ry = 15 * eyeOpen;
    const rx = 11 * (side ? (s === side ? 1 : 0.8) : 1);
    if (mood === 'laugh' && blink < 0.5)
      return <path d={`M${ex - 12},${eyeY + 3} Q${ex},${eyeY - 12} ${ex + 12},${eyeY + 3}`} stroke="#2A2220" strokeWidth={5.5} fill="none" strokeLinecap="round" />;
    return (
      <g>
        <ellipse cx={ex + lookX * 0.3} cy={eyeY + lookY * 0.3} rx={rx} ry={Math.max(1.8, ry)} fill="#2A2220" />
        {ry > 6 && <circle cx={ex + lookX * 0.3 + 3.5} cy={eyeY - ry * 0.35 + lookY * 0.3} r={3.2} fill="#FFFFFF" opacity={0.9} />}
        {mood === 'happy' && <path d={`M${ex - 13},${eyeY + 9} Q${ex},${eyeY + 2} ${ex + 13},${eyeY + 9}`} stroke={skin} strokeWidth={8} fill="none" />}
      </g>
    );
  };
  const brow = (bx: number, s: number) => {
    // s = -1 左眉，1 右眉；browIn > 0 眉头往上（担心、难过），< 0 眉头往下（生气）
    const inner = bx - s * 14;
    const outer = bx + s * 14;
    const tilt = mood === 'thinking' && s === 1 ? 8 : 0;
    return (
      <path
        d={`M${inner},${browY - M.browIn * 0.6 - tilt} Q${bx},${browY - 4 - tilt} ${outer},${browY + M.browIn * 0.3 - tilt}`}
        stroke={shade(hairC, 0.1)}
        strokeWidth={7}
        fill="none"
        strokeLinecap="round"
      />
    );
  };

  // —— 头发（后面一层 + 前面一层）——
  const hb = headY;
  const back = (() => {
    if (hairStyle === 'long') return <path d={`M-92,${hb - 20} Q-110,${hb + 160} -78,${hb + 230} L78,${hb + 230} Q110,${hb + 160} 92,${hb - 20} Z`} fill={shade(hairC, 0.15)} />;
    if (hairStyle === 'bob') return <path d={`M-96,${hb - 10} Q-104,${hb + 80} -80,${hb + 98} L80,${hb + 98} Q104,${hb + 80} 96,${hb - 10} Z`} fill={shade(hairC, 0.15)} />;
    if (hairStyle === 'bun') return <circle cx={-side * 30} cy={hb - 108} r={42} fill={hairC} />;
    return null;
  })();
  const front = (() => {
    if (hairStyle === 'none') return null;
    if (hairStyle === 'curly')
      return (
        <g fill={hairC}>
          {Array.from({length: 11}, (_, i) => {
            const a = Math.PI * (1.05 + (i / 10) * 0.9);
            return <circle key={i} cx={Math.cos(a) * 82 + fx * 0.3} cy={hb - 8 + Math.sin(a) * 84} r={30} />;
          })}
        </g>
      );
    const fringe = hairStyle === 'side' ? `Q${-20 + fx},${hb - 40} ${60 + fx},${hb - 52}` : `Q${fx},${hb - 30} ${70},${hb - 46}`;
    return (
      <path
        d={`M-88,${hb + (hairStyle === 'short' || hairStyle === 'side' ? -6 : 30)} Q-96,${hb - 96} ${fx * 0.3},${hb - 102} Q96,${hb - 96} 88,${hb + (hairStyle === 'short' || hairStyle === 'side' ? -6 : 30)} Q80,${hb - 40} 70,${hb - 46} ${fringe} Q-50,${hb - 30} -70,${hb - 36} Q-80,${hb - 20} -88,${hb - 6} Z`}
        fill={hairC}
      />
    );
  })();

  // 背影：头发盖住后脑勺，只露出一点脖子和耳朵
  const backHead = (() => {
    if (!isBack || hairStyle === 'none') return null;
    if (hairStyle === 'curly')
      return (
        <g fill={hairC}>
          {Array.from({length: 14}, (_, i) => {
            const a = (i / 14) * Math.PI * 2;
            return <circle key={i} cx={Math.cos(a) * 62} cy={hb - 4 + Math.sin(a) * 66} r={34} />;
          })}
        </g>
      );
    const low = hairStyle === 'long' ? 230 : hairStyle === 'bob' ? 98 : 58;
    return (
      <g>
        <path d={`M-90,${hb + 10} Q-98,${hb - 100} 0,${hb - 104} Q98,${hb - 100} 90,${hb + 10} Q${hairStyle === 'long' ? 104 : 84},${hb + low * 0.7} ${hairStyle === 'long' ? 78 : 56},${hb + low} L${hairStyle === 'long' ? -78 : -56},${hb + low} Q${hairStyle === 'long' ? -104 : -84},${hb + low * 0.7} -90,${hb + 10} Z`} fill={hairC} />
        {/* 头顶的一点反光 */}
        <path d={`M-46,${hb - 74} Q0,${hb - 96} 40,${hb - 78}`} stroke={light(hairC, 0.25)} strokeWidth={10} fill="none" strokeLinecap="round" opacity={0.5} />
        {hairStyle === 'bun' && <circle cx={0} cy={hb - 70} r={42} fill={hairC} />}
      </g>
    );
  })();

  const torso = `M${-shX},${shY + 4} Q${-shX - 6},${shY - 20} ${-60},${shY - 26} L60,${shY - 26} Q${shX + 6},${shY - 20} ${shX},${shY + 4} L${shX - 22},${hipY + 30} Q0,${hipY + 44} ${-shX + 22},${hipY + 30} Z`;
  const gid = `fig-${seed}-${Math.round(x)}`;
  const dim = p.dim ?? 0;

  return (
    <svg
      style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity: 1 - dim * 0.55, filter: dim ? `brightness(${1 - dim * 0.45})` : undefined}}
      width={1}
      height={1}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={light(top, 0.12)} />
          <stop offset="1" stopColor={shade(top, 0.25)} />
        </linearGradient>
        <radialGradient id={gid + 'h'} cx="0.38" cy="0.35" r="0.75">
          <stop offset="0" stopColor={light(skin, 0.12)} />
          <stop offset="1" stopColor={shade(skin, 0.12)} />
        </radialGradient>
      </defs>
      <g transform={`translate(${x},${y}) scale(${k})`}>
        {/* 脚下的影子 */}
        <ellipse cx={0} cy={4} rx={150} ry={22} fill="#000000" opacity={L.light ? 0.14 : 0.35} />
        {!isBack && back}
        {/* 腿 */}
        <Limb x0={-52} y0={hipY + 10} j={legL} w1={84} w2={74} c1={bottom} c2={bottom} end={shoe(legL, side || -1)} />
        <Limb x0={52} y0={hipY + 10} j={legR} w1={84} w2={74} c1={shade(bottom, 0.08)} c2={shade(bottom, 0.08)} end={shoe(legR, side || 1)} />
        {/* 交叉手臂时先画身体再画手 */}
        {(isBack || (pose !== 'cross' && pose !== 'hold')) && (
          <Limb x0={-shX + 2} y0={shY + 22} j={armL} w1={54} w2={46} c1={shade(top, 0.12)} c2={skin} end={hand(armL)} />
        )}
        {isBack && (pose === 'cross' || pose === 'hold') && (
          <Limb x0={shX - 2} y0={shY + 22} j={armR} w1={54} w2={46} c1={top} c2={skin} end={hand(armR)} />
        )}
        <path d={torso} fill={`url(#${gid})`} />
        {/* 肩头：让手臂从肩膀里长出来，而不是插在身体上 */}
        <circle cx={-shX + 4} cy={shY + 14} r={34} fill={shade(top, 0.06)} />
        <circle cx={shX - 4} cy={shY + 14} r={34} fill={top} />
        {/* 领口和脖子（背影只有后领一道线） */}
        {isBack ? (
          <path d={`M-40,${shY - 22} Q0,${shY - 8} 40,${shY - 22}`} stroke={shade(top, 0.3)} strokeWidth={6} fill="none" strokeLinecap="round" />
        ) : (
          <path d={`M-34,${shY - 26} Q0,${shY + 10} 34,${shY - 26}`} fill={shade(skin, 0.08)} />
        )}
        <rect x={-26} y={headY + 60} width={52} height={shY - headY - 70} fill={shade(skin, 0.1)} />
        {pose !== 'cross' && pose !== 'hold' && (
          <Limb x0={shX - 2} y0={shY + 22} j={armR} w1={54} w2={46} c1={top} c2={skin} end={hand(armR)} />
        )}
        {!isBack && (pose === 'cross' || pose === 'hold') && (
          <>
            <Limb x0={-shX + 2} y0={shY + 22} j={armL} w1={54} w2={46} c1={shade(top, 0.12)} c2={top} end={hand(armL)} />
            <Limb x0={shX - 2} y0={shY + 22} j={armR} w1={54} w2={46} c1={top} c2={top} end={hand(armR)} />
          </>
        )}
        {p.hold && !isBack ? <g transform={`translate(${(armR[2] + armL[2]) / 2},${armR[3] - 20})`}>{p.hold}</g> : null}
        {/* 头 */}
        <g transform={`rotate(${side * 3 + (mood === 'thinking' ? 5 : 0)} 0 ${headY + 60})`}>
          {side >= 0 && <ellipse cx={-80 + fx * 0.4} cy={headY + 10} rx={15} ry={22} fill={shade(skin, 0.08)} />}
          {side <= 0 && <ellipse cx={80 + fx * 0.4} cy={headY + 10} rx={15} ry={22} fill={shade(skin, 0.08)} />}
          <ellipse cx={fx * 0.25} cy={headY} rx={84 - Math.abs(side) * 6} ry={92} fill={`url(#${gid}h)`} />
          {isBack ? backHead : <>
          {/* 腮红 */}
          {(mood === 'happy' || mood === 'laugh' || mood === 'calm') && (
            <>
              <ellipse cx={fx - eyeGap - 10} cy={eyeY + 30} rx={16} ry={9} fill="#E77C7C" opacity={0.28} />
              <ellipse cx={fx + eyeGap + 10} cy={eyeY + 30} rx={16} ry={9} fill="#E77C7C" opacity={0.28} />
            </>
          )}
          {eye(fx - eyeGap, -1)}
          {eye(fx + eyeGap, 1)}
          {brow(fx - eyeGap, -1)}
          {brow(fx + eyeGap, 1)}
          {side !== 0 && <path d={`M${fx * 1.4 + side * 4},${headY + 14} q${side * 7},14 0,20`} stroke={shade(skin, 0.3)} strokeWidth={4} fill="none" strokeLinecap="round" />}
          {mouth}
          {front}
          </>}
        </g>
      </g>
    </svg>
  );
};

// 一排人：给出人数和排法，每个人的长相按 seed 自动错开
export const People: React.FC<{
  n: number;
  x: number;
  y: number;
  gap?: number;
  h?: number;
  f: number;
  mood?: Mood | ((i: number) => Mood);
  pose?: Pose | ((i: number) => Pose);
  facing?: Facing | ((i: number) => Facing);
  dim?: (i: number) => number;
  seed?: number;
}> = ({n, x, y, gap = 150, h = 300, f, mood = 'neutral', pose = 'down', facing = 'front', dim, seed = 0}) => (
  <>
    {Array.from({length: n}, (_, i) => {
      const s = seed + i * 7 + 1;
      const pick = <T,>(arr: T[], o: number) => arr[Math.floor(hash(s + o) * arr.length)];
      const hairs: Hair[] = ['short', 'side', 'long', 'bob', 'bun', 'curly', 'short'];
      return (
        <Figure
          key={i}
          x={x + i * gap}
          y={y + (hash(s + 5) - 0.5) * 10}
          h={h * (0.92 + hash(s + 4) * 0.14)}
          f={f}
          seed={s}
          mood={typeof mood === 'function' ? mood(i) : mood}
          pose={typeof pose === 'function' ? pose(i) : pose}
          facing={typeof facing === 'function' ? facing(i) : facing}
          skin={pick(SKIN.slice(0, 4), 1)}
          hair={pick(hairs, 2)}
          hairColor={pick(HAIR, 3)}
          top={pick(CLOTH, 6)}
          bottom={pick(['#3A3F4B', '#4B5A70', '#5A4A3E', '#2F3330'], 8)}
          dim={dim?.(i)}
        />
      );
    })}
  </>
);
