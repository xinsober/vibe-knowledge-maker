// 尺度：让"大多少倍"变成看得见的大小。
// SizeUp：一排方块（或圆），面积按真实数值算，镜头从小的一路拉远到大的——小的最后缩成一个点，倍数就"看见"了。
// LogLine：一条对数尺，从 10⁻⁹ 到 10²⁶ 都能放下，游标滑过去，一路标出各个东西。
import React from 'react';
import {glow, SIZE, useLook} from '../engine/look';
import {clamp, ease, fmt, lerp, mixHex, ramp, rgba} from '../engine/motion';

export type SizeItem = {
  label: string;
  value: number; // 真实数值（面积按它算）
  note?: string; // 数字那一行，例如 "1 平方公里"
  color?: string;
  shape?: 'square' | 'circle';
  draw?: (w: number) => React.ReactNode; // 想画成别的样子：给一个边长 w，在 (0,0)-(w,w) 里画（SVG）
};

// now：镜头对准第几个（可以是小数，镜头在两个之间平滑拉远）
export const SizeUp: React.FC<{items: SizeItem[]; now: number; f: number; at?: number; fill?: number; y?: number}> = ({
  items, now, f, at = 0, fill = 0.5, y = 560,
}) => {
  const L = useLook();
  const sides = items.map((it) => Math.sqrt(it.value));
  // 从左到右一个挨一个，底边对齐，间隔按自己的大小留
  const xs: number[] = [];
  let acc = 0;
  sides.forEach((s, i) => {
    acc += i === 0 ? 0 : sides[i - 1] * 0.5 + s * 0.12 + sides[i - 1] * 0.12;
    xs.push(acc + s * 0.5);
    acc += s * 0.5;
  });
  const k = clamp(now, 0, items.length - 1);
  const i0 = Math.floor(k);
  const i1 = Math.min(items.length - 1, i0 + 1);
  const t = ease.inOut3(k - i0);
  // 缩放按对数插值，镜头拉远的速度才均匀
  const zOf = (i: number) => (1080 * fill) / sides[i];
  const z = Math.exp(lerp(Math.log(zOf(i0)), Math.log(zOf(i1)), t));
  const fx = lerp(xs[i0], xs[i1], t);
  const fy = lerp(sides[i0], sides[i1], t) / 2;
  const sx = (ux: number) => 960 + (ux - fx) * z;
  const sy = (uy: number) => y + (fy - uy) * z; // uy 从地面往上量
  const grow = ramp(f, at, at + 20);
  return (
    <div style={{position: 'absolute', left: 0, top: 0}}>
      <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={1} height={1}>
        <line x1={-100} x2={2020} y1={sy(0)} y2={sy(0)} stroke={rgba(L.ink, 0.25)} strokeWidth={2} />
        {items.map((it, i) => {
          const w = sides[i] * z * grow;
          if (w < 0.6) return null;
          const x = sx(xs[i]) - w / 2;
          const yy = sy(0) - w;
          if (x > 2100 || x + w < -200) return null;
          const c = it.color ?? (i === Math.round(k) ? L.accent : mixHex(L.ink, L.bg, 0.35));
          return (
            <g key={i}>
              {it.draw ? (
                <g transform={`translate(${x},${yy})`}>{it.draw(w)}</g>
              ) : it.shape === 'circle' ? (
                <circle cx={x + w / 2} cy={yy + w / 2} r={w / 2} fill={rgba(c, 0.85)} stroke={c} strokeWidth={2} />
              ) : (
                <rect x={x} y={yy} width={w} height={w} rx={Math.min(8, w * 0.04)} fill={rgba(c, 0.85)} stroke={c} strokeWidth={2}
                  style={i === Math.round(k) && w > 20 ? {filter: glow(L, rgba(c, 0.35), 24)} : undefined} />
              )}
            </g>
          );
        })}
      </svg>
      {items.map((it, i) => {
        const w = sides[i] * z;
        const cx = sx(xs[i]);
        // 太小的标注收起来，只留最近的两个；标注写在方块上面，不和底部字幕抢位置
        const vis = clamp((w - 30) / 60) * clamp(1 - Math.abs(i - k) * 0.6) * grow;
        if (vis <= 0.02 || cx < -300 || cx > 2220) return null;
        return (
          <div key={i} style={{position: 'absolute', left: cx, top: sy(sides[i]) - 24, transform: 'translate(-50%, -100%)', textAlign: 'center', opacity: vis, whiteSpace: 'nowrap'}}>
            <div style={{fontFamily: L.font.label, fontWeight: 700, fontSize: SIZE.key, color: L.ink}}>{it.label}</div>
            {it.note ? <div style={{fontFamily: L.font.num, fontSize: SIZE.label, color: L.dim}}>{it.note}</div> : null}
          </div>
        );
      })}
    </div>
  );
};

