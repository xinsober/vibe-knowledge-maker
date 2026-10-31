// 剧本：一个场景一段，字幕一句一行。画面时长按字数自动算，改一句话后面全部顺延。
// 每句字幕都是"画面在演什么"的一句话总结；画面不看字幕也要能看懂。
import {SceneSpec} from '../engine/timeline';

export const SCRIPT: SceneSpec[] = [
  {
    id: 'Dive',
    chapter: '这段黄河',
    src: '影像：Copernicus Sentinel-2；长度由高程数据估算',
    lines: [
      {t: '河，为什么不走直线？', hold: 30},
      {t: '这段黄河，两头相距约 20 公里', hold: 10},
      {t: '河道却绕了【约 40 公里】', hold: 140},
    ],
    sfx: [
      {at: 0, kind: 'shimmer', gain: 0.8},
      {at: 'L1', kind: 'tick'},
      {at: 'L2', kind: 'count', len: 80},
      {at: 'L2+80', kind: 'chime'},
      {at: 'L2+92', kind: 'whoosh'},
      {at: 'L2+142', kind: 'shimmer', gain: 0.7},
    ],
  },
  {
    id: 'Straight',
    chapter: '一点点弯',
    lines: ['假如一条河是直的', {t: '水在中间最快，贴着岸最慢', hold: 30}],
    sfx: [{at: 'L1', kind: 'pop', gain: 0.6}],
  },
  {
    id: 'Fling',
    xf: 30,
    lines: ['只要有一点点弯', {t: '最快的水就被甩到【外侧】', hold: 40}],
    sfx: [{at: 'L1+40', kind: 'pop', gain: 0.6}],
  },
  {
    id: 'Section',
    chapter: '岸在挪',
    lines: [{t: '外侧的岸，被一点点掏空', hold: 30}, {t: '掏下来的沙，堆到【内侧】', hold: 50}],
    sfx: [{at: 30, kind: 'thud', gain: 0.5}, {at: 78, kind: 'thud', gain: 0.4}],
  },
  {
    id: 'Grow',
    chapter: '越拐越大',
    lines: [
      {t: '外侧退，内侧长，弯越拐越大', hold: 50},
      {t: '直到弯的两头碰在一起，河抄了近路', hold: 20},
      {t: '甩下的那道弯，成了【月牙湖】', hold: 50},
    ],
    sfx: [
      {at: 'L1-30', kind: 'riser', len: 30},
      {at: 'L1+16', kind: 'drop'},
      {at: 'L1+16', kind: 'hush', len: 40},
      {at: 'L2+6', kind: 'chime'},
    ],
  },
  {
    id: 'Window',
    chapter: '你也认得出',
    lines: ['下次坐飞机，往下找一条弯弯的河', {t: '陡的一边是外侧，有沙滩的是内侧', hold: 100}],
    tail: 40,
    sfx: [{at: 'L1+6', kind: 'pop', gain: 0.5}, {at: 'L1+30', kind: 'pop', gain: 0.5}],
  },
];
