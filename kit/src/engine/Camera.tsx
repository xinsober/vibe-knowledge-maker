// 镜头：把一整个"世界"画在 1920×1080 的坐标里，用镜头推、拉、摇去看它的不同地方。
// 一个场景里换说法时，优先动镜头、在同一张图上加东西，而不是换一张新图。
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {ease, Ease, keyed, noise} from './motion';

export type Cam = {x: number; y: number; z: number; r?: number};
export const HOME: Cam = {x: 960, y: 540, z: 1};

// 镜头关键帧：[[帧, {x, y, z}], ...]。段与段之间默认 inOut3（起步和停下都是缓的）
export const camAt = (f: number, keys: [number, Partial<Cam>][], e: Ease = ease.inOut3): Cam => {
  const full = keys.map(([k, c]) => [k, {...HOME, ...c}] as [number, Cam]);
  const pick = (p: keyof Cam) => keyed(f, full.map(([k, c]) => [k, (c[p] ?? 0) as number]), e);
  return {x: pick('x'), y: pick('y'), z: pick('z'), r: pick('r')};
};

// 世界：children 用世界坐标摆放。depth < 1 的层离得远，镜头动时它动得少（视差）
export const World: React.FC<{cam: Cam; depth?: number; children: React.ReactNode; style?: React.CSSProperties}> = ({
  cam,
  depth = 1,
  children,
  style,
}) => {
  const z = 1 + (cam.z - 1) * depth;
  const x = 960 + (cam.x - 960) * depth;
  const y = 540 + (cam.y - 540) * depth;
  return (
    <AbsoluteFill
      style={{
        transformOrigin: '0 0',
        transform: `translate(960px, 540px) rotate(${(cam.r ?? 0) * depth}deg) scale(${z}) translate(${-x}px, ${-y}px)`,
        ...style,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

// 极慢的推镜 + 一点手持感。Film 给每个场景都套了一层，静的图解也会"活"
export const Drift: React.FC<{dur: number; amount?: number; children: React.ReactNode}> = ({dur, amount = 0.03, children}) => {
  const f = useCurrentFrame();
  const t = Math.min(1, f / Math.max(1, dur));
  const s = 1 + amount * ease.inOut2(t);
  const dx = noise(f * 0.006, 11) * 6 * (amount / 0.03);
  const dy = noise(f * 0.006, 12) * 4 * (amount / 0.03);
  return (
    <AbsoluteFill style={{transform: `translate(${dx}px, ${dy}px) scale(${s})`, transformOrigin: '50% 46%'}}>
      {children}
    </AbsoluteFill>
  );
};
