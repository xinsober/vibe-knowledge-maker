// 弯越拐越大：一道弯的外侧一直往外退（红箭头），内侧沙滩一圈圈长；镜头跟着往后拉。
// 弯大到两肩碰在一起（"颈"），河直接冲过去抄了近路；甩下的那一圈两头被沙堵上，成了月牙湖。
import React from 'react';
import {useScene} from '../../engine/Film';
import {useLook} from '../../engine/look';
import {clamp, ease, keyed, lerp, ramp} from '../../engine/motion';
import {Arrow, Ring, Tag} from '../../pieces/Draw';
import {Floodplain, meander, neck, RiverPlan} from './River';

const START = 0.8; // 接着上一场：一道不大的弯
const END = 2.06; // 两肩之间只剩一条缝（scripts 里试出来的：再大河道就要交叉了）
const H = 620; // 这道弯在屏上占多高（上面留出章节名，下面留出字幕）

export const Grow: React.FC = () => {
  const L = useLook();
  const {f, cue} = useScene();
  const om = keyed(f, [[0, START], [cue(1) - 6, END]], ease.inOut2);
  const s = meander(om, 1, 400, 0, 3);
  // 镜头自动后拉：弯那一段的高度始终约 H 像素，最多 1500 像素宽
  const ys = s.pts.slice(s.a, s.b).map((p) => p[1]);
  const yr = Math.max(...ys) - Math.min(...ys);
  const w = Math.min(1500, H / yr);
  const x = 960 - w / 2;
  const y = 500 - ((Math.max(...ys) + Math.min(...ys)) / 2) * w;
  const width = lerp(70, 41, clamp((om - START) / (END - START)));
  const nk = neck(meander(END, 1, 400, 0, 3));
  const cut = ramp(f, cue(1) + 14, cue(1) + 44, ease.inOut2);
  const silt = ramp(f, cue(1) + 40, cue(2) + 50, ease.inOut2);
  const burst = Math.max(0, 1 - Math.abs(f - (cue(1) + 24)) / 16); // 冲开那一下的水花
  const S = (p: [number, number]): [number, number] => [x + p[0] * w, y + p[1] * w];
  const growing = Math.min(ramp(f, 8, 24), 1 - ramp(f, cue(1) - 24, cue(1) - 4));
  const [ni, nj] = [S(s.pts[nk.i]), S(s.pts[nk.j])];
  const lake = S(s.pts[Math.round((nk.i + nk.j) / 2)]);
  // 外侧往外退：弯顶和两肩各一支箭头，沿外侧的法线方向
  const arrows = [0.3, 0.5, 0.7].map((u) => {
    const i = s.a + Math.round((s.b - s.a) * u);
    const sg = Math.sign(s.k[i]) || 1;
    return {p: S(s.pts[i]), n: [-s.nor[i][0] * sg, -s.nor[i][1] * sg] as [number, number]};
  });
  return (
    <>
      <Floodplain seed={5} />
      <RiverPlan shape={s} x={x} y={y} w={w} width={width} f={f + 300} bars={clamp((om - 0.7) / 1.1)} cutBank={1} cut={cut} cutAt={nk} silt={silt} flow={1 - 0.5 * cut} />
      {growing > 0 &&
        arrows.map((a, k) => {
          const o = width / 2 + 16;
          return (
            <div key={k} style={{opacity: growing}}>
              <Arrow from={[a.p[0] + a.n[0] * o, a.p[1] + a.n[1] * o]} to={[a.p[0] + a.n[0] * (o + 80), a.p[1] + a.n[1] * (o + 80)]} f={f} at={10 + k * 5} dur={14} color={L.accent2} width={6} />
            </div>
          );
        })}
      {burst > 0 && (
        <div style={{position: 'absolute', left: (ni[0] + nj[0]) / 2 - 140, top: (ni[1] + nj[1]) / 2 - 140, width: 280, height: 280, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.85), rgba(255,255,255,0) 60%)', opacity: burst, transform: `scale(${0.6 + burst * 0.6})`}} />
      )}
      <Ring x={(ni[0] + nj[0]) / 2} y={(ni[1] + nj[1]) / 2} rx={95} ry={70} f={f} at={cue(1) - 4} color={L.accent} />
      <Tag x={lake[0]} y={lake[1] - width / 2} dx={230} dy={-40} text="月牙湖" f={f} at={cue(2) + 6} color={L.water} />
    </>
  );
};
