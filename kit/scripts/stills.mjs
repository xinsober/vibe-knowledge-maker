// 渲几帧静帧并拼成一张联系表，做片过程中随时自查用。
// 用法：node scripts/stills.mjs 名字 帧号 [列数] [合成=Film] [外观]
//   帧号写法："0,45,120" 或 "0-600:60"（0 到 600 每 60 帧）
// 输出：out/stills/名字/f帧号.png，和 out/stills/名字.jpg（联系表，每格左上角标帧号和秒数）
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';
import {execFileSync} from 'child_process';
import fs from 'fs';
import path from 'path';
import {browserExecutable, chromiumOptions, cleanup, parseFrames, prepare} from './lib.mjs';

const [name = 'check', framesArg = '0', cols = '4', id = 'Film', look] = process.argv.slice(2);
const frames = parseFrames(framesArg);
const dir = path.join('out/stills', name);
fs.mkdirSync(dir, {recursive: true});
const inputProps = look ? {look} : {};
const serveUrl = await prepare();
const browser = await openBrowser('chrome', {browserExecutable, chromiumOptions});
const composition = await selectComposition({serveUrl, id, inputProps, puppeteerInstance: browser});
const files = [];
for (const frame of frames) {
  const f = Math.min(frame, composition.durationInFrames - 1);
  const out = path.join(dir, `f${String(f).padStart(5, '0')}.png`);
  await renderStill({serveUrl, composition, frame: f, output: out, inputProps, puppeteerInstance: browser});
  files.push(out);
}
await browser.close({silent: true});
cleanup(serveUrl);
execFileSync('python3', ['scripts/sheet.py', `out/stills/${name}.jpg`, cols, ...files], {stdio: 'inherit'});
