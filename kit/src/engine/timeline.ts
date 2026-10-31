// 时间轴：全片唯一的时间来源。画面（Film.tsx）和配乐（scripts/score.py）读的是同一份，
// 所以改一句字幕，后面的画面、字幕、音效一起顺延，音画不会错位。
// 这个文件不能引用任何 .tsx（配乐脚本要在 Node 里直接读它）。

export type CapPos = 'bottom' | 'top' | 'center' | {x: number; y: number; w?: number; align?: 'left' | 'center' | 'right'};

export type Line =
  | string
  | {
      t: string; // 字幕；【】里的字用强调色。空字符串 = 这一拍没有字幕，只看画面
      hold?: number; // 读完后多停几帧
      dur?: number; // 直接指定这句的帧数（不按字数算）
      pos?: CapPos; // 字幕放哪；默认底部居中
      src?: string; // 这句出现时右上角显示的出处
    };

export type SfxKind =
  | 'whoosh' | 'tick' | 'pop' | 'chime' | 'thud' | 'riser' | 'shimmer'
  | 'click' | 'swell' | 'drop' | 'paper' | 'count' | 'hush';

// at：场景内的帧号，或者 'L2' 表示第 3 句字幕出现的那一帧，'L2+12' 表示再往后 12 帧
export type Sfx = {at: number | string; kind: SfxKind; gain?: number; len?: number};

export type SceneSpec = {
  id: string; // 场景组件的名字，在 film/scenes/index.ts 里登记
  lines: Line[];
  chapter?: string; // 左上角章节名，换章时写，之后的场景沿用
  src?: string; // 右上角出处，整场都显示
  badge?: string; // 顶部状态条（例如 '公元前 256 年'），整场都显示
  pre?: number; // 场景开始后多久出第一句字幕（帧），默认 0
  tail?: number; // 最后一句之后画面多留几帧，默认 14
  enter?: 'fade' | 'cut' | 'flash'; // 怎么进入这个场景，默认 fade（叠化）
  xf?: number; // 叠化帧数，默认 20
  sfx?: Sfx[];
  props?: Record<string, unknown>; // 传给场景组件
};

export type BuiltLine = {text: string; from: number; dur: number; pos: CapPos; src?: string; scene: number};
export type BuiltScene = SceneSpec & {
  index: number;
  from: number; // 场景画面的起止（绝对帧）
  dur: number;
  cues: number[]; // 每句字幕在场景内的起始帧
  cueEnds: number[];
  chapterNow: string;
};

const FPS = 30;

// 一句话要读多久：约每秒 7.5 个字 + 半秒找到这句的时间，最少 1.6 秒
export const countChars = (s: string) => s.replace(/[【】\s，。、！？：；“”‘’（）《》,.!?:;"'()\-—…·]/g, '').length;
export const readFrames = (s: string) => Math.max(48, Math.round(countChars(s) * 4 + 16));

const norm = (l: Line) => (typeof l === 'string' ? {t: l} : l);

export function build(script: SceneSpec[]) {
  const scenes: BuiltScene[] = [];
  const lines: BuiltLine[] = [];
  let prevEnd = 0;
  let chapter = '';
  script.forEach((s, i) => {
    const xf = i === 0 || s.enter === 'cut' ? 0 : s.enter === 'flash' ? 10 : (s.xf ?? 20);
    const from = Math.max(0, prevEnd - xf);
    let c = from + (i === 0 ? 0 : Math.round(xf * 0.6)) + (s.pre ?? 0);
    const cues: number[] = [];
    const cueEnds: number[] = [];
    s.lines.map(norm).forEach((l) => {
      const dur = l.dur ?? (l.t ? readFrames(l.t) : 30) + (l.hold ?? 0);
      cues.push(c - from);
      cueEnds.push(c - from + dur);
      if (l.t) lines.push({text: l.t, from: c, dur, pos: l.pos ?? 'bottom', src: l.src, scene: i});
      c += dur;
    });
    const end = c + (s.tail ?? 14);
    if (s.chapter) chapter = s.chapter;
    scenes.push({...s, index: i, from, dur: end - from, cues, cueEnds, chapterNow: chapter});
    prevEnd = end;
  });
  return {scenes, lines, total: prevEnd, fps: FPS};
}

export type Timeline = ReturnType<typeof build>;

// 'L2+12' → 场景内帧号
export const resolveAt = (sc: BuiltScene, at: number | string) => {
  if (typeof at === 'number') return at;
  const m = at.match(/^L(\d+)([+-]\d+)?$/);
  if (!m) throw new Error(`看不懂的时间点：${at}`);
  return sc.cues[Number(m[1])] + Number(m[2] ?? 0);
};
