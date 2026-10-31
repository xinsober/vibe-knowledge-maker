// 镜头库样片：把每个组件的演示各截两帧，拼成一张联系表 out/gallery/<外观>.jpg。
// 做片前先看一眼，知道每个组件在屏上长什么样、四种外观各是什么味道。
// 用法：node scripts/gallery.mjs [外观=ink|night|lab|paper|all] [--video]
//   --video  另外把整段样片渲成 out/gallery/<外观>.mp4
import {execFileSync} from 'child_process';
import fs from 'fs';

const arg = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'ink';
const looks = arg === 'all' ? ['ink', 'night', 'lab', 'paper'] : [arg];
const sh = (cmd, args) => execFileSync(cmd, args, {stdio: 'inherit'});

// 地形演示要用的高程数据（第一次跑时下载，几十秒）
if (!fs.existsSync('public/terrain/bends/meta.json')) sh('python3', ['scripts/terrain.py', 'bends', '110.30', '36.62', '110.56', '36.80']);
sh('node', ['scripts/cues.mjs', 'gallery']);
const tl = JSON.parse(fs.readFileSync('out/gallery-timeline.json', 'utf8'));
const frames = tl.scenes.flatMap((s) => [Math.round(s.from + s.dur * 0.45), Math.round(s.from + s.dur * 0.85)]);
fs.mkdirSync('out/gallery', {recursive: true});
for (const look of looks) {
  sh('node', ['scripts/stills.mjs', `gallery-${look}`, frames.join(','), '4', 'Gallery', look]);
  fs.copyFileSync(`out/stills/gallery-${look}.jpg`, `out/gallery/${look}.jpg`);
  if (process.argv.includes('--video')) sh('node', ['scripts/render.mjs', `out/gallery/${look}.mp4`, '--comp', 'Gallery', '--look', look]);
}
console.log(`镜头库联系表：${looks.map((l) => `out/gallery/${l}.jpg`).join('、')}`);
