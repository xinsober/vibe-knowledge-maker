// 照片：真实的照片、档案图、卫星图。慢慢推拉（不让照片静着），可以打一束光圈出要看的地方。
// 讲真实的地方、真实的东西时，一张真照片比十张示意图有说服力。
// 只用能公开使用的图（公有领域、CC 协议），把作者和协议写进 credit；不用网上随手搜的图。
import React from 'react';
import {Img, staticFile} from 'remotion';
import {useLook} from '../engine/look';
import {clamp, ease, lerp, ramp, rgba} from '../engine/motion';

type View = {x: number; y: number; z: number}; // 看照片的哪一点（0–1，相对画框）和放大倍数（≥1）

export type PhotoApi = (nx: number, ny: number) => [number, number]; // 照片上的点（0–1）→ 此刻在屏上的位置

export const Photo: React.FC<{
  src: string; // public/ 下的路径（例如 'photos/dam.jpg'），或 http 开头的完整网址
  x?: number; // 画框
  y?: number;
  w?: number;
  h?: number;
  from?: View;
  to?: View;
  f: number;
  at?: number;
  dur?: number; // 从 from 推到 to 用多少帧
  grade?: number; // 0–1：往外观的色调上靠，让照片和整片的颜色统一
  spot?: {x: number; y: number; r: number; at: number}; // 圈出一处：外面压暗（坐标相对画框，r 是半径占画框宽的比例）
  print?: boolean; // 冲印照片的样子：白边、投影、略歪
  credit?: string; // 作者 / 协议，写在右下角
  children?: (p: PhotoApi) => React.ReactNode;
}> = ({src, x = 0, y = 0, w = 1920, h = 1080, from = {x: 0.5, y: 0.5, z: 1.08}, to = {x: 0.5, y: 0.5, z: 1.18}, f, at = 0, dur = 240, grade = 0.35, spot, print, credit, children}) => {
  const L = useLook();
  const t = ease.inOut2(clamp((f - at) / dur));
  const z = lerp(from.z, to.z, t);
  // 焦点不能让画框露出照片外面
  const fx = clamp(lerp(from.x, to.x, t), 0.5 / z, 1 - 0.5 / z);
  const fy = clamp(lerp(from.y, to.y, t), 0.5 / z, 1 - 0.5 / z);
  const p: PhotoApi = (nx, ny) => [x + w / 2 + (nx - fx) * w * z, y + h / 2 + (ny - fy) * h * z];
  const sp = spot ? ramp(f, spot.at, spot.at + 24, ease.inOut2) : 0;
  const [spx, spy] = spot ? p(spot.x, spot.y) : [0, 0];
  const show = ramp(f, at, at + 16);
  const url = src.startsWith('http') ? src : staticFile(src);
  const B = print ? 22 : 0;
  return (
    <div style={{position: 'absolute', left: 0, top: 0, opacity: show}}>
      <div
        style={{
          position: 'absolute', left: x - B, top: y - B, width: w + B * 2, height: h + B * 2 + (print ? 40 : 0),
          background: print ? '#F4F1EA' : undefined,
          boxShadow: print ? `0 30px 80px rgba(0,0,0,${L.light ? 0.25 : 0.6})` : undefined,
          transform: print ? `rotate(${-1.5 + t * 0.8}deg)` : undefined,
        }}
      >
        <div style={{position: 'absolute', left: B, top: B, width: w, height: h, overflow: 'hidden'}}>
          <div style={{position: 'absolute', left: 0, top: 0, width: w, height: h, transformOrigin: '0 0', transform: `translate(${w / 2 - fx * w * z}px, ${h / 2 - fy * h * z}px) scale(${z})`}}>
            <Img src={url} style={{width: w, height: h, objectFit: 'cover', filter: `contrast(${1 + grade * 0.12}) saturate(${1 - grade * 0.35})`}} />
            {/* 调色：往外观的中间色调上靠 */}
            <div style={{position: 'absolute', inset: 0, background: L.ramp[3], mixBlendMode: 'color', opacity: grade * 0.45}} />
            <div style={{position: 'absolute', inset: 0, background: L.bg, mixBlendMode: L.light ? 'multiply' : 'soft-light', opacity: grade * 0.5}} />
          </div>
          {spot ? (
            <div style={{position: 'absolute', inset: 0, opacity: sp,
              background: `radial-gradient(circle at ${spx - x}px ${spy - y}px, rgba(0,0,0,0) ${spot.r * w * z * 0.92}px, rgba(0,0,0,0.68) ${spot.r * w * z * 1.25}px)`}} />
          ) : null}
        </div>
        {spot ? (
          <svg style={{position: 'absolute', left: B - x, top: B - y, overflow: 'visible'}} width={1} height={1}>
            <circle cx={spx} cy={spy} r={spot.r * w * z} fill="none" stroke={rgba(L.accent, 0.9 * sp)} strokeWidth={3} strokeDasharray={`${2 * Math.PI * spot.r * w * z * sp} 99999`}
              transform={`rotate(-90 ${spx} ${spy})`} />
          </svg>
        ) : null}
      </div>
      {credit ? (
        <div data-qa="skip" style={{position: 'absolute', left: x + w - 16, top: y + h - 46, transform: 'translateX(-100%)', fontFamily: L.font.label, fontSize: 22, color: 'rgba(255,255,255,0.75)',
          textShadow: '0 1px 6px rgba(0,0,0,0.8)', whiteSpace: 'nowrap'}}>
          {credit}
        </div>
      ) : null}
      {children?.(p)}
    </div>
  );
};
