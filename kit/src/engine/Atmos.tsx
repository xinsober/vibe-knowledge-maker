// 质感层：底色和光、远处的虚化光斑、胶片颗粒、暗角。
// 平面图解"贴在屏幕上"的感觉，多半是因为少了这几层。Film 已经全片铺好，场景里不用再画背景。
import React, {useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {useLook} from './look';
import {hash, noise, rgba} from './motion';

// 底色 + 一团有方向的光。x、y 是光的中心（0–1）
export const Backdrop: React.FC<{x?: number; y?: number; spread?: number}> = ({x = 0.5, y = 0.38, spread = 70}) => {
  const L = useLook();
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse ${spread}% ${spread * 0.9}% at ${x * 100}% ${y * 100}%, ${L.bg2} 0%, ${L.bg} 100%)`,
      }}
    />
  );
};

// 远近两层虚化光斑，慢慢漂，近的那层动得多一点（视差）
export const Bokeh: React.FC<{amount?: number; seed?: number}> = ({amount = 1, seed = 3}) => {
  const L = useLook();
  const f = useCurrentFrame();
  const {width, height} = useVideoConfig();
  if (!L.bokeh || amount <= 0) return null;
  const dots = Array.from({length: 16}, (_, i) => {
    const near = i % 3 === 0;
    const r = near ? 70 + hash(i + seed) * 90 : 26 + hash(i * 3 + seed) * 40;
    const speed = near ? 0.0016 : 0.0007;
    const x = hash(i * 7 + seed) * width + noise(f * speed * 3 + i, 1) * (near ? 90 : 40) - f * (near ? 0.18 : 0.07);
    const y = hash(i * 13 + seed) * height + noise(f * speed * 3 + i, 2) * (near ? 60 : 25);
    const c = i % 4 === 0 ? L.accent : L.ink;
    const a = (near ? 0.07 : 0.1) * amount * (0.6 + 0.4 * noise(f * 0.01 + i, 5));
    return {x: ((x % width) + width) % width, y, r, c, a};
  });
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {dots.map((d, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: d.x - d.r,
            top: d.y - d.r,
            width: d.r * 2,
            height: d.r * 2,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${rgba(d.c, d.a)} 0%, ${rgba(d.c, d.a * 0.6)} 45%, ${rgba(d.c, 0)} 72%)`,
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

// 颗粒：一张程序生成的噪点图，每 2 帧换一个位置
let grainUrl = '';
const makeGrain = () => {
  if (grainUrl || typeof document === 'undefined') return grainUrl;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const img = g.createImageData(256, 256);
  for (let i = 0; i < 256 * 256; i++) {
    const v = Math.floor(hash(i * 1.618) * 255);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  grainUrl = c.toDataURL('image/png');
  return grainUrl;
};

export const Grain: React.FC<{amount?: number}> = ({amount = 1}) => {
  const L = useLook();
  const f = useCurrentFrame();
  const url = useMemo(makeGrain, []);
  const k = Math.floor(f / 2);
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url(${url})`,
        backgroundPosition: `${Math.floor(hash(k) * 256)}px ${Math.floor(hash(k + 9) * 256)}px`,
        mixBlendMode: L.light ? 'multiply' : 'overlay',
        opacity: L.grain * amount * (L.light ? 0.16 : 0.13),
        pointerEvents: 'none',
      }}
    />
  );
};

export const Vignette: React.FC = () => {
  const L = useLook();
  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        background: `radial-gradient(ellipse 75% 70% at 50% 48%, rgba(0,0,0,0) 55%, ${rgba(L.light ? '#5A4A30' : '#000000', L.vignette * (L.light ? 0.35 : 0.75))} 100%)`,
      }}
    />
  );
};
