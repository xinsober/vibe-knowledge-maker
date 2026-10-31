// 镜头库样片里其余组件的演示。每段都是一个能直接照着改的小场景。
import React from 'react';
import {useScene} from '../engine/Film';
import {SIZE, useLook} from '../engine/look';
import {clamp, ease, hash, keyed, lerp, ramp, rgba} from '../engine/motion';
import {Choreo, layout, Step} from '../pieces/Choreo';
import {Crowd} from '../pieces/Crowd';
import {Cutaway} from '../pieces/Cutaway';
import {Big, Tag} from '../pieces/Draw';
import {fields, Flow} from '../pieces/Flow';
import {Globe, Pin, Route} from '../pieces/Globe';
import {Bars, Plot} from '../pieces/Chart';
import {LogLine, SizeUp} from '../pieces/Scale';
import {Source} from '../pieces/Source';
import {Stage} from '../pieces/Stage';
import {Tree} from '../pieces/Tree';
import {Photo} from '../pieces/Photo';
import {Odometer, TimeRibbon, Year} from '../pieces/Years';
import {AtomDefs, Molecule} from '../pieces/Molecule';
import {conduct, HeatField, sampleGrid} from '../pieces/Heat';
import {ContactShadow, Gloss, Mat} from '../pieces/Material';
import {heat} from '../engine/look';

// 地球：转到要讲的地方，推近，钉点；再拉远画一条航线
export const GlobeDemo: React.FC = () => {
  const {f, cue} = useScene();
  const c1 = cue(1);
  const lon = keyed(f, [[0, 20], [80, 110.4], [c1, 110.4], [c1 + 50, 60]]);
  const lat = keyed(f, [[0, 10], [80, 36.6], [c1, 36.6], [c1 + 50, 42]]);
  const z = keyed(f, [[0, 0.9], [60, 1.15], [110, 2.8], [c1, 2.8], [c1 + 50, 1.1]]);
  return (
    <Globe lon={lon} lat={lat} z={z} f={f}>
      {(g) => (
        <>
          <Pin g={g} lon={110.42} lat={36.66} label="黄河" f={f} at={90} out={c1} />
          <Pin g={g} lon={116.4} lat={39.9} label="北京" f={f} at={c1 + 40} />
          <Route g={g} from={[116.4, 39.9]} to={[2.35, 48.86]} p={ramp(f, c1 + 50, c1 + 110, ease.inOut2)} />
          <Pin g={g} lon={2.35} lat={48.86} label="巴黎" f={f} at={c1 + 108} side="left" />
        </>
      )}
    </Globe>
  );
};

// 剖面：一块地切开，含水层里的水慢慢亮起来
export const CutawayDemo: React.FC = () => {
  const L = useLook();
  const {f, cue} = useScene();
  const water = ramp(f, cue(1), cue(1) + 40);
  return (
    <Cutaway
      x={420}
      y={330}
      w={820}
      d={300}
      f={f}
      layers={[
        {h: 70, color: '#5B4632', label: '表土', texture: 'grain'},
        {h: 110, color: '#B08D5B', label: '沙层', texture: 'dots'},
        {h: 120, color: lerpHex('#8C7A62', L.water, water * 0.7), label: '含水层', texture: 'waves'},
        {h: 120, color: '#5E5A55', label: '岩层', texture: 'stones'},
      ]}
      surface="#6B8F4E"
      top={
        <g>
          {[120, 260, 610].map((tx, i) => (
            <g key={i} transform={`translate(${tx + 120},${-80}) scale(${0.9 + i * 0.15})`}>
              <rect x={-5} y={-10} width={10} height={40} fill="#4A3424" />
              <circle cx={0} cy={-34} r={30} fill="#3F6B3A" />
              <circle cx={-12} cy={-44} r={18} fill="#5C8C4A" />
            </g>
          ))}
        </g>
      }
    />
  );
};
const lerpHex = (a: string, b: string, t: number) => {
  const A = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const B = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + A.map((v, i) => Math.round(lerp(v, B[i], clamp(t))).toString(16).padStart(2, '0')).join('');
};

