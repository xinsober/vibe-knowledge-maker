// 自动质检：不出图，只把每隔几帧的画面在浏览器里排一遍，量屏上所有的字（规则见 src/engine/QA.tsx），
// 按场景汇总问题，写到 out/qa.txt。没有问题时退出码是 0。
// 用法：node scripts/qa.mjs [每隔几帧=6] [合成=Film]
import {openBrowser, renderFrames, selectComposition} from '@remotion/renderer';
import fs from 'fs';
import {browserExecutable, chromiumOptions, cleanup, prepare} from './lib.mjs';

const every = Number(process.argv[2] ?? 6);
const id = process.argv[3] ?? 'Film';
const tlFile = id === 'Gallery' ? 'out/gallery-timeline.json' : 'out/timeline.json';
const tl = fs.existsSync(tlFile) ? JSON.parse(fs.readFileSync(tlFile, 'utf8')) : null;
const sceneAt = (f) => {
  if (!tl) return '';
  const s = [...tl.scenes].reverse().find((x) => f >= x.from);
  return s ? s.id : '';
};

const serveUrl = await prepare();
const browser = await openBrowser('chrome', {browserExecutable, chromiumOptions});
const inputProps = {qa: true};
const composition = await selectComposition({serveUrl, id, inputProps, puppeteerInstance: browser});
const found = new Map(); // 问题 → 出现的帧
const errors = new Set(); // 浏览器里报的错
await renderFrames({
  serveUrl,
  composition,
  inputProps,
  imageFormat: 'none',
  everyNthFrame: every,
  outputDir: null,
  puppeteerInstance: browser,
  chromiumOptions,
  concurrency: 2,
  onStart: () => {},
  onFrameUpdate: () => {},
  onBrowserLog: (log) => {
    const m = log.text.match(/^KFQA (.*)$/);
    if (!m) {
      if (log.type === 'error' || log.type === 'warning') errors.add(JSON.stringify(log).slice(0, 400));
      return;
    }
    const {frame, issues} = JSON.parse(m[1]);
    for (const i of issues) {
      const key = `${sceneAt(frame)}｜${i}`;
      if (!found.has(key)) found.set(key, []);
      found.get(key).push(frame);
    }
  },
});
await browser.close({silent: true});
cleanup(serveUrl);

// 连续的帧合成一段："120–168"
const spans = (fr) => {
  fr.sort((a, b) => a - b);
  const out = [];
  let a = fr[0];
  let b = fr[0];
  for (const f of fr.slice(1)) {
    if (f - b <= every) b = f;
    else {
      out.push([a, b]);
      a = b = f;
    }
  }
  out.push([a, b]);
  return out.map(([x, y]) => (x === y ? `${x}` : `${x}–${y}`)).join(', ');
};
// 一闪而过的不报：运动中擦肩、转到画外，观众看不出来。
// 叠字要连续 3 个采样帧都在，其余问题连续 2 个
for (const [k, fr] of found) {
  const need = k.includes('｜overlap') ? 3 : 2;
  if (!fr.some((f) => Array.from({length: need}, (_, i) => f + i * every).every((g) => fr.includes(g)))) found.delete(k);
}
const lines = [...found.entries()]
  .sort((a, b) => Math.min(...a[1]) - Math.min(...b[1]))
  .map(([k, fr]) => `${k}  帧 ${spans(fr)}`);
if (errors.size) {
  console.log(`浏览器报了 ${errors.size} 种错误（片子里有代码问题，先修这些）：`);
  console.log([...errors].slice(0, 8).join('\n') + '\n');
  process.exitCode = 1;
}
fs.mkdirSync('out', {recursive: true});
fs.writeFileSync('out/qa.txt', lines.join('\n') + '\n');
if (!lines.length && !errors.size) {
  console.log(`质检通过：每 ${every} 帧查一次，没有字太小、贴边、压字幕或互相叠住。`);
} else if (lines.length) {
  console.log(`质检发现 ${lines.length} 类问题（写在 out/qa.txt）：\n` + lines.join('\n'));
  console.log('\nsmall=字太小  edge=贴边或出画  caption=压在字幕上  overlap=两段字叠在一起');
  console.log('装饰性的小字（刻度数字之类）可以加 data-qa="skip"；其余的请改掉再渲。');
  process.exitCode = 1;
}
