// 封面：真卫星图上发光的河道 + 一句大字问题。三个尺寸共用一份，主体和大字放在中间，裁成竖版也不丢。
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {World} from '../engine/Camera';
import {useData} from '../engine/data';
import {FontGate} from '../engine/Fonts';
import {glow, LookCtx, LOOKS} from '../engine/look';
import {rgba} from '../engine/motion';
import {Satellite} from '../pieces/Satellite';
import {TerrainMeta} from '../pieces/Terrain';
import {FILM} from './film';

type Main = {points: [number, number][]; lengthKm: number; straightKm: number};

const Art: React.FC<{w: number; h: number}> = ({w, h}) => {
  const L = LOOKS[FILM.look];
  const meta = useData<TerrainMeta>('terrain/bends/meta.json');
  const main = useData<Main>('sat/bends/main.json');
  if (!meta || !main) return null;
  const z = Math.max(w / meta.width, h / meta.height) * 1.05;
  const d = main.points.map(([u, v], i) => `${i ? 'L' : 'M'}${(u * meta.width).toFixed(0)},${(v * meta.height).toFixed(0)}`).join('');
  const big = Math.min(w, h) * 0.13;
  return (
    <AbsoluteFill style={{background: L.bg, overflow: 'hidden'}}>
      <div style={{position: 'absolute', inset: 0, transform: `translate(${(w - 1920) / 2}px, ${(h - 1080) / 2}px)`}}>
        <World cam={{x: meta.width / 2, y: meta.height / 2, z}}>
          <Satellite name="bends" dim={0.35} />
          <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={1} height={1}>
            <path d={d} fill="none" stroke={L.accent} strokeWidth={12 / z} strokeLinecap="round" strokeLinejoin="round" style={{filter: glow(L, rgba(L.accent, 0.9), 18)}} />
          </svg>
        </World>
      </div>
      <AbsoluteFill style={{background: `radial-gradient(ellipse 60% 55% at 50% 50%, ${rgba(L.bg, 0.55)}, ${rgba(L.bg, 0.15)} 70%)`}} />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', textAlign: 'center'}}>
        <div style={{fontFamily: L.font.title, fontWeight: L.titleWeight, fontSize: big, lineHeight: 1.15, color: L.ink, letterSpacing: '0.06em', textShadow: `0 4px 40px ${rgba(L.bg, 0.95)}`}}>
          河为什么
          <br />
          <span style={{color: L.accent}}>不走直线</span>
        </div>
        <div style={{marginTop: big * 0.35, fontFamily: L.font.label, fontWeight: 700, fontSize: big * 0.3, color: L.ink, textShadow: `0 2px 20px ${rgba(L.bg, 0.95)}`}}>
          直线 {main.straightKm.toFixed(0)} 公里，黄河绕了 {Math.round(main.lengthKm)} 公里
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const Cover: React.FC<{w: number; h: number}> = ({w, h}) => (
  <LookCtx.Provider value={LOOKS[FILM.look]}>
    <FontGate>
      <Art w={w} h={h} />
    </FontGate>
  </LookCtx.Provider>
);
