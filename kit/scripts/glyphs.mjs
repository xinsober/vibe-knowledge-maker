// 扫一遍 src 里所有文件，把用到的非 ASCII 字符写进 src/engine/glyphs.ts，给字体闸门预加载。
// 渲染脚本每次都会自动跑；字幕或画面文字写在 src 以外的地方时，把目录加到 DIRS。
import fs from 'fs';
import path from 'path';

const DIRS = ['src'];
const OUT = 'src/engine/glyphs.ts';

const walk = (d) =>
  fs.readdirSync(d, {withFileTypes: true}).flatMap((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.(tsx?|json|md)$/.test(e.name) && p !== OUT ? [p] : [];
  });

export function writeGlyphs() {
  const set = new Set();
  for (const d of DIRS) for (const f of walk(d)) for (const ch of fs.readFileSync(f, 'utf8')) if (ch.codePointAt(0) > 127) set.add(ch);
  const text = [...set].sort().join('').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const body = `// 自动生成，不要手改（scripts/glyphs.mjs）\nexport const GLYPHS = '${text}';\n`;
  if (!fs.existsSync(OUT) || fs.readFileSync(OUT, 'utf8') !== body) fs.writeFileSync(OUT, body);
  return set.size;
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(`字表 ${writeGlyphs()} 个字`);
