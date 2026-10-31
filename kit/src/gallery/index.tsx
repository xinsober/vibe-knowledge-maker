// 镜头库样片：每个组件一段几秒的演示。npm run gallery 会把它渲成样片和联系表。
// 做片时先看渲出来的图，知道每个组件在屏上长什么样，再决定用哪个。
import {SceneSpec} from '../engine/timeline';
import {SceneComponent} from '../engine/Film';
import {TerrainDemo} from './TerrainDemo';
import {FigureDemo} from './FigureDemo';
import * as D from './demos';

export const GALLERY: SceneSpec[] = [
  {id: 'TerrainDemo', chapter: '真实地形', src: '高程：AWS Terrain Tiles；影像：Copernicus Sentinel-2', lines: ['从真实的高程数据里，画出山和河', '真卫星图晕开盖上，标出要讲的那一处'], props: {drift: 0}},
  {id: 'FigureDemo', chapter: '人', lines: ['表情按眉、眼、嘴分别画，一眼读得出来', '姿势换的时候，手臂会平滑地动过去'], props: {drift: 0}},
  {id: 'GlobeDemo', chapter: '地球', lines: [{t: '只画陆地和海岸线，不画国界', hold: 50}, {t: '转到要讲的地方钉一个点，或者沿大圆画一条航线', hold: 60}], props: {drift: 0}},
  {id: 'MoleculeDemo', chapter: '分子', lines: ['真实的键长和键角，原子是有光泽的球', '拉远：一片分子越晃越厉害，颜色跟着温度变'], props: {drift: 0}},
  {id: 'HeatDemo', chapter: '热成像', lines: ['温度看不见，就涂成颜色', '热从外往里一格格传，是真的算出来的']},
  {id: 'CutawayDemo', chapter: '剖面', lines: ['把一块东西切开，一层一层看进去', '某一层可以变色、发光，说明"就是这里"']},
  {id: 'FlowDemo', chapter: '流动', lines: ['上千个亮点顺着速度场流：快的地方亮、拉长', '水绕过桥墩：两侧加快，身后变慢']},
  {id: 'CrowdDemo', chapter: '点阵', lines: ['400 个人，每人一个小人', '按比例分成三组，多少一眼看得出']},
  {id: 'ChoreoDemo', chapter: '逐步演算', lines: ['真的算一遍：8 个数，冒泡排序一步步换位', '每一步都由上一步算出来，不是摆拍']},
  {id: 'YearsDemo', chapter: '年份', lines: ['年份像里程表一样滚，时间轴跟着走', '同一年的世界人口，按真实数据插值']},
  {id: 'ScaleDemo', chapter: '大小', src: '面积：公开资料', lines: ['方块面积按真实数值算', {t: '镜头一路拉远，小的缩成一个点', hold: 90}]},
  {id: 'LogDemo', chapter: '对数尺', lines: ['从 DNA 到地球，差了十几个数量级', '一把对数尺都放得下']},
  {id: 'SourceDemo', chapter: '出处', src: 'Science, 2014', lines: ['反直觉的结论，配上真实的出处', '关键那句用荧光笔划出来']},
  {id: 'ChartDemo', chapter: '图表', lines: [{t: '掷 600 次骰子：数值变了，条会平滑换位', hold: 40}, {t: '抛 1000 次硬币，正面的比例慢慢收到一半', hold: 40}], props: {drift: 0}},
  {id: 'TreeDemo', chapter: '分叉', lines: ['抛两次硬币，枝的粗细就是概率', '"至少一次正面"的那两条路亮起来']},
  {id: 'PhotoDemo', chapter: '照片', lines: ['照片不静着：慢慢推近', '打一束光，圈出要看的地方'], props: {drift: 0}},
  {id: 'StageDemo', chapter: '展台', lines: ['主角像展品一样登场', '顶光、底座、玻璃罩、铭牌']},
];

export const GALLERY_SCENES: Record<string, SceneComponent> = {TerrainDemo, FigureDemo, ...D};
