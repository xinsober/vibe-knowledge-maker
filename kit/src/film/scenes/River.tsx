// 这部片子自己的"布景"：一条从天上往下看的河。直河、刚有点弯、越拐越大、截弯成湖，全是它。
// 河的形状用"正弦生成曲线"：流向角 θ = ω·sin(2π·波数·u)。ω 越大弯越大；一个波长、ω≈2.06 时，那道弯的两肩碰在一起。
// 画得像真的靠这几样：岸边不是数学曲线（噪声扭一下）、外侧水深颜色暗、内侧有沙滩和一道道弧、岸上有树；
// 水流亮点按真实规律跑：截面上中间快两边慢，弯道外侧快内侧慢。
// 镜头库里没有的东西，就像这样在片子里自己写一个组件，用 engine 里的工具（look、motion）画。
import React from 'react';
import {useLook} from '../../engine/look';
import {clamp, ease, hash, mixHex, rgba} from '../../engine/motion';

type P = [number, number];

export type Bend = {i: number; at: P; n: P}; // 弯顶：第几个点、位置、指向外侧的方向

// 河的中线（单位：谷长 = 1），两头各接一段直的（lead），让河从画面外流进来、流到画面外去
export const meander = (omega: number, waves = 2, n = 400, phase = 0, lead = 1.2) => {
  const raw: P[] = [[0, 0]];
  for (let k = 1; k <= n; k++) {
    const th = omega * Math.sin(2 * Math.PI * waves * ((k - 0.5) / n) + phase);
    const [x, y] = raw[k - 1];
    raw.push([x + Math.cos(th) / n, y + Math.sin(th) / n]);
  }
  // 两头的连线就是"谷"，缩放到谷长 = 1：河弯得越厉害，河道越长，谷不变
  const span = raw[n][0] - raw[0][0];
  const my = raw.reduce((s, p) => s + p[1], 0) / raw.length;
  const core = raw.map(([x, y]) => [x / span, (y - my) / span] as P);
  const ds = 1 / n / span;
  const m = Math.ceil(lead / ds);
  const t0 = omega * Math.sin(phase);
  const t1 = omega * Math.sin(2 * Math.PI * waves + phase);
  // 接头处的方向慢慢转回水平，弯着接进来，不是硬拐
  const ext = (from: P, th: number, dir: number) => {
    const out: P[] = [];
    let [px, py] = from;
    for (let q = 1; q <= m; q++) {
      const a = th * Math.exp(-(q * ds) / 0.07);
      px += dir * Math.cos(a) * ds;
      py += dir * Math.sin(a) * ds;
      out.push([px, py]);
    }
    return out;
  };
  const head = ext(core[0], t0, -1).reverse();
  const tail = ext(core[n], t1, 1);
  return {...withFrame([...head, ...core, ...tail]), a: m, b: m + n};
};

const withFrame = (pts: P[]) => {
  const tan: P[] = pts.map((_, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
  });
  // 法线 n 指向行进方向的右手边（屏幕 y 朝下）；曲率 k > 0 表示往 n 那边拐
  const nor: P[] = tan.map(([tx, ty]) => [-ty, tx]);
  const seg = pts.map((p, i) => (i ? Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0));
  const k = tan.map((t, i) => {
    const a = tan[Math.max(0, i - 2)];
    const b = tan[Math.min(tan.length - 1, i + 2)];
    const ds = seg.slice(Math.max(1, i - 1), Math.min(seg.length, i + 3)).reduce((s, v) => s + v, 0) || 1;
    return (a[0] * b[1] - a[1] * b[0]) / ds;
  });
  return {pts, tan, nor, k};
};
export type Shape = ReturnType<typeof meander>;

// 河道上相隔很远、在平面上却离得最近的两个点（"颈"）：截弯就从这里截
export const neck = (s: Shape, waves = 1) => {
  const n = s.b - s.a;
  const per = n / waves;
  let best = {i: 0, j: 0, d: Infinity};
  for (let i = s.a + Math.round(n * 0.02); i < s.a + n * 0.6; i += 2)
    for (let j = i + Math.round(per / 3); j < Math.min(s.b, i + per); j += 2) {
      const d = Math.hypot(s.pts[i][0] - s.pts[j][0], s.pts[i][1] - s.pts[j][1]);
      if (d < best.d) best = {i, j, d};
    }
  return best;
};