// 流动：水绕过桥墩，两侧加快、身后变慢
export const FlowDemo: React.FC = () => {
  const L = useLook();
  const {f, cue} = useScene();
  const cx = 860;
  const cy = 420;
  const r = 110;
  return (
    <>
      <Flow id="pier" x={0} y={120} w={1920} h={840} f={f} field={fields.aroundCircle(cx, cy, r, 4)} count={300} perLine={4} trail={14}
        mask={(x, y) => (x - cx) ** 2 + (y - cy) ** 2 < r * r} color={L.water} />
      <div style={{position: 'absolute', left: cx - r, top: 120 + cy - r, width: r * 2, height: r * 2, borderRadius: '50%',
        background: `radial-gradient(circle at 35% 30%, #8E8A82, #4C4944 70%)`, boxShadow: '0 20px 50px rgba(0,0,0,0.5)'}} />
      <Tag x={cx} y={120 + cy - r - 70} dx={150} dy={-50} text="两侧最快" f={f} at={cue(1)} />
      <Tag x={cx + r + 240} y={120 + cy} dx={120} dy={110} text="身后变慢" f={f} at={cue(1) + 30} />
    </>
  );
};

// 点阵：400 个人，按比例分到三组
export const CrowdDemo: React.FC = () => {
  const L = useLook();
  const {f, cue} = useScene();
  const g = (i: number) => (hash(i * 7.7) < 0.7 ? 1 : hash(i * 7.7) < 0.9 ? 2 : 3);
  const gx = [600, 1270, 1620];
  return (
    <>
      <Crowd n={400} x={960} y={470} w={1500} size={26} f={f} unit="person" appear={40} group={g} groupAt={cue(1)}
        groups={[{x: gx[0], y: 470, w: 860}, {x: gx[1], y: 470, w: 360}, {x: gx[2], y: 470, w: 240}]}
        color={(i) => (g(i) === 1 ? undefined : g(i) === 2 ? L.accent2 : L.accent)} colorAt={cue(1)} />
      {['70%', '20%', '10%'].map((t, i) => (
        <Big key={i} x={gx[i]} y={770} f={f} at={cue(1) + 40 + i * 8} size={72} font="num" color={i === 0 ? L.ink : i === 1 ? L.accent2 : L.accent}>{t}</Big>
      ))}
    </>
  );
};

