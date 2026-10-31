import React from 'react';
import {camAt, World} from '../engine/Camera';
import {useScene} from '../engine/Film';
import {Tag} from '../pieces/Draw';
import {Satellite} from '../pieces/Satellite';
import {Terrain} from '../pieces/Terrain';

// 真实地形：从高空俯冲到一处河湾，河网依次流出来；再让同一块地方的真卫星图晕开盖上，标出要讲的地方
export const TerrainDemo: React.FC = () => {
  const {f, cue} = useScene();
  const cam = camAt(f, [
    [0, {x: 1200, y: 1037, z: 0.82}],
    [cue(1), {x: 1230, y: 1000, z: 1.0}],
    [cue(1) + 90, {x: 1260, y: 960, z: 1.3}],
  ]);
  return (
    <World cam={cam}>
      <Terrain name="bends" rivers={Math.min(1, f / 70)} riverMin={0.0005} flow={f} />
      <Satellite name="bends" reveal={Math.min(1, Math.max(0, (f - cue(1) + 10) / 50))} from={[110.43, 36.71]}>
        {() => <Tag x={1320} y={760} dx={170} dy={-90} text="绕了一大圈" sub="河道比直线长一倍" f={f} at={cue(1) + 30} />}
      </Satellite>
    </World>
  );
};
