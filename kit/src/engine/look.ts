// 外观：一套颜色、字体和质感。镜头库里的组件都从这里取色取字，
// 所以整片换外观只改 film/film.ts 里的 look 一行。
// 每种颜色全片只表示一种意思：accent 给"关键的那个东西"，accent2 给"对照/反面"。
import {createContext, useContext} from 'react';

export type LookName = 'ink' | 'night' | 'lab' | 'paper';

export type Look = {
  name: LookName;
  light: boolean; // 浅底外观：阴影代替发光，颗粒用正片叠底
  bg: string; // 底色
  bg2: string; // 底上的那团光
  panel: string; // 卡片、板块
  ink: string; // 主体：字幕、线、主要的东西
  dim: string; // 次要标注
  faint: string; // 刻度、网格、远处的东西
  line: string; // 细线、分隔
  accent: string; // 强调色：关键词、主角、答案
  accent2: string; // 第二强调：对照、反面、警示
  water: string; // 水、河、海
  ramp: string[]; // 从低到高的五级色阶：地形海拔、热力、密度都用它
  font: {
    cap: string; // 字幕
    title: string; // 片名、大字
    label: string; // 画面里的标注
    num: string; // 数字
    latin: string; // 外文书名、引文
  };
  capWeight: number;
  titleWeight: number;
  grain: number; // 颗粒强度 0–1
  vignette: number; // 暗角强度 0–1
  bokeh: boolean; // 背景虚化光斑
};

const SERIF = 'Noto Serif SC';
const SANS = 'Noto Sans SC';
const KAI = 'LXGW WenKai Screen';
const MONO = 'JetBrains Mono';
const LATIN = 'Cormorant Garamond';

export const LOOKS: Record<LookName, Look> = {
  // 墨金：暖黑底、象牙白、香槟金。历史、人文、概率、经济、宇宙
  ink: {
    name: 'ink', light: false,
    bg: '#0D0C0A', bg2: '#221D15', panel: '#17140F',
    ink: '#F2EADB', dim: '#A99F8C', faint: '#5C564B', line: '#39332A',
    accent: '#E3B865', accent2: '#CF4B31', water: '#7DB4C2',
    ramp: ['#100E0A', '#2E261B', '#5E4D36', '#A88D62', '#EBD9B0'],
    font: {cap: SERIF, title: SERIF, label: SANS, num: SERIF, latin: LATIN},
    capWeight: 700, titleWeight: 900, grain: 0.55, vignette: 0.7, bokeh: true,
  },
  // 夜蓝：靛蓝夜空、月白、红线。人与人、心理、故事、算法里的"人"
  night: {
    name: 'night', light: false,
    bg: '#090D22', bg2: '#22265A', panel: '#131837',
    ink: '#EEF0FF', dim: '#A2A9D8', faint: '#4E5689', line: '#2B3164',
    accent: '#FF5C63', accent2: '#F4C66C', water: '#7FA8FF',
    ramp: ['#080B22', '#1A2058', '#363F86', '#7C83C2', '#D8DCFF'],
    font: {cap: KAI, title: KAI, label: SANS, num: SERIF, latin: LATIN},
    capWeight: 700, titleWeight: 700, grain: 0.45, vignette: 0.6, bokeh: true,
  },
  // 骨白信号：石墨底、骨白、荧光黄绿。AI、计算机、数据、工程
  lab: {
    name: 'lab', light: false,
    bg: '#0B0C0E', bg2: '#1A1E22', panel: '#14171B',
    ink: '#ECE6DA', dim: '#918C83', faint: '#4B4945', line: '#2D3033',
    accent: '#CFE05C', accent2: '#5CC6E0', water: '#5CC6E0',
    ramp: ['#0C0E10', '#1F2428', '#3B4246', '#788179', '#CDD5C5'],
    font: {cap: SANS, title: SANS, label: SANS, num: MONO, latin: MONO},
    capWeight: 900, titleWeight: 900, grain: 0.4, vignette: 0.55, bokeh: true,
  },
  // 纸本：暖纸、墨黑、朱红。身体、生活科学、东西是怎么工作的
  paper: {
    name: 'paper', light: true,
    bg: '#EFE9DC', bg2: '#FBF8F1', panel: '#E5DDCC',
    ink: '#1F1B16', dim: '#6E665A', faint: '#B3AB9B', line: '#D2C9B6',
    accent: '#D4472E', accent2: '#B5832A', water: '#3D7DB8',
    ramp: ['#BFB197', '#D3C7AE', '#E3D9C5', '#EFE8DA', '#FBF8F1'],
    font: {cap: SERIF, title: SERIF, label: SANS, num: SERIF, latin: LATIN},
    capWeight: 900, titleWeight: 900, grain: 0.35, vignette: 0.25, bokeh: false,
  },
};

export const LookCtx = createContext<Look>(LOOKS.ink);
export const useLook = () => useContext(LookCtx);

// 发光：深色外观给强调的东西一圈光；浅色外观改成一点投影
export const glow = (L: Look, color: string, r = 18) =>
  L.light ? `drop-shadow(0 ${r * 0.15}px ${r * 0.35}px rgba(40,30,20,0.25))` : `drop-shadow(0 0 ${r}px ${color})`;

// 温度色阶（冷 → 热），四种外观通用：讲冷热、加热、体温、气候时用它，不要拿 accent / water 凑
export const HEAT = ['#2C4C8C', '#4F9BD0', '#F1E2A0', '#EE8A3C', '#C8322A'];
export const heat = (t: number) => {
  const x = Math.max(0, Math.min(1, t)) * (HEAT.length - 1);
  const i = Math.min(HEAT.length - 2, Math.floor(x));
  return mixHexLocal(HEAT[i], HEAT[i + 1], x - i);
};
const mixHexLocal = (a: string, b: string, t: number) => {
  const A = [1, 3, 5].map((k) => parseInt(a.slice(k, k + 2), 16));
  const B = [1, 3, 5].map((k) => parseInt(b.slice(k, k + 2), 16));
  return '#' + A.map((v, k) => Math.round(v + (B[k] - v) * t).toString(16).padStart(2, '0')).join('');
};

// 画面里的字号底线（1080p 下）。小于这些，手机上就看不清
export const SIZE = {cap: 64, key: 44, label: 34, min: 28};