// 逐步演算：8 个数，冒泡排序真的一步步换位
const sortSteps = (vals: number[], start: number, every: number): Step[] => {
  const a = [...vals.keys()];
  const pos = layout.row(vals.length, 960, 470, 170);
  const snap = (at: number, hi: number[] = []): Step => ({
    at,
    items: Object.fromEntries(a.map((id, k) => [String(id), {...pos[k], label: String(vals[id]), hi: hi.includes(id), c: hi.includes(id) ? '#E3B865' : '#8D8676'}])),
  });
  const steps = [snap(start)];
  let t = start + every;
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < a.length - 1 - i; j++)
      if (vals[a[j]] > vals[a[j + 1]]) {
        [a[j], a[j + 1]] = [a[j + 1], a[j]];
        steps.push(snap(t, [a[j], a[j + 1]]));
        t += every;
      }
  steps.push(snap(t));
  return steps;
};
export const ChoreoDemo: React.FC = () => {
  const {f} = useScene();
  const steps = sortSteps([5, 2, 8, 1, 9, 3, 7, 4], 0, 11);
  return <Choreo f={f} steps={steps} dur={10} stagger={0} arc={70} render={(id, s) => <Chip2 {...s} />} />;
};
const Chip2: React.FC<{x: number; y: number; s: number; o: number; c: string; hi: number; label?: string}> = ({x, y, s, o, c, hi, label}) => {
  const L = useLook();
  return (
    <div style={{position: 'absolute', left: x - 64 * s, top: y - 64 * s, width: 128 * s, height: 128 * s, borderRadius: 24 * s, opacity: o,
      background: `linear-gradient(160deg, ${hi ? '#F2D08C' : '#3A352D'}, ${hi ? c : '#24211C'})`, border: `2px solid ${hi ? L.accent : L.line}`,
      boxShadow: hi ? `0 0 ${30 * hi}px ${rgba(L.accent, 0.5 * hi)}` : '0 10px 24px rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: L.font.num, fontWeight: 700, fontSize: 64 * s, color: hi > 0.5 ? L.bg : L.ink}}>
      {label}
    </div>
  );
};

// 年份：里程表一样滚，时间轴跟着走。右边是同一年的世界人口（联合国估算，亿人），按真实数据插值
const POP: [number, number][] = [[1900, 16.5], [1910, 17.5], [1920, 18.6], [1930, 20.7], [1940, 23], [1950, 25], [1960, 30.2], [1970, 37], [1980, 44.4], [1990, 53.3], [2000, 61.5], [2010, 69.9], [2020, 78.4], [2025, 82.3]];
export const YearsDemo: React.FC = () => {
  const {f, dur} = useScene();
  const yr = keyed(f, [[10, 1900], [dur - 30, 2025]], ease.inOut2);
  return (
    <>
      <Year year={yr} x={960 - 260} y={330} size={150} />
      <Odometer value={keyed(yr, POP, ease.linear)} x={1300} y={330} size={110} digits={2} decimals={1} suffix="亿人" />
      <TimeRibbon x={260} y={640} w={1400} from={1900} to={2025} now={yr} f={f} step={25}
        eras={[{from: 1900, to: 1950, label: '上半叶'}, {from: 1950, to: 2000, label: '下半叶'}, {from: 2000, to: 2025, label: '新世纪'}]}
        events={[{year: 1969, label: '登月', up: false}, {year: 1991, label: '万维网', up: false}]} />
    </>
  );
};

// 大小：真实面积的方块，镜头一路拉远
export const ScaleDemo: React.FC = () => {
  const {f, cue} = useScene();
  const now = keyed(f, [[20, 0], [cue(1), 1], [cue(1) + 60, 2], [cue(1) + 120, 3]]);
  return (
    <SizeUp f={f} now={now} items={[
      {label: '足球场', value: 7140, note: '0.7 公顷'},
      {label: '故宫', value: 720000, note: '72 万平方米'},
      {label: '澳门', value: 3.33e7, note: '约 33 平方公里'},
      {label: '上海', value: 6.34e9, note: '约 6340 平方公里'},
    ]} />
  );
};

// 对数尺：从 DNA 到地球，一把尺放下
export const LogDemo: React.FC = () => {
  const {f, dur} = useScene();
  const now = keyed(f, [[10, -9.5], [dur - 20, 7.3]], ease.inOut2);
  return (
    <LogLine from={-10} to={8} now={now} f={f} unit="米" y={520} marks={[
      {at: 2e-9, label: 'DNA 的粗细'},
      {at: 2e-6, label: '细菌'},
      {at: 7e-5, label: '头发丝'},
      {at: 1.7, label: '人'},
      {at: 8849, label: '珠穆朗玛峰'},
      {at: 1.27e7, label: '地球'},
    ]} />
  );
};

// 出处：一页论文滑进来，关键那句被划出来
export const SourceDemo: React.FC = () => {
  const {f} = useScene();
  return (
    <Source x={960} y={470} f={f} at={6} venue="Science" year="2014" title="Just think: The challenges of the disengaged mind"
      meta="弗吉尼亚大学、哈佛大学 · 第 345 卷" quote="独处 15 分钟，三分之二的男性宁愿按下按钮电自己一下" />
  );
};

// 图表：掷 600 次骰子，六个面的次数你追我赶；再看抛硬币正面比例怎么收敛到一半
const rolls = Array.from({length: 600}, (_, i) => 1 + Math.floor(hash(i * 1.618 + 3) * 6));
const flips = (() => {
  let h = 0;
  return Array.from({length: 1000}, (_, i) => {
    h += hash(i * 2.399 + 11) < 0.5 ? 1 : 0;
    return [i + 1, h / (i + 1)] as [number, number];
  });
})();
export const ChartDemo: React.FC = () => {
  const {f, cue, dur} = useScene();
  const second = f >= cue(1) - 10;
  const n = Math.round(keyed(f, [[20, 0], [cue(1) - 20, 600]], ease.inOut2));
  const counts = [1, 2, 3, 4, 5, 6].map((k) => rolls.slice(0, n).filter((r) => r === k).length);
  const o1 = 1 - ramp(f, cue(1) - 20, cue(1) - 5);
  return (
    <>
      {!second || o1 > 0 ? (
        <div style={{opacity: o1}}>
          <Bars x={360} y={170} w={1200} rowH={100} labelW={200} max={130} sort f={f}
            data={counts.map((c, i) => ({label: `${i + 1} 点`, value: c, hi: c === Math.max(...counts) && n > 0}))} />
          <Big x={1560} y={110} f={f} size={SIZE.key} font="num">{`第 ${n} 次`}</Big>
        </div>
      ) : null}
      {second ? (
        <Plot x={300} y={180} w={1320} h={560} f={f} at={cue(1) - 10} xr={[1, 1000]} yr={[0, 1]} reveal={ramp(f, cue(1) + 10, dur - 30, ease.inOut2)}
          series={[{pts: flips, area: true}]} refs={[{y: 0.5, label: '一半'}]} yTicks={[0, 0.25, 0.5, 0.75, 1]}
          yLabel={(v) => `${Math.round(v * 100)}%`} xLabel={(v) => `${Math.round(v)}`} head={(v) => `${(v * 100).toFixed(1)}%`} />
      ) : null}
    </>
  );
};

// 分叉：抛两次硬币，四种结果，"至少一次正面"那几条亮起来
export const TreeDemo: React.FC = () => {
  const {f, cue} = useScene();
  return (
    <Tree x={360} y={230} w={1100} h={500} f={f} at={6} gap={26} hi={['s', 'H', 'HH', 'HT']} hiAt={cue(1) + 10}
      root={{id: 's', label: '抛两次', children: [
        {id: 'H', label: '正', edge: '1/2', weight: 0.5, children: [
          {id: 'HH', label: '正', edge: '1/2', weight: 0.25, value: '1/4'},
          {id: 'HT', label: '反', edge: '1/2', weight: 0.25, value: '1/4'},
        ]},
        {id: 'T', label: '反', edge: '1/2', weight: 0.5, children: [
          {id: 'TH', label: '正', edge: '1/2', weight: 0.25, value: '1/4'},
          {id: 'TT', label: '反', edge: '1/2', weight: 0.25, value: '1/4'},
        ]},
      ]}} />
  );
};

// 照片：慢慢推近，打一束光圈出要看的地方（演示用的是地形阴影图，换成真照片同样用）
export const PhotoDemo: React.FC = () => {
  const {f, cue} = useScene();
  return (
    <Photo src="terrain/bends/shade.png" x={260} y={110} w={1400} h={760} print f={f} dur={300}
      from={{x: 0.5, y: 0.5, z: 1.05}} to={{x: 0.5, y: 0.47, z: 1.5}} spot={{x: 0.5, y: 0.47, r: 0.09, at: cue(1)}} credit="高程：AWS Terrain Tiles">
      {(p) => {
        const [x, y] = p(0.5, 0.47);
        return <Tag x={x} y={y - 80} dx={140} dy={-60} text="要看的这一处" f={f} at={cue(1) + 20} />;
      }}
    </Photo>
  );
};

// 展台：主角像展品一样登场
export const StageDemo: React.FC = () => {
  const L = useLook();
  const {f} = useScene();
  const flick = 0.85 + 0.15 * Math.sin(f * 0.9) * Math.sin(f * 0.37);
  const on = ramp(f, 40, 60);
  return (
    <Stage x={960} y={600} w={480} box={[300, 380]} f={f} glass label="灯泡" sub="一根细丝，烧到两千多度">
      <svg width={300} height={380} viewBox="0 0 300 380" style={{overflow: 'visible'}}>
        <defs>
          <radialGradient id="bulb-glass" cx="0.4" cy="0.35" r="0.7">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity={0.35 + 0.4 * on} />
            <stop offset="0.6" stopColor={L.accent} stopOpacity={0.12 + 0.35 * on * flick} />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity={0.08} />
          </radialGradient>
          <linearGradient id="bulb-base" x1="0" x2="1">
            <stop offset="0" stopColor="#6B5E4A" />
            <stop offset="0.45" stopColor="#D8C9A8" />
            <stop offset="1" stopColor="#5A4E3D" />
          </linearGradient>
        </defs>
        {on > 0 && <circle cx={150} cy={140} r={170} fill={rgba(L.accent, 0.22 * on * flick)} style={{filter: 'blur(30px)'}} />}
        <path d="M150,20 C70,20 40,90 40,140 C40,195 95,220 105,265 L195,265 C205,220 260,195 260,140 C260,90 230,20 150,20 Z" fill="url(#bulb-glass)" stroke={rgba('#FFFFFF', 0.5)} strokeWidth={2} />
        <path d="M128,265 L136,170 M172,265 L164,170" stroke="#9A8F80" strokeWidth={3} />
        <path d="M136,170 q7,-14 14,0 t14,0" fill="none" stroke={on > 0 ? '#FFF2C4' : '#5A5048'} strokeWidth={4} style={on > 0 ? {filter: `drop-shadow(0 0 ${10 * on}px #FFD27A)`} : undefined} />
        {[0, 1, 2, 3].map((k) => <rect key={k} x={105} y={268 + k * 22} width={90} height={18} rx={6} fill="url(#bulb-base)" />)}
        <path d="M120,356 L180,356 L165,378 L135,378 Z" fill="#3A3128" />
      </svg>
    </Stage>
  );
};

// 分子：一颗水分子跟着来回翻转的电场掉头；再拉远，一大片分子越晃越厉害，颜色跟着温度变
export const MoleculeDemo: React.FC = () => {
  const L = useLook();
  const {f, cue} = useScene();
  const flip = Math.sin(f * 0.18);
  const wide = ramp(f, cue(1) - 10, cue(1) + 20, ease.inOut2);
  const hot = ramp(f, cue(1) + 10, cue(1) + 120, ease.inOut2);
  return (
    <svg style={{position: 'absolute', left: 0, top: 0}} width={1920} height={1080}>
      <AtomDefs />
      {wide < 1 && (
        <g opacity={1 - wide}>
          {[-1, 1].map((k) => (
            <g key={k} opacity={0.35 + 0.65 * Math.abs(flip)}>
              <line x1={960 + k * 480} y1={300} x2={960 + k * 480} y2={760} stroke={L.accent2} strokeWidth={6} />
              <path d={flip > 0 ? 'M-14,0 L0,30 L14,0 Z' : 'M-14,0 L0,-30 L14,0 Z'} transform={`translate(${960 + k * 480},${flip > 0 ? 740 : 320})`} fill={L.accent2} />
            </g>
          ))}
          <Molecule kind="H2O" x={960} y={530} size={150} rot={flip > 0 ? 0 : 180} spin={0} charges defs={false} />
        </g>
      )}
      {wide > 0 &&
        Array.from({length: 105}, (_, i) => {
          const gx = 200 + (i % 15) * 108 + (Math.floor(i / 15) % 2) * 54;
          const gy = 150 + Math.floor(i / 15) * 100;
          const j = 4 + hot * 26;
          const t = f * (0.08 + hot * 0.25) + i;
          return (
            <g key={i} opacity={wide} style={hot > 0.3 ? {filter: `drop-shadow(0 0 ${6 * hot}px ${heat(0.4 + hot * 0.6)})`} : undefined}>
              <Molecule kind="H2O" x={gx + Math.sin(t * 1.3) * j} y={gy + Math.cos(t * 0.9) * j} size={30} rot={Math.sin(t) * (20 + hot * 160)} defs={false} />
            </g>
          );
        })}
    </svg>
  );
};

// 热成像 + 质感：一碗饭从外往里热（热传导真的算一遍），碗是瓷的，有高光和影子
const BOWL = {x: 560, y: 330, w: 800, h: 380};
let bowlHeat: Float32Array[] | null = null;
const bowlInside = (i: number, j: number) => {
  // 半圆形的碗：网格 80×38
  const u = (i + 0.5) / 80 - 0.5;
  const v = (j + 0.5) / 38;
  return v > 0.02 && u * u * 4 + v * v < 1;
};
export const HeatDemo: React.FC = () => {
  const L = useLook();
  const {f, cue} = useScene();
  if (!bowlHeat) bowlHeat = [0, 20, 60, 140, 260].map((n) => conduct(80, 38, n, (i, j) => bowlInside(i, j) && !(bowlInside(i - 3, j) && bowlInside(i + 3, j) && bowlInside(i, j + 3) && j > 2), bowlInside));
  const p = ramp(f, 10, cue(1) + 60, ease.inOut2) * (bowlHeat.length - 1);
  const a = Math.floor(Math.min(p, bowlHeat.length - 2));
  const T = bowlHeat[a].map((t, k) => lerp(t, bowlHeat![a + 1][k], p - a));
  return (
    <>
      <svg style={{position: 'absolute', left: 0, top: 0}} width={1920} height={1080}>
        <defs>
          <Mat id="hd-bowl" kind="ceramic" color="#E9E4DA" />
        </defs>
        <ContactShadow id="hd-shadow" x={960} y={BOWL.y + BOWL.h + 40} w={900} />
        <path d={`M${BOWL.x - 30},${BOWL.y} L${BOWL.x + BOWL.w + 30},${BOWL.y} Q${BOWL.x + BOWL.w + 10},${BOWL.y + BOWL.h + 30} 960,${BOWL.y + BOWL.h + 34} Q${BOWL.x - 10},${BOWL.y + BOWL.h + 30} ${BOWL.x - 30},${BOWL.y} Z`} fill="url(#hd-bowl)" />
        <Gloss x={BOWL.x + 10} y={BOWL.y + 30} w={120} h={180} o={0.6} />
      </svg>
      <HeatField x={BOWL.x} y={BOWL.y} w={BOWL.w} h={BOWL.h} res={8} legend={['冷', '烫']} frame
        field={sampleGrid(T, 80, 38, bowlInside)} clip={`M0,0 A${BOWL.w / 2},${BOWL.h} 0 0 0 ${BOWL.w},0 Z`} />
      <Tag x={960} y={BOWL.y + 120} dx={-360} dy={-150} text="中间：还是凉的" f={f} at={cue(1) + 10} color={heat(0.1)} />
      <Tag x={BOWL.x + BOWL.w - 60} y={BOWL.y + 40} dx={150} dy={-110} text="外圈：烫" f={f} at={cue(0) + 40} color={heat(0.95)} />
    </>
  );
};
