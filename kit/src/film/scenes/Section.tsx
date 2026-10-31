// 把弯道横着切开看：水在弯里打着旋（表层往外侧冲、底下往内侧回），
// 外侧的岸被掏空、一块块掉下来；掉下来的沙顺着河底滚到内侧，堆成沙滩。整条河就这样往外侧挪。
import React from 'react';
import {useScene} from '../../engine/Film';
import {glow, SIZE, useLook} from '../../engine/look';
import {clamp, ease, hash, lerp, mixHex, ramp, rgba} from '../../engine/motion';
import {Tag} from '../../pieces/Draw';

const WATER = 430; // 水面高度
const SHIFT = 80; // 这一场里河往外侧挪多少像素

// 河底：内侧缓坡 → 最深处靠外侧（三次贝塞尔）
const bed = (sx: number, bx: number) => ({p0: [sx, WATER], c1: [sx + 300, WATER + 40], c2: [bx - 360, 790], p3: [bx - 120, 790]});
const bez = (b: ReturnType<typeof bed>, t: number): [number, number] => {
  const u = 1 - t;
  return [0, 1].map((k) => u * u * u * b.p0[k] + 3 * u * u * t * b.c1[k] + 3 * u * t * t * b.c2[k] + t * t * t * b.p3[k]) as [number, number];
};

