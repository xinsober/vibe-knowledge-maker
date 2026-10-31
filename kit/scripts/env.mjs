// 环境检查：第一次用之前跑一下，缺什么、怎么装都会说。
import {execFileSync} from 'child_process';
import fs from 'fs';
import os from 'os';
import {browserExecutable} from './lib.mjs';

const ok = [];
const bad = [];
const has = (cmd, args = ['-version']) => {
  try {
    return execFileSync(cmd, args, {stdio: ['ignore', 'pipe', 'pipe']}).toString();
  } catch {
    return null;
  }
};
const major = Number(process.versions.node.split('.')[0]);
(major >= 18 ? ok : bad).push(`Node ${process.versions.node}${major >= 18 ? '' : '（要 18 以上）'}`);
fs.existsSync('node_modules/remotion') ? ok.push('依赖已装') : bad.push('依赖没装：在 kit 目录里跑 npm install');
has('ffmpeg') ? ok.push('ffmpeg') : bad.push('没有 ffmpeg：macOS 用 brew install ffmpeg；Ubuntu 用 sudo apt install ffmpeg；Windows 用 winget install ffmpeg');
const py = has('python3', ['-c', 'import numpy, PIL; print(numpy.__version__)']);
py ? ok.push(`Python 和 numpy ${py.trim()}、Pillow`) : bad.push('缺 Python 3 或 numpy / Pillow：pip3 install numpy pillow');
// 卫星图才要用到，没有不影响别的
has('python3', ['-c', 'import rasterio, mgrs']) ? ok.push('rasterio、mgrs（卫星图）') : ok.push('（可选）要用卫星图时再装：pip3 install rasterio mgrs');
ok.push(browserExecutable ? `浏览器：${browserExecutable}` : '浏览器：第一次渲染时 Remotion 会自动下载（约 100 MB）');
const freeGB = os.freemem() / 1e9;
(freeGB > 2 ? ok : bad).push(`空闲内存 ${freeGB.toFixed(1)} GB${freeGB > 2 ? '' : '（少于 2 GB，渲染时把 CONCURRENCY=1 设上）'}`);
console.log(ok.map((s) => '✓ ' + s).join('\n'));
if (bad.length) {
  console.log(bad.map((s) => '✗ ' + s).join('\n'));
  process.exit(1);
}
console.log('\n环境没问题。');
