// 渲成片：先渲无声画面（留在 <输出>.video.mp4），再把 public/audio.wav 合进去。换配乐不用重渲画面，见 --remux。
// 用法：node scripts/render.mjs [输出=out/film.mp4] [选项]
//   --comp Gallery     渲别的合成
//   --frames 0-299     只渲一段（自查用）
//   --patch 1818-2145  只重渲这一段，拼回已经渲好的整片（整片渲完后只改了一两个场景时用，省时间；
//                      段落按场景的帧号给，npm run cues 会列出来；时间轴长度变了就要整片重渲）
//   --crf 18           画质（越小越清楚、文件越大；默认 18，上传平台用的高画质）
//   --look night       临时换外观
//   --remux            不渲画面，只把新的 audio.wav 换进已有的 <输出>.video.mp4
// 渲完会写一个 <输出>.done 文件。等它出现再去读成片（不要靠看进程在不在）。
// 同一台机器同时只渲一个片子：两个一起渲会互相抢内存，都变慢甚至崩。
import {openBrowser, renderMedia, selectComposition} from '@remotion/renderer';
import {execFileSync} from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {browserExecutable, chromiumOptions, cleanup, prepare} from './lib.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i < 0 ? d : args[i + 1];
};
const flag = (k) => args.includes(`--${k}`);
const out = args[0] && !args[0].startsWith('--') ? args[0] : 'out/film.mp4';
const id = opt('comp', 'Film');
const crf = Number(opt('crf', 18));
const look = opt('look');
const range = opt('frames');
const patch = opt('patch');
const video = path.join(path.dirname(out), path.basename(out, '.mp4') + '.video.mp4');
const done = out + '.done';
fs.mkdirSync(path.dirname(out), {recursive: true});
fs.rmSync(done, {force: true});

// 一次只渲一个
const lock = path.join(os.tmpdir(), 'vibe-knowledge-maker-render.lock');
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
for (let waited = 0; fs.existsSync(lock); waited++) {
  const pid = Number(fs.readFileSync(lock, 'utf8'));
  if (!alive(pid)) break;
  if (waited % 30 === 0) console.log(`另一个渲染（进程 ${pid}）还在跑，等它结束…`);
  await new Promise((r) => setTimeout(r, 2000));
}
fs.writeFileSync(lock, String(process.pid));
const unlock = () => fs.rmSync(lock, {force: true});
process.on('exit', unlock);
process.on('SIGINT', () => process.exit(130));

const mux = () => {
  const audio = 'public/audio.wav';
  if (id !== 'Film' || !fs.existsSync(audio)) {
    fs.copyFileSync(video, out);
    if (id === 'Film') console.log('没有 public/audio.wav，出的是无声片。先跑 npm run audio。');
    return;
  }
  // 只渲了一段时，声音从那一段的起点开始取
  const ss = range ? String(Number(range.split('-')[0]) / 30) : '0';
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', video, '-ss', ss, '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-shortest', '-movflags', '+faststart', out]);
};

if (flag('remux')) {
  if (!fs.existsSync(video)) throw new Error(`找不到 ${video}，先完整渲一遍`);
  mux();
  fs.writeFileSync(done, new Date().toISOString());
  console.log(`配乐已换：${out}`);
  process.exit(0);
}

const t0 = Date.now();
const inputProps = look ? {look} : {};
const serveUrl = await prepare();
const browser = await openBrowser('chrome', {browserExecutable, chromiumOptions});
const composition = await selectComposition({serveUrl, id, inputProps, puppeteerInstance: browser});
const frameRange = (patch ?? range)?.split('-').map(Number) ?? null;
const patchFile = path.join(path.dirname(out), path.basename(out, '.mp4') + '.patch.mp4');
if (patch) {
  if (!fs.existsSync(video)) throw new Error(`找不到 ${video}：--patch 要先有一遍完整渲好的片子`);
  const have = Number(execFileSync('ffprobe', ['-v', 'error', '-count_packets', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', video]).toString().trim());
  if (have !== composition.durationInFrames) throw new Error(`已有的片子 ${have} 帧，现在的时间轴 ${composition.durationInFrames} 帧：长度变了，整片重渲`);
}
let last = -1;
await renderMedia({
  serveUrl,
  composition,
  inputProps,
  codec: 'h264',
  crf,
  x264Preset: 'slow',
  pixelFormat: 'yuv420p',
  colorSpace: 'bt709',
  imageFormat: 'jpeg',
  jpegQuality: 95,
  muted: true,
  frameRange,
  outputLocation: patch ? patchFile : video,
  puppeteerInstance: browser,
  chromiumOptions,
  concurrency: Number(process.env.CONCURRENCY) || Math.max(1, Math.min(8, Math.floor(os.cpus().length / 2))),
  onProgress: ({progress}) => {
    const p = Math.floor(progress * 10);
    if (p !== last) {
      last = p;
      console.log(`渲染 ${p * 10}%  已用 ${Math.round((Date.now() - t0) / 1000)} 秒`);
    }
  },
});
await browser.close({silent: true});
cleanup(serveUrl);
if (patch) {
  // 把新渲的一段换进整片：前面一段 + 新的一段 + 后面一段，重新编码一遍（比重渲快得多）
  const [a, b] = frameRange;
  const total = composition.durationInFrames;
  const parts = [];
  let graph = `[0:v]split=2[h][t];`;
  if (a > 0) {
    graph += `[h]trim=end_frame=${a},setpts=PTS-STARTPTS[p0];`;
    parts.push('[p0]');
  } else graph += `[h]nullsink;`;
  graph += `[1:v]setpts=PTS-STARTPTS[p1];`;
  parts.push('[p1]');
  if (b < total - 1) {
    graph += `[t]trim=start_frame=${b + 1},setpts=PTS-STARTPTS[p2];`;
    parts.push('[p2]');
  } else graph += `[t]nullsink;`;
  graph += `${parts.join('')}concat=n=${parts.length}:v=1:a=0[v]`;
  const tmp = video.replace(/\.mp4$/, '.new.mp4');
  console.log('拼回整片…');
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', video, '-i', patchFile, '-filter_complex', graph, '-map', '[v]', '-c:v', 'libx264', '-crf', String(crf), '-preset', 'slow', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-r', '30', tmp]);
  fs.renameSync(tmp, video);
  fs.rmSync(patchFile, {force: true});
}
mux();
fs.writeFileSync(done, new Date().toISOString());
const mb = (fs.statSync(out).size / 1e6).toFixed(1);
console.log(`完成：${out}（${mb} MB，${Math.round((Date.now() - t0) / 1000)} 秒）`);