export const Section: React.FC = () => {
  const L = useLook();
  const {f, cue, dur} = useScene();
  const m = ramp(f, 10, dur - 10, ease.inOut2);
  const Bx = 1390 + SHIFT * m; // 外侧陡岸
  const Sx = 520 + SHIFT * m; // 内侧水边
  const b = bed(Sx, Bx);
  const b0 = bed(520, 1390);
  const bedD = (q: ReturnType<typeof bed>) => `C${q.c1.join(',')} ${q.c2.join(',')} ${q.p3.join(',')}`;
  const cliff = `L${Bx - 30},782 Q${Bx + 34},752 ${Bx + 26},688 L${Bx},600 L${Bx},300`;
  const ground = `M0,340 L${Sx - 280},340 Q${Sx - 120},350 ${Sx},${WATER} ${bedD(b)} ${cliff} L1920,300 L1920,1080 L0,1080 Z`;
  const water = `M${Sx},${WATER} ${bedD(b)} L${Bx - 30},782 Q${Bx + 34},752 ${Bx + 26},688 L${Bx},600 L${Bx},${WATER} Z`;
  // 新堆的沙：原来的坡和现在的坡之间
  const wedge = `M${520},${WATER} ${bedD(b0)} L${b.p3[0]},${b.p3[1]} C${b.c2.join(',')} ${b.c1.join(',')} ${Sx},${WATER} Z`;

  // 打旋的水
  const cx = Bx - 360;
  const cy = 610;
  const loop = (a: number): [number, number] => [cx + Math.cos(a) * 270, cy + Math.sin(a) * 110];
  const swirl = ramp(f, 4, 30);

  // 沙粒：从陡岸上剥下来 → 沉到最深处 → 沿河底滚到内侧的坡上停住
  const grains = Array.from({length: 46}, (_, g) => {
    const t0 = 16 + g * 4.2;
    const t = f - t0;
    if (t < 0) return null;
    const y0 = 470 + hash(g * 3.1) * 260;
    const target = 0.12 + hash(g * 7.7) * 0.55;
    let p: [number, number];
    if (t < 16) {
      const k = ease.in2(t / 16);
      p = [lerp(Bx + 6, Bx - 60, k), lerp(y0, 778, k)];
    } else {
      const k = ease.inOut2(clamp((t - 16) / 44));
      p = bez(b, lerp(0.97, target, k));
      p[1] -= 7;
    }
    return {p, r: 4 + hash(g) * 4, o: ramp(t, 0, 6)};
  });
  // 偶尔整块塌下来
  const chunks = [30, 78, 126, 170].map((t0, i) => {
    const t = f - t0;
    if (t < 0 || t > 40) return null;
    const k = ease.in2(clamp(t / 22));
    return {x: Bx + 10 - k * 40, y: lerp(320 + i * 30, 760, k), r: k * 220 * (i % 2 ? 1 : -1), o: 1 - ramp(t, 26, 40)};
  });

  const soil = [
    {y: 290, h: 80, c: '#3B2D21'},
    {y: 370, h: 260, c: '#7E6648'},
    {y: 630, h: 280, c: '#9C8460'},
    {y: 910, h: 170, c: '#4A443D'},
  ];
  return (
    <>
      <svg style={{position: 'absolute', left: 0, top: 0}} width={1920} height={1080}>
        <defs>
          <clipPath id="sec-ground">
            <path d={ground} />
          </clipPath>
          <linearGradient id="sec-water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={mixHex(L.water, '#FFFFFF', 0.1)} stopOpacity={0.85} />
            <stop offset="1" stopColor={mixHex(L.water, L.bg, 0.6)} stopOpacity={0.95} />
          </linearGradient>
        </defs>
        {/* 土层 */}
        <g clipPath="url(#sec-ground)">
          {soil.map((s, i) => (
            <rect key={i} x={0} y={s.y} width={1920} height={s.h + 2} fill={s.c} />
          ))}
          {Array.from({length: 18}, (_, i) => (
            <line key={i} x1={0} x2={1920} y1={385 + i * 13} y2={385 + i * 13 + (i % 3) * 2} stroke="#000000" strokeWidth={1.2} opacity={0.12} />
          ))}
          {Array.from({length: 160}, (_, i) => (
            <circle key={i} cx={hash(i * 1.3) * 1920} cy={640 + hash(i * 2.7) * 260} r={2 + hash(i * 5.1) * 5} fill="#5E5040" opacity={0.5} />
          ))}
          {/* 新堆起来的沙（内侧） */}
          <path d={wedge} fill={L.ramp[4]} opacity={0.9 * ramp(m, 0.05, 0.3)} />
        </g>
        {/* 原来的岸在哪（虚线），看得出往外挪了多少 */}
        <path d={`M1390,300 L1390,600 L1416,688`} fill="none" stroke={rgba(L.ink, 0.5)} strokeWidth={3} strokeDasharray="10 8" opacity={ramp(m, 0.2, 0.4)} />
        {/* 地面上一层草 */}
        <path d={`M0,340 L${Sx - 280},340`} stroke="#5D7A3A" strokeWidth={8} />
        <path d={`M${Bx},300 L1920,300`} stroke="#5D7A3A" strokeWidth={8} />
        {/* 水 */}
        <path d={water} fill="url(#sec-water)" />
        <line x1={Sx} x2={Bx} y1={WATER} y2={WATER} stroke={rgba('#FFFFFF', 0.5)} strokeWidth={2} />
        {/* 水在弯道里打旋：表层冲向外侧，底层流回内侧 */}
        <g opacity={swirl * 0.9}>
          <ellipse cx={cx} cy={cy} rx={270} ry={110} fill="none" stroke={rgba('#FFFFFF', 0.35)} strokeWidth={3} strokeDasharray="16 14" strokeDashoffset={-f * 2.2} />
          {[0, 1, 2, 3].map((k) => {
            const a = f * 0.035 + (k * Math.PI) / 2;
            const [x1, y1] = loop(a);
            const [x2, y2] = loop(a + 0.05);
            const ang = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
            return <path key={k} d="M0,0 L-22,-12 L-16,0 L-22,12 Z" fill="#FFFFFF" transform={`translate(${x1},${y1}) rotate(${ang})`} style={{filter: glow(L, rgba('#FFFFFF', 0.6), 8)}} />;
          })}
        </g>
        {/* 塌下来的土块 */}
        {chunks.map((c, i) =>
          c ? <rect key={i} x={c.x - 18} y={c.y - 14} width={36} height={28} rx={6} fill="#7E6648" opacity={c.o} transform={`rotate(${c.r} ${c.x} ${c.y})`} /> : null,
        )}
        {/* 沙粒 */}
        {grains.map((g, i) => (g ? <circle key={i} cx={g.p[0]} cy={g.p[1]} r={g.r} fill={L.ramp[4]} opacity={g.o} style={{filter: glow(L, rgba(L.ramp[4], 0.5), 4)}} /> : null))}
      </svg>
      <div style={{position: 'absolute', left: Bx + 40, top: 210, fontFamily: L.font.label, fontWeight: 700, fontSize: SIZE.key, color: L.accent2, opacity: ramp(f, 6, 20)}}>外侧</div>
      <div style={{position: 'absolute', left: Sx - 330, top: 250, fontFamily: L.font.label, fontWeight: 700, fontSize: SIZE.key, color: L.accent, opacity: ramp(f, 6, 20)}}>内侧</div>
      <Tag x={Bx + 20} y={692} dx={100} dy={-210} text="岸被掏空" f={f} at={cue(0) + 30} color={L.accent2} />
      <Tag x={Sx + 170} y={WATER + 40} dx={-150} dy={190} text="沙堆起来" f={f} at={cue(1) + 10} color={L.accent} />
    </>
  );
};
