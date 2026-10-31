---
name: vibe-knowledge-maker
description: 做没有人声、靠画面和字幕讲清一个知识点的横版知识短片（Vibe知识大赏这一类），用 Remotion 写代码渲染，配乐和音效由代码合成，带自动质检和封面。用户说「做一条知识短片」「做一条 Vibe知识大赏」「用动画讲清楚 X」时用。
---

# 知识短片

做出来的片子：横版 1920×1080、30 帧、45–120 秒，没有人声。一屏一句字幕，画面把这句话演出来。
观众关着声音、没有任何背景知识，只看画面也能把整个过程复述出来，而且画面好看到让刷到的人停下来。

`kit/` 是一个能直接跑的工程：引擎（时间轴、字幕、版式、镜头、质感层、字体、配乐、质检）、
一套调好的画面组件（`src/pieces/`），和一条完整的示范片《河为什么不走直线》（`src/film/`）。
做新片就是复制这个工程，换掉 `src/film/` 里的内容。

## 开工

1. 把 `kit/` 整个复制到用户指定的地方（没指定就在当前目录建一个以片名命名的文件夹），在里面跑
   `npm install`，再跑 `npm run env`。缺什么它会列出来和装法，先告诉用户，用户同意再装。
2. 跑 `npm run gallery`，打开 `out/gallery/ink.jpg`：每个组件在屏上长什么样都在这张图里。选定外观以后，再跑 `node scripts/gallery.mjs 外观名` 看那套外观下的样子。
3. 完整读一遍 `docs/story.md`、`docs/screen.md`、`docs/pieces.md`、`docs/finish.md`，再读示范片的
   `src/film/` 全部文件。后面每一步都要用到，不要只翻其中一节。

用户只说了题目、没说别的：外观按题材挑，长度按讲清楚需要的来，剧本写完停一次，把 brief 和剧本整理成一页给用户看，用户点头再做画面。
用户说「直接做」「我看成品」，就不停，但每一关的自查照样做，第 4 步的开头样片也照样渲。

## 流程

每一步结束有一张关卡。关卡里每一条都过了才往下走，过不了就回去改，不要带着问题往后做。

### 1. 定题、查证 → `src/film/brief.md`

照示范片的 `brief.md` 写：要回答的那一个问题、观众看完能复述的那几步、开头第一眼、结尾落在观众自己身上的那一下、
事实表（每个数字和说法 + 出处 + 怎么核对的）、外观和配乐。

- [ ] 讲的就是用户说的那个题目，没有换成另一个更好讲的题，也没有拿比喻、历史绕路代替讲这件事本身
- [ ] 「观众看完能复述」那几句，一个没背景的人读得懂，每一步都能画出来
- [ ] 事实表里每个数字都有出处或者是自己用数据算出来的（算的脚本放进工程），查不到的不写

### 2. 剧本 → `src/film/script.ts`

一个场景一段，字幕一句一行，音效写在场景里。跑 `npm run cues` 看每句在第几秒、全片多长。

- [ ] 把字幕全遮住，只描述每个场景的画面，能不能把过程讲出来？讲不出来的那一步，画面要改，不是字幕要加
- [ ] 屏上没有术语，字幕是大白话，每句不超过两行
- [ ] 第 0 帧就有东西在动，前 3 秒观众已经知道这条片讲什么
- [ ] 结尾落在观众自己能看见、能做的事上，没有提问、号召、数据总结

### 3. 最难的一镜先做

挑全片最难画、最决定成败的那个场景先做，渲几张静帧（`node scripts/stills.mjs 名字 帧号`）自己看。
它立不住就换画法，别的场景先不动。

- [ ] 放到手机大小看，主体够大，标注读得清
- [ ] 东西有体积、有明暗、比例对，像真的，不像图标和流程图

### 4. 开头样片