// 每道弯的弯顶（曲率最大处）
export const bends = (s: Shape): Bend[] => {
  const out: Bend[] = [];
  let start = s.a;
  for (let i = s.a + 1; i <= s.b; i++) {
    if (i === s.b || Math.sign(s.k[i]) !== Math.sign(s.k[start])) {
      let m = start;
      for (let j = start; j < i; j++) if (Math.abs(s.k[j]) > Math.abs(s.k[m])) m = j;
      const sg = Math.sign(s.k[m]);
      if (i - start > 10 && sg) out.push({i: m, at: s.pts[m], n: [-s.nor[m][0] * sg, -s.nor[m][1] * sg]});
      start = i;
    }
  }
  return out;
};

export const LANES = [-0.38, -0.26, -0.13, 0, 0.13, 0.26, 0.38];

// 一条"车道"的流速：o 是离中线多远（-0.5…0.5 个河宽，正的在 n 那边），kw 是无量纲曲率。
// 截面上中间快、两边慢；弯道上外侧（和拐的方向相反的那边）更快
export const speedAt = (o: number, kw: number, boost = 2.4) =>
  (1 - (o / 0.5) ** 2 * 0.8) * Math.max(0.25, 1 - boost * o * Math.max(-0.7, Math.min(0.7, kw)));

type Props = {
  shape: Shape;
  x: number; // 谷的左端（屏幕）
  y: number; // 谷的中线
  w: number; // 谷长（屏幕像素）
  width: number; // 水面宽（像素）
  f: number;
  bars?: number; // 内侧沙滩长出来的程度 0–1
  cutBank?: number; // 外侧陡岸的阴影 0–1
  cut?: number; // 截弯的进度 0–1（0 = 没截）
  cutAt?: {i: number; j: number}; // 从哪截（neck 算出来的）
  silt?: number; // 截下来的那一圈两头被沙淤上多少 0–1，剩下中间一弯就是月牙湖
  flow?: number; // 水流亮点的不透明度 0–1
  boost?: number; // 弯道外侧比内侧快多少（0 = 不区分）
  trees?: boolean;
  seed?: number;
};

const pathOf = (ps: P[]) => ps.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');

