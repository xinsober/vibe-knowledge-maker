// 把剧本（src/film/script.ts）算成时间轴，写到 out/timeline.json，并打一张表：
// 每个场景从第几帧开始、多长、每句字幕在第几帧。配乐脚本读的就是这个文件。
// 用法：node scripts/cues.mjs          正片
//       node scripts/cues.mjs gallery  镜头库样片
import {build as esb} from 'esbuild';
import fs from 'fs';
import path from 'path';

const gallery = process.argv[2] === 'gallery';
const which = gallery ? {from: './src/gallery', name: 'GALLERY'} : {from: './src/film/script', name: 'SCRIPT'};
fs.mkdirSync('out', {recursive: true});
const tmp = path.resolve('out/.timeline.mjs');
await esb({
  stdin: {
    contents: `import {build, resolveAt} from './src/engine/timeline';
import {${which.name}} from '${which.from}';
${gallery ? 'const FILM = {title: "镜头库", look: "ink"};' : "import {FILM} from './src/film/film';"}
const t = build(${which.name});
export default {
  film: FILM,
  fps: t.fps, total: t.total,
  scenes: t.scenes.map((s) => ({id: s.id, from: s.from, dur: s.dur, chapter: s.chapterNow, enter: s.enter ?? 'fade', cues: s.cues.map((c) => s.from + c)})),
  lines: t.lines.map((l) => ({text: l.text, from: l.from, dur: l.dur, scene: l.scene})),
  sfx: t.scenes.flatMap((s) => (s.sfx ?? []).map((x) => ({...x, at: s.from + resolveAt(s, x.at)}))),
};`,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: tmp,
  jsx: 'automatic',
  logLevel: 'error',
  loader: {'.css': 'empty', '.woff': 'empty', '.woff2': 'empty', '.png': 'empty', '.jpg': 'empty'},
  external: ['react', 'react-dom', 'remotion', '@remotion/*'],
});
const tl = (await import(tmp + '?' + Date.now())).default;
fs.rmSync(tmp);
const out = gallery ? 'out/gallery-timeline.json' : 'out/timeline.json';
fs.writeFileSync(out, JSON.stringify(tl, null, 1));
// 时间轴重算过，之前渲的成片就不算数了：删掉它的完成标记，免得后面等渲染时被旧标记骗过去
if (!gallery) fs.rmSync('out/film.mp4.done', {force: true});

const sec = (f) => (f / tl.fps).toFixed(1).padStart(5);
console.log(`全片 ${tl.total} 帧 = ${(tl.total / tl.fps).toFixed(1)} 秒，写到 ${out}`);
tl.scenes.forEach((s, si) => {
  console.log(`\n${s.id.padEnd(16)} 帧 ${String(s.from).padStart(5)}–${String(s.from + s.dur).padStart(5)}  (${sec(s.from)}s–${sec(s.from + s.dur)}s)  ${s.chapter}`);
  tl.lines.filter((l) => l.scene === si).forEach((l) => console.log(`   ${String(l.from).padStart(5)}  ${l.text}`));
});
