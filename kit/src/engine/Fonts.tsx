// 字体闸门：中文字体按字符分成很多小包，用到哪个字才下载哪包。
// 渲染时如果字还没下载完，那一帧就会缺字或换成别的字体。
// 这里在出第一帧之前，把全片用到的字（scripts/glyphs.mjs 扫 src 生成 glyphs.ts）全部加载完。
import '@fontsource/noto-serif-sc/500.css';
import '@fontsource/noto-serif-sc/700.css';
import '@fontsource/noto-serif-sc/900.css';
import '@fontsource/noto-sans-sc/400.css';
import '@fontsource/noto-sans-sc/500.css';
import '@fontsource/noto-sans-sc/700.css';
import '@fontsource/noto-sans-sc/900.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import 'lxgw-wenkai-screen-webfont/lxgwwenkaigbscreen.css';
import {useEffect, useState} from 'react';
import {continueRender, delayRender} from 'remotion';
import {GLYPHS} from './glyphs';

const ASCII = ' 0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.,:;!?%+-×÷=<>()[]/\'"#&*@·–—…';
const FACES: [string, number[], string?][] = [
  ['Noto Serif SC', [500, 700, 900]],
  ['Noto Sans SC', [400, 500, 700, 900]],
  ['LXGW WenKai Screen', [400]],
  ['JetBrains Mono', [400, 700]],
  ['Cormorant Garamond', [500, 600]],
  ['Cormorant Garamond', [500], 'italic'],
];

export const FontGate: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [handle] = useState(() => delayRender('加载字体'));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const text = GLYPHS + ASCII;
    const jobs = FACES.flatMap(([family, weights, style = 'normal']) =>
      weights.map((w) => document.fonts.load(`${style} ${w} 48px "${family}"`, text)),
    );
    Promise.all(jobs)
      .then(() => document.fonts.ready)
      .then(() => {
        setReady(true);
        continueRender(handle);
      })
      .catch((e) => {
        console.error('字体加载失败', e);
        continueRender(handle);
      });
  }, [handle]);
  return ready ? <>{children}</> : null;
};