export const RiverPlan: React.FC<Props> = ({shape, x, y, w, width, f, bars = 0, cutBank = 0, cut = 0, cutAt, silt = 0, flow = 1, boost = 2.4, trees = true, seed = 1}) => {
  const L = useLook();
  const S = (p: P): P => [x + p[0] * w, y + p[1] * w];
  const {pts, nor, k} = shape;
  const N = pts.length;
  const off = (i: number, o: number): P => {
    const [px, py] = S(pts[i]);
    return [px + nor[i][0] * o, py + nor[i][1] * o];
  };
  const kw = (i: number) => k[i] * (width / w); // 无量纲曲率：越接近 1 弯越急
  const deep = mixHex(L.water, L.bg, 0.55);
  const water = mixHex(L.water, L.bg, 0.3);
  const sand = L.ramp[4];
  const wet = mixHex(sand, L.ramp[2], 0.55);
  const lake = mixHex(L.water, L.bg, 0.4); // 死水：不流了，颜色更深更沉
  const line = (a: number, b: number) => pathOf(pts.slice(a, b + 1).map(S));
  const c = clamp(cut);
  const ci = cutAt?.i ?? 0;
  const cj = cutAt?.j ?? 0;
  const cutting = !!cutAt && c > 0;
  const skip = (i: number) => cutting && i > ci && i < cj;
  // 沙滩宽度：弯得越急越宽
  const barW = (i: number) => width * 1.5 * bars * ease.inOut2(clamp((Math.abs(kw(i)) - 0.08) / 0.4));

  // 内侧沙滩（月牙形）和上面一道道弧：每次涨水退水留下一道
  const barPolys: string[] = [];
  const scrolls: string[] = [];
  if (bars > 0) {
    let run: number[] = [];
    const flush = () => {
      if (run.length > 6) {
        const sg = Math.sign(k[run[0]]);
        const outer = run.map((i) => off(i, sg * (width / 2 + barW(i))));
        const inner = run.map((i) => off(i, sg * (width / 2 - 2))).reverse();
        barPolys.push(pathOf([...outer, ...inner]) + 'Z');
        [0.3, 0.55, 0.8].forEach((r) => scrolls.push(pathOf(run.map((i) => off(i, sg * (width / 2 + barW(i) * r))))));
      }
      run = [];
    };
    for (let i = 0; i < N; i++) {
      const on = Math.abs(kw(i)) > 0.06 && !skip(i);
      if (on && run.length && Math.sign(k[i]) !== Math.sign(k[run[0]])) flush();
      if (on) run.push(i);
      else flush();
    }
    flush();
  }

  // 最深的地方（主流线）：直的时候在中间，到弯道贴着外侧走——外侧水深，颜色暗
  const thalweg = pathOf(pts.map((_, i) => off(i, -Math.sign(k[i]) * width * 0.24 * clamp(Math.abs(kw(i)) * 3))));

  // 岸上的树：沿两岸隔一段种一棵，有的地方空着；内侧种在沙滩外面
  const treeDots: {x: number; y: number; r: number}[] = [];
  if (trees) {
    const dpx = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) * w; // 相邻两点在屏上隔多远
    const step = Math.max(2, Math.round((width * 0.7) / dpx));
    for (let i = 0; i < N; i += step) {
      if (skip(i)) continue;
      for (const side of [-1, 1]) {
        if (hash(i * 3.7 + side + seed) < 0.45) continue;
        const inner = Math.sign(k[i]) === side;
        const d = width / 2 + 10 + (inner ? barW(i) : 0) + hash(i * 1.9 + side) * width * 0.5;
        const [tx, ty] = off(i, side * d);
        if (tx < -60 || tx > 1980 || ty < -60 || ty > 1140) continue;
        treeDots.push({x: tx, y: ty, r: width * (0.12 + hash(i * 5.3 + side) * 0.12)});
      }
    }
  }

  // 水流亮点：每条"车道"按速度走，走到哪由累计时间反查，只由帧号决定
  const streaks: {d: string; v: number; o: number; w: number}[] = [];
  if (flow > 0) {
    const path = cutting && c > 0.5 ? [...Array.from({length: ci + 1}, (_, i) => i), -1, ...Array.from({length: N - cj}, (_, i) => cj + i)] : Array.from({length: N}, (_, i) => i);
    const lanes = Array.from({length: 11}, (_, q) => -0.42 + (q / 10) * 0.84 + (hash(q * 9.1 + seed) - 0.5) * 0.05);
    lanes.forEach((o, li) => {
      const pos: P[] = [];
      const vel: number[] = [];
      path.forEach((i) => {
        if (i < 0) {
          // 截弯后的新河道：从颈的一头直接连到另一头
          const a = off(ci, o * width);
          const b = off(cj, o * width);
          for (let t = 0.1; t < 1; t += 0.1) {
            pos.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
            vel.push(speedAt(o, 0, 0) * 1.2);
          }
          return;
        }
        pos.push(off(i, o * width));
        vel.push(speedAt(o, kw(i), boost));
      });
      const T = [0];
      for (let m = 1; m < pos.length; m++) T.push(T[m - 1] + Math.hypot(pos[m][0] - pos[m - 1][0], pos[m][1] - pos[m - 1][1]) / (Math.max(2.2, width * 0.022) * vel[m]));
      const total = T[T.length - 1];
      const at = (t: number) => {
        let lo = 0;
        let hi = T.length - 1;
        while (hi - lo > 1) {
          const mid = (lo + hi) >> 1;
          if (T[mid] < t) lo = mid;
          else hi = mid;
        }
        return lo;
      };
      const per = Math.max(4, Math.round(total / 26));
      for (let q = 0; q < per; q++) {
        const t = (f + (q / per) * total + hash(li * 7 + q) * 60) % total;
        const trail = 8 + hash(li * 3 + q * 11) * 12;
        const h = at(t);
        const tl = at(Math.max(0, t - trail));
        if (h - tl < 1) continue;
        const seg = pos.slice(tl, h + 1);
        const [hx, hy] = seg[seg.length - 1];
        if (hx < -80 || hx > 2000 || hy < -80 || hy > 1160) continue;
        streaks.push({d: pathOf(seg), v: vel[h], o: Math.min(1, t / 20, (total - t) / 20), w: 1.2 + hash(q * 5 + li) * 1.4});
      }
    });
  }

  const warp = `rv-warp-${seed}`;
  return (
    <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={1} height={1}>
      <defs>
        {/* 岸线用噪声扭一下，不是一条完美的数学曲线 */}
        <filter id={warp} filterUnits="userSpaceOnUse" x={-300} y={-300} width={2520} height={1680}>
          <feTurbulence type="fractalNoise" baseFrequency={0.012} numOctaves={3} seed={seed} />
          <feDisplacementMap in="SourceGraphic" scale={Math.min(26, width * 0.14)} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g filter={`url(#${warp})`}>
        <path d={line(0, N - 1)} fill="none" stroke={wet} strokeWidth={width + 18} strokeLinecap="round" strokeLinejoin="round" />
        {barPolys.map((d, i) => (
          <path key={i} d={d} fill={sand} />
        ))}
        {scrolls.map((d, i) => (
          <path key={i} d={d} fill="none" stroke={wet} strokeWidth={2} opacity={0.55} />
        ))}
        <path d={line(0, N - 1)} fill="none" stroke={water} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
        {cutting && (
          <>
            {/* 被甩下的那道弯：慢慢变成湖的颜色，两头被沙堵上 */}
            <path d={line(ci, cj)} fill="none" stroke={mixHex(water, lake, c)} strokeWidth={width} strokeLinejoin="round" />
            {/* 两头慢慢被沙淤上，从颈往里长，最后只剩中间一弯 */}
            {(() => {
              const n = Math.round((cj - ci) * 0.22 * ease.out2(clamp(silt)));
              return n > 1 ? (
                <>
                  <path d={line(ci, ci + n)} fill="none" stroke={sand} strokeWidth={width + 4} strokeLinecap="round" strokeLinejoin="round" />
                  <path d={line(cj - n, cj)} fill="none" stroke={sand} strokeWidth={width + 4} strokeLinecap="round" strokeLinejoin="round" />
                </>
              ) : null;
            })()}
            <line x1={S(pts[ci])[0]} y1={S(pts[ci])[1]} x2={S(pts[cj])[0]} y2={S(pts[cj])[1]} stroke={wet} strokeWidth={(width + 18) * ease.out3(c)} strokeLinecap="round" />
            <line x1={S(pts[ci])[0]} y1={S(pts[ci])[1]} x2={S(pts[cj])[0]} y2={S(pts[cj])[1]} stroke={water} strokeWidth={width * ease.out3(c)} strokeLinecap="round" />
          </>
        )}
        <path d={thalweg} fill="none" stroke={deep} strokeWidth={width * 0.42} strokeLinecap="round" strokeLinejoin="round" opacity={0.65 * (1 - c * 0.5)} />
        {/* 外侧陡岸的影子：弯得越急越深 */}
        {cutBank > 0 &&
          pts.map((_, i) => {
            if (i === 0 || skip(i)) return null;
            const a = Math.abs(kw(i));
            if (a < 0.1) return null;
            const s = -Math.sign(k[i]);
            const p0 = off(i - 1, s * (width / 2 + 5));
            const p1 = off(i, s * (width / 2 + 5));
            return <line key={i} x1={p0[0]} y1={p0[1]} x2={p1[0]} y2={p1[1]} stroke="#000000" strokeWidth={8} strokeLinecap="round" opacity={cutBank * clamp(a * 1.4) * 0.45} />;
          })}
      </g>
      {/* 树：影子 + 树冠 + 受光面 */}
      {treeDots.map((t, i) => (
        <g key={i}>
          <ellipse cx={t.x + t.r * 0.4} cy={t.y + t.r * 0.45} rx={t.r} ry={t.r * 0.8} fill="#000000" opacity={0.3} />
          <circle cx={t.x} cy={t.y} r={t.r} fill={mixHex('#3A4628', L.ramp[1], 0.25)} />
          <circle cx={t.x - t.r * 0.28} cy={t.y - t.r * 0.3} r={t.r * 0.55} fill={mixHex('#5A6B3A', L.ramp[3], 0.2)} opacity={0.8} />
        </g>
      ))}
      <path d={line(0, N - 1)} fill="none" stroke={rgba('#FFFFFF', 0.06)} strokeWidth={width * 0.3} strokeLinecap="round" />
      {/* 水流亮点：快的偏强调色、更亮 */}
      {streaks.map((s, i) => {
        const fast = clamp((s.v - 0.9) / 0.6);
        return (
          <path key={i} d={s.d} fill="none" stroke={mixHex(mixHex(L.water, '#FFFFFF', 0.6), L.accent, fast)} strokeWidth={s.w + fast * 1.2} strokeLinecap="round"
            opacity={flow * s.o * (0.25 + 0.6 * clamp(s.v))} />
        );
      })}
    </svg>
  );
};

// 河漫滩：河两岸的平地，带一点不规则的质感（固定种子的噪声，不是随机数）
export const Floodplain: React.FC<{seed?: number}> = ({seed = 3}) => {
  const L = useLook();
  return (
    <svg style={{position: 'absolute', left: 0, top: 0}} width={1920} height={1080}>
      <defs>
        <radialGradient id="fp-g" cx="0.5" cy="0.45" r="0.75">
          <stop offset="0" stopColor={mixHex(L.ramp[2], L.ramp[3], 0.25)} />
          <stop offset="1" stopColor={L.ramp[1]} />
        </radialGradient>
        <filter id="fp-n" x="0" y="0" width="1" height="1">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves={4} seed={seed} />
          <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 -0.12" />
        </filter>
      </defs>
      <rect width={1920} height={1080} fill="url(#fp-g)" />
      <rect width={1920} height={1080} filter="url(#fp-n)" />
    </svg>
  );
};
