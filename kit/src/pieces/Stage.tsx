// 展台：把"主角"像博物馆展品一样摆出来——顶上一束光、底座、玻璃罩、铭牌。
// 一个东西第一次登场、或者要观众盯着它看的时候用。东西本身由 children 画（SVG 或 div 都行）。
import React from 'react';
import {glow, SIZE, useLook} from '../engine/look';
import {clamp, ease, mixHex, ramp, rgba} from '../engine/motion';

export const Stage: React.FC<{
  x: number; // 底座顶面中心
  y: number;
  w?: number; // 底座宽
  box?: [number, number]; // 展品占的框（宽、高），底边落在底座顶面
  f: number;
  at?: number;
  glass?: boolean; // 加玻璃罩
  label?: string; // 铭牌
  sub?: string;
  children: React.ReactNode;
}> = ({x, y, w = 440, box = [360, 360], f, at = 0, glass = false, label, sub, children}) => {
  const L = useLook();
  const light = ramp(f, at, at + 20, ease.out2);
  const rise = ramp(f, at + 8, at + 34, ease.out3);
  const pH = 230; // 底座正面高
  const pD = 50; // 顶面看上去的厚度
  const [bw, bh] = box;
  const base = L.light ? mixHex(L.panel, '#FFFFFF', 0.3) : mixHex(L.panel, L.ink, 0.08);
  // 玻璃上的反光：一道斜光慢慢扫过
  const sheen = ((f - at) % 240) / 240;
  return (
    <div style={{position: 'absolute', left: 0, top: 0}}>
      {/* 顶上打下来的光 */}
      <div style={{
        position: 'absolute', left: x - w * 0.9, top: -40, width: w * 1.8, height: y + pD + 40,
        background: `linear-gradient(180deg, ${rgba(L.ink, 0)} 0%, ${rgba(L.light ? '#FFFFFF' : L.ink, L.light ? 0.5 : 0.08)} 100%)`,
        clipPath: `polygon(38% 0, 62% 0, 100% 100%, 0 100%)`, opacity: light, filter: 'blur(6px)',
      }} />
      {/* 地上的光斑 */}
      <div style={{position: 'absolute', left: x - w * 1.1, top: y + pH - 30, width: w * 2.2, height: 140, borderRadius: '50%',
        background: `radial-gradient(ellipse, ${rgba(L.light ? '#FFFFFF' : L.ink, L.light ? 0.6 : 0.12)}, ${rgba(L.ink, 0)} 70%)`, opacity: light}} />
      {/* 底座 */}
      <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity: light}} width={1} height={1}>
        <defs>
          <linearGradient id="stage-front" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={mixHex(base, '#FFFFFF', L.light ? 0.1 : 0.06)} />
            <stop offset="1" stopColor={mixHex(base, '#000000', 0.45)} />
          </linearGradient>
          <radialGradient id="stage-top" cx="0.5" cy="0.5" r="0.6">
            <stop offset="0" stopColor={mixHex(base, '#FFFFFF', L.light ? 0.4 : 0.16)} />
            <stop offset="1" stopColor={base} />
          </radialGradient>
        </defs>
        <rect x={x - w / 2} y={y + pD / 2} width={w} height={pH} fill="url(#stage-front)" />
        <ellipse cx={x} cy={y + pD / 2} rx={w / 2} ry={pD / 2} fill="url(#stage-top)" />
        <rect x={x - w / 2} y={y + pD / 2} width={w} height={pH} fill="none" stroke={rgba(L.ink, 0.06)} />
        {/* 展品的影子 */}
        <ellipse cx={x} cy={y + pD / 2} rx={bw * 0.42} ry={pD * 0.28} fill="#000000" opacity={0.35 * rise} />
      </svg>
      {/* 展品 */}
      <div style={{position: 'absolute', left: x - bw / 2, top: y + pD / 2 - bh - (1 - rise) * 40, width: bw, height: bh, opacity: rise,
        filter: L.light ? undefined : `drop-shadow(0 0 40px ${rgba(L.accent, 0.12)})`}}>
        {children}
      </div>
      {glass ? (
        <div style={{position: 'absolute', left: x - w * 0.46, top: y + pD / 2 - bh - 70, width: w * 0.92, height: bh + 70, opacity: light,
          border: `2px solid ${rgba(L.light ? L.ink : '#FFFFFF', 0.22)}`, borderBottom: 'none',
          background: `linear-gradient(115deg, ${rgba('#FFFFFF', 0)} ${sheen * 140 - 30}%, ${rgba('#FFFFFF', 0.1)} ${sheen * 140 - 20}%, ${rgba('#FFFFFF', 0)} ${sheen * 140 - 8}%), ${rgba('#FFFFFF', 0.03)}`,
          boxShadow: `inset 0 0 40px ${rgba('#FFFFFF', 0.05)}`}} />
      ) : null}
      {label ? (
        <div style={{position: 'absolute', left: x, top: y + pD + 70, transform: 'translateX(-50%)', textAlign: 'center', opacity: ramp(f, at + 24, at + 40),
          padding: '14px 34px', background: mixHex(base, '#000000', L.light ? 0.06 : 0.3), border: `1px solid ${rgba(L.accent, 0.5)}`, whiteSpace: 'nowrap'}}>
          <div style={{fontFamily: L.font.title, fontWeight: 700, fontSize: SIZE.key, color: L.ink, letterSpacing: '0.1em'}}>{label}</div>
          {sub ? <div style={{fontFamily: L.font.label, fontSize: SIZE.min, color: L.dim, marginTop: 4}}>{sub}</div> : null}
        </div>
      ) : null}
      {/* 光束里浮着的灰尘，让光"有体积" */}
      {!L.light && (
        <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity: light}} width={1} height={1}>
          {Array.from({length: 26}, (_, i) => {
            const t = ((f * 0.4 + i * 37) % 300) / 300;
            const px = x + (Math.sin(i * 12.9) * 0.5) * w * (0.3 + t * 0.9);
            const py = 40 + t * (y - 40);
            return <circle key={i} cx={px} cy={py} r={1.2 + (i % 3) * 0.7} fill={L.ink} opacity={0.35 * Math.sin(Math.PI * clamp(t))} style={{filter: glow(L, rgba(L.ink, 0.6), 4)}} />;
          })}
        </svg>
      )}
    </div>
  );
};
