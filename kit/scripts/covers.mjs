// 封面：渲 16:9、4:3、3:4 三张（src/film/Cover.tsx），写到 out/cover-*.png。
// 平台上传时横版视频用 16:9 那张；个人主页的竖格子会裁成 3:4，主体和大字要在中间。
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';
import {browserExecutable, chromiumOptions, cleanup, prepare} from './lib.mjs';

const serveUrl = await prepare();
const browser = await openBrowser('chrome', {browserExecutable, chromiumOptions});
for (const id of ['Cover-16x9', 'Cover-4x3', 'Cover-3x4']) {
  const composition = await selectComposition({serveUrl, id, puppeteerInstance: browser});
  const output = `out/${id.toLowerCase()}.png`;
  await renderStill({serveUrl, composition, output, puppeteerInstance: browser, chromiumOptions});
  console.log('封面', output);
}
await browser.close({silent: true});
cleanup(serveUrl);