把前 20 秒做完，`npm run audio`，然后 `node scripts/render.mjs out/head.mp4 --frames 0-599` 渲出来，`python3 scripts/check_film.py out/head.mp4` 查一遍（开头动没动、有没有声音），再从头看一遍。

- [ ] 刷到这条的人，3 秒内会不会停下来？换成自己是观众，会不会往下看？
- [ ] 音乐和音效落在画面变化的点上

### 5. 全片

做完剩下的场景。然后按顺序：`npm run qa`（字太小、贴边、压字幕、字叠字）→ `npm run audio` → `npm run render`
（渲完会出现 `out/film.mp4.done`，等它出现再读成片；`npm run audio` 和 `npm run render` 一开始都会删掉旧的这个文件）→ `npm run check`（规格、第一帧、黑场、静止、响度，出联系表 `out/check.jpg`）。
三个脚本报的问题全部改掉；然后看 `out/check.jpg` 和成片本身。

- [ ] 脚本全部通过
- [ ] 关掉声音从头看一遍：每个场景都知道在演什么，没有哪里卡住超过 3 秒不动
- [ ] 每个说法都对得上事实表

### 6. 交付

把 `src/film/Cover.tsx` 改成这条片的封面，`npm run covers` 出三张。给用户：成片路径、封面、标题和简介文案（简介里写出处）、片长、自查结果、
还觉得不够好的地方。具体见 `docs/finish.md`。

## 工程里改哪儿

| 文件 | 放什么 |
|---|---|
| `src/film/brief.md` | 定题、复述、事实表 |
| `src/film/film.ts` | 片名、外观、配乐风格、署名 |
| `src/film/script.ts` | 剧本：场景、字幕、章节、出处、音效、转场 |
| `src/film/scenes/` | 每个场景一个组件，在 `index.ts` 里登记 |
| `src/film/Cover.tsx` | 封面 |
| `public/` | 数据和图片（地形、真实数据、算好的模拟结果） |

`src/engine/` 和 `src/pieces/` 是共用的，一般不用改；组件不够用时在 `src/film/scenes/` 里自己写，写法照着 `src/pieces/`。

## 命令

| 命令 | 干什么 |
|---|---|
| `npm run env` | 环境检查 |
| `npm run gallery` | 组件联系表；`node scripts/gallery.mjs all` 出四种外观，加 `--video` 出视频 |
| `npm run cues` | 剧本算成时间轴，打印每句字幕的帧号 |
| `node scripts/stills.mjs 名字 帧号 [列数]` | 渲静帧和联系表，帧号写 `0,45,120` 或 `0-600:60` |
| `npm run qa` | 画面质检 |
| `npm run audio` | 合成配乐和音效、调响度 → `public/audio.wav` |
| `npm run render` | 渲成片 `out/film.mp4`；只渲一段用 `node scripts/render.mjs out/head.mp4 --frames 0-599`，只换声音用 `node scripts/render.mjs --remux`，只改了一两个场景用 `node scripts/render.mjs --patch 起-止` |
| `npm run check` | 成片检查和联系表 |
| `npm run covers` | 三张封面 |
| `npm run studio` | 在浏览器里边改边看 |
| `python3 scripts/terrain.py 名字 西 南 东 北` | 下载一块真实地形 |
| `python3 scripts/satellite.py 名字 西 南 东 北` | 下载同一块地方的真彩色卫星图（自动挑没云的一景） |
| `python3 scripts/rivers.py 河名…` | 下载世界大河的走向 |

一台机器同时只渲一个东西：qa、stills、gallery、covers、render 都会开一个浏览器渲画面，一次只跑其中一个。内存小于 8 GB 时，命令前加 `CONCURRENCY=1`。

## 版权

Remotion 对个人和 3 人以内的公司免费，更大的公司商用要买授权（remotion.pro）。用户说要商用、或者是公司在用时提醒一句。
字体（思源宋体、思源黑体、霞鹜文楷、JetBrains Mono、Cormorant Garamond）都可以免费商用；配乐和音效是代码合成的，没有版权问题。