// 对数尺：from、to 是 10 的几次方；marks 是要标的东西；now（也是指数）是游标位置
export const LogLine: React.FC<{
  from: number;
  to: number;
  now: number;
  marks: {at: number; label: string; up?: boolean}[]; // at 是真实数值
  unit?: string; // 刻度后面的单位，例如 '米'
  f: number;
  at?: number;
  y?: number;
  span?: number; // 屏幕上一次能看到几个数量级，镜头跟着游标走
}> = ({from, to, now, marks, unit = '', f, at = 0, y = 600, span = 8}) => {
  const L = useLook();
  const grow = ramp(f, at, at + 24, ease.inOut3);
  const px = 1920 / span;
  const cam = clamp(now, from + span / 2 - 0.5, to - span / 2 + 0.5);
  const X = (e: number) => 960 + (e - cam) * px;
  const ticks = [];
  for (let e = Math.ceil(from); e <= to; e++) ticks.push(e);
  const sup = (n: number) => String(n).split('').map((ch) => '⁰¹²³⁴⁵⁶⁷⁸⁹⁻'['0123456789-'.indexOf(ch)]).join('');
  const tickLabel = (e: number) => (e >= 0 && e <= 4 ? fmt(10 ** e) : `10${sup(e)}`);
  return (
    <div style={{position: 'absolute', left: 0, top: 0}}>
      <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={1} height={1}>
        <line x1={X(from)} x2={lerp(X(from), X(to), grow)} y1={y} y2={y} stroke={rgba(L.ink, 0.45)} strokeWidth={3} />
        <line x1={X(from)} x2={Math.min(X(now), lerp(X(from), X(to), grow))} y1={y} y2={y} stroke={L.accent} strokeWidth={5} style={{filter: glow(L, rgba(L.accent, 0.6), 10)}} />
        {ticks.map((e) => (
          <g key={e} opacity={grow}>
            <line x1={X(e)} x2={X(e)} y1={y - 14} y2={y + 14} stroke={rgba(L.ink, 0.6)} strokeWidth={2} />
            {[2, 3, 4, 5, 6, 7, 8, 9].map((m) => e + Math.log10(m) <= to && (
              <line key={m} x1={X(e + Math.log10(m))} x2={X(e + Math.log10(m))} y1={y - 6} y2={y + 6} stroke={rgba(L.ink, 0.3)} strokeWidth={1.5} />
            ))}
          </g>
        ))}
        {marks.map((m, i) => {
          const e = Math.log10(m.at);
          const p = ramp(now, e - 0.4, e);
          return <circle key={i} cx={X(e)} cy={y} r={8 + 6 * p} fill={p > 0.9 ? L.accent : L.ink} opacity={grow * (0.35 + 0.65 * p)} />;
        })}
        <circle cx={X(now)} cy={y} r={14} fill={L.accent} opacity={grow} style={{filter: glow(L, rgba(L.accent, 0.9), 18)}} />
      </svg>
      {ticks.map((e) => (
        <div key={e} data-qa="skip" style={{position: 'absolute', left: X(e), top: y + 26, transform: 'translateX(-50%)', fontFamily: L.font.num, fontSize: SIZE.min, color: L.dim, opacity: grow, whiteSpace: 'nowrap'}}>
          {tickLabel(e)}
          {unit && e === Math.round(cam) ? ` ${unit}` : ''}
        </div>
      ))}
      {marks.map((m, i) => {
        const e = Math.log10(m.at);
        const p = ramp(now, e - 0.4, e);
        if (p <= 0) return null;
        const up = m.up ?? i % 2 === 0;
        return (
          <div key={i} style={{position: 'absolute', left: X(e), top: up ? y - 110 : y + 90, transform: `translate(-50%, ${(1 - p) * (up ? 12 : -12)}px)`, opacity: p,
            fontFamily: L.font.label, fontWeight: 700, fontSize: SIZE.key, color: L.ink, whiteSpace: 'nowrap'}}>
            {m.label}
          </div>
        );
      })}
    </div>
  );
};
