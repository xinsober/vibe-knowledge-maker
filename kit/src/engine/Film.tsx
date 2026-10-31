// 片子的外壳：按时间轴排场景、叠化、铺质感层、出字幕和常驻版式、挂配乐。
// 场景组件只管画自己那件事，背景、字幕、章节、颗粒都在这里统一处理。
import React, {createContext, useContext} from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {Backdrop, Bokeh, Grain, Vignette} from './Atmos';
import {Drift} from './Camera';
import {Caption, CaptionBand} from './Caption';
import {FontGate} from './Fonts';
import {LookCtx, LOOKS, LookName, useLook} from './look';
import {ease, ramp} from './motion';
import {Overlay} from './Overlay';
import {QA} from './QA';
import {BuiltScene, Timeline} from './timeline';

export type FilmConfig = {
  title: string;
  look: LookName;
  credit?: string; // 右下角署名，留空不显示
  // 配乐（scripts/score.py 读）：mood = wonder 好奇宏大 / warm 温暖 / tense 悬疑 / bright 轻快 / calm 沉思
  music?: {mood?: 'wonder' | 'warm' | 'tense' | 'bright' | 'calm'; bpm?: number; drums?: boolean; seed?: number};
  light?: {x: number; y: number}; // 背景那团光的位置
};

type SceneCtxT = {sc: BuiltScene; f: number};
const SceneCtx = createContext<SceneCtxT | null>(null);

// 场景里用：f 是场景内帧号；cue(2) 是第 3 句字幕出现的帧；end(2) 是它消失的帧
export const useScene = () => {
  const ctx = useContext(SceneCtx);
  if (!ctx) throw new Error('useScene 只能在场景组件里用');
  const {sc, f} = ctx;
  return {
    f,
    dur: sc.dur,
    index: sc.index,
    props: (sc.props ?? {}) as Record<string, any>,
    cue: (i: number, off = 0) => (sc.cues[i] ?? sc.dur) + off,
    end: (i: number, off = 0) => (sc.cueEnds[i] ?? sc.dur) + off,
  };
};

export type SceneComponent = React.FC;

const Shell: React.FC<{sc: BuiltScene; next?: BuiltScene; Comp: SceneComponent}> = ({sc, next, Comp}) => {
  const f = useCurrentFrame();
  const xfIn = sc.index === 0 || sc.enter === 'cut' ? 0 : sc.enter === 'flash' ? 10 : (sc.xf ?? 20);
  const xfOut = next ? sc.from + sc.dur - next.from : 0;
  const o = Math.min(xfIn ? ramp(f, 0, xfIn, ease.inOut2) : 1, xfOut ? 1 - ramp(f, sc.dur - xfOut, sc.dur, ease.inOut2) : 1);
  const drift = (sc.props?.drift as number | undefined) ?? 0.025;
  return (
    <SceneCtx.Provider value={{sc, f}}>
      <AbsoluteFill style={{opacity: o}}>
        <Drift dur={sc.dur} amount={drift}>
          <Comp />
        </Drift>
      </AbsoluteFill>
    </SceneCtx.Provider>
  );
};

const Flash: React.FC<{at: number}> = ({at}) => {
  const L = useLook();
  const f = useCurrentFrame();
  const o = Math.max(0, 1 - Math.abs(f - at) / 7);
  return o > 0 ? <AbsoluteFill style={{background: L.light ? '#FFFFFF' : L.ink, opacity: o * 0.85}} /> : null;
};

const Captions: React.FC<{tl: Timeline}> = ({tl}) => {
  const f = useCurrentFrame();
  const bottomOn = tl.lines.some((l) => l.pos === 'bottom' && f >= l.from - 6 && f < l.from + l.dur + 6);
  return (
    <>
      <CaptionBand opacity={bottomOn ? 1 : 0.35} />
      {tl.lines.map((l, i) => (
        <Sequence key={i} from={l.from} durationInFrames={l.dur} layout="none">
          <Caption text={l.text} f={f - l.from + (l.from === 0 ? 12 : 0)} dur={l.dur + (l.from === 0 ? 12 : 0)} pos={l.pos} />
        </Sequence>
      ))}
    </>
  );
};

export const FilmShell: React.FC<{
  tl: Timeline;
  config: FilmConfig;
  scenes: Record<string, SceneComponent>;
  qa?: boolean;
  withAudio?: boolean;
  lookOverride?: LookName;
}> = ({tl, config, scenes, qa, withAudio, lookOverride}) => {
  const L = LOOKS[lookOverride ?? config.look];
  return (
    <LookCtx.Provider value={L}>
      <FontGate>
        <AbsoluteFill id="kf-root" style={{background: L.bg, overflow: 'hidden'}}>
          <Backdrop x={config.light?.x} y={config.light?.y} />
          <Bokeh />
          {tl.scenes.map((sc, i) => {
            const Comp = scenes[sc.id];
            if (!Comp) throw new Error(`场景 ${sc.id} 没有在 scenes/index.ts 里登记`);
            return (
              <Sequence key={i} from={sc.from} durationInFrames={sc.dur} name={sc.id}>
                <Shell sc={sc} next={tl.scenes[i + 1]} Comp={Comp} />
                {sc.enter === 'flash' ? <Flash at={5} /> : null}
              </Sequence>
            );
          })}
          <Vignette />
          <Grain />
          <Captions tl={tl} />
          <Overlay tl={tl} credit={config.credit} />
          {qa ? <QA /> : null}
          {withAudio ? <Audio src={staticFile('audio.wav')} /> : null}
        </AbsoluteFill>
      </FontGate>
    </LookCtx.Provider>
  );
};
