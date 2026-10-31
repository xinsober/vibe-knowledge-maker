// 渲染脚本共用：打包、找浏览器、解析帧号、清理临时文件。
// 环境变量：BROWSER_BIN 指定 Chrome Headless Shell；GL 默认 swiftshader（用 three.js 的片子改 swangle）
import {bundle} from '@remotion/bundler';
import fs from 'fs';
import path from 'path';
import {writeGlyphs} from './glyphs.mjs';

// 优先用环境变量；再找常见的预装位置；都没有就交给 Remotion 自己下载
const guessBrowser = () => {
  if (process.env.BROWSER_BIN) return process.env.BROWSER_BIN;
  const roots = ['/opt/pw-browsers', path.join(process.env.HOME ?? '', '.cache/ms-playwright')];
  for (const r of roots) {
    if (!fs.existsSync(r)) continue;
    for (const d of fs.readdirSync(r).filter((d) => d.startsWith('chromium_headless_shell')).sort().reverse()) {
      for (const sub of ['chrome-linux/headless_shell', 'chrome-headless-shell-linux64/chrome-headless-shell']) {
        const p = path.join(r, d, sub);
        if (fs.existsSync(p)) return p;
      }
    }
  }
  return null;
};

export const browserExecutable = guessBrowser();
export const chromiumOptions = {gl: process.env.GL || 'swiftshader'};

export async function prepare() {
  writeGlyphs();
  return bundle({entryPoint: path.resolve('src/index.ts'), publicDir: path.resolve('public'), onProgress: () => {}});
}

// 每次打包会在临时目录留下几百 MB，用完就删
export const cleanup = (serveUrl) => {
  try {
    fs.rmSync(serveUrl, {recursive: true, force: true});
  } catch {}
};

// "0,30,90"、"0-300:30"（0 到 300 每 30 帧）可以混写
export const parseFrames = (arg) =>
  String(arg)
    .split(',')
    .flatMap((p) => {
      const m = p.match(/^(\d+)-(\d+)(?::(\d+))?$/);
      if (!m) return [Number(p)];
      const [a, b, s = 1] = m.slice(1).map(Number);
      return Array.from({length: Math.floor((b - a) / s) + 1}, (_, i) => a + i * s);
    });
