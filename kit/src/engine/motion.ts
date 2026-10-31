// 动画用的小工具。规则只有一条：画面只由帧号决定。
// 不用 Math.random()、Date.now()、CSS 动画；要随机就用 hash(种子)。

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const mix = lerp;

// 缓动。out 系列快进慢收，适合东西进场；inOut 适合镜头和位移。
export const ease = {
  linear: (t: number) => t,
  out2: (t: number) => 1 - (1 - t) ** 2,
  out3: (t: number) => 1 - (1 - t) ** 3,
  out5: (t: number) => 1 - (1 - t) ** 5,
  in2: (t: number) => t * t,
  inOut2: (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  inOut3: (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  // 轻微回弹：冲过头 6% 再回来，用在"落定"的那一下
  back: (t: number) => {
    const c = 1.4;
    return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
  },
};
export type Ease = (t: number) => number;

// f 从 a 走到 b 时，从 0 变到 1（之前是 0，之后是 1）
export const ramp = (f: number, a: number, b: number, e: Ease = ease.out3) =>
  !Number.isFinite(a) ? (f >= a ? 1 : 0) : e(clamp((f - a) / Math.max(1, b - a)));

// 进场再退场：a→b 淡入，c→d 淡出
export const inOut = (f: number, a: number, b: number, c: number, d: number) =>
  Math.min(ramp(f, a, b), 1 - ramp(f, c, d, ease.in2));

// 确定性的伪随机数，0–1
export const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
};
export const rand = (seed: number, a = 0, b = 1) => a + hash(seed) * (b - a);

// 平滑的一维噪声，用来做呼吸、漂浮、手抖，比 sin 更不机械
export const noise = (x: number, seed = 0) => {
  const i = Math.floor(x);
  const t = x - i;
  const s = t * t * (3 - 2 * t);
  return lerp(hash(i + seed * 71.3), hash(i + 1 + seed * 71.3), s) * 2 - 1;
};

// 按关键帧插值：keys = [[帧, 值], ...]，段与段之间用 e 缓动
export const keyed = (f: number, keys: [number, number][], e: Ease = ease.inOut3) => {
  if (f <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [f1, v1] = keys[i];
    const [f0, v0] = keys[i - 1];
    if (f <= f1) return lerp(v0, v1, e(clamp((f - f0) / Math.max(1, f1 - f0))));
  }
  return keys[keys.length - 1][1];
};

// 一组东西依次出现：第 i 个从 start + i*gap 开始，用 dur 帧走完
export const stagger = (f: number, i: number, start: number, gap: number, dur = 18, e: Ease = ease.out3) =>
  ramp(f, start + i * gap, start + i * gap + dur, e);

// 颜色：只接受 6 位 hex
export const hexToRgb = (hex: string) => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
export const rgba = (hex: string, a: number) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};
export const mixHex = (a: string, b: string, t: number) => {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return '#' + A.map((v, i) => Math.round(lerp(v, B[i], clamp(t))).toString(16).padStart(2, '0')).join('');
};

// 数字格式：12345.6 → "12,346"；digits 指小数位
export const fmt = (v: number, digits = 0) =>
  v.toLocaleString('en-US', {minimumFractionDigits: digits, maximumFractionDigits: digits});
