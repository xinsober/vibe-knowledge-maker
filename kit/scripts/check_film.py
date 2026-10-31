"""成片检查：量一遍渲出来的 mp4，出一张每 2 秒一格的联系表（out/check.jpg，按手机屏的大小看）。
查的是机器能查的：
  - 规格：1920×1080、30fps、H.264、有声音、时长
  - 第一帧：不能是黑的、空的（刷到的人第一眼看到的就是它）
  - 开头动没动：头 1.5 秒画面要有明显变化（镜头在推、东西在长、在变），一动不动的开头最容易被划走
  - 黑场：中间不能有 0.25 秒以上的黑（转场用叠化，不要闪黑）
  - 静止：画面连续 3 秒不动就报（观众会划走）
  - 响度：整体 -14 LUFS 左右，真峰值不超过 -1 dBTP，开头 0.5 秒要有声音
看不出来的（好不好看、讲没讲清楚）要自己看联系表、看片。
用法：python3 scripts/check_film.py out/film.mp4
"""
import json
import os
import re
import subprocess
import sys

from PIL import Image, ImageDraw, ImageStat

path = sys.argv[1] if len(sys.argv) > 1 else "out/film.mp4"
problems, notes = [], []


def run(*a):
    return subprocess.run(a, capture_output=True, text=True)


def run_bytes(*a):
    return subprocess.run(a, capture_output=True).stdout


info = json.loads(run("ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", path).stdout)
v = next(s for s in info["streams"] if s["codec_type"] == "video")
a = next((s for s in info["streams"] if s["codec_type"] == "audio"), None)
dur = float(info["format"]["duration"])
fps = eval(v["r_frame_rate"])
mb = os.path.getsize(path) / 1e6
notes.append(f"{v['width']}×{v['height']}  {fps:g}fps  {v['codec_name']}  {dur:.1f} 秒  {mb:.0f} MB  {float(info['format']['bit_rate']) / 1e6:.1f} Mbps")
if (v["width"], v["height"]) != (1920, 1080):
    problems.append(f"分辨率是 {v['width']}×{v['height']}，应为 1920×1080")
if abs(fps - 30) > 0.01:
    problems.append(f"帧率是 {fps:g}，应为 30")
if not a:
    problems.append("没有声音：先 npm run audio，再渲")

# 第一帧
os.makedirs("out/check", exist_ok=True)
run("ffmpeg", "-y", "-v", "error", "-i", path, "-frames:v", "1", "out/check/first.png")
im = Image.open("out/check/first.png").convert("L")
st = ImageStat.Stat(im)
if st.mean[0] < 12 or st.stddev[0] < 8:
    problems.append(f"第一帧几乎是黑的或空的（平均亮度 {st.mean[0]:.0f}，反差 {st.stddev[0]:.0f}）：第一帧就要有内容")

# 开头动没动：拿第 0 秒和第 1.5 秒比，平均每个像素差多少（0–255）
def gray(t):
    raw = run_bytes("ffmpeg", "-v", "error", "-ss", f"{t:.2f}", "-i", path, "-frames:v", "1", "-vf", "scale=192:108,format=gray", "-f", "rawvideo", "-")
    return list(raw)


g0, g1 = gray(0.05), gray(1.5)
if len(g0) == len(g1) == 192 * 108:
    change = sum(abs(x - y) for x, y in zip(g0, g1)) / len(g0)
    notes.append(f"开头 1.5 秒的画面变化 {change:.1f}")
    if change < 3:
        problems.append(f"开头 1.5 秒画面几乎没变（变化 {change:.1f}，一般要 5 以上）：第一秒就让东西动起来、长出来，或者镜头在推")

# 黑场、静止（缩小了再查，快）
r = run("ffmpeg", "-v", "info", "-i", path, "-vf", "scale=480:-2,blackdetect=d=0.25:pix_th=0.08,freezedetect=n=0.002:d=3", "-an", "-f", "null", "-")
for m in re.finditer(r"black_start:([\d.]+) black_end:([\d.]+)", r.stderr):
    s, e = float(m.group(1)), float(m.group(2))
    if e < dur - 0.3:
        problems.append(f"黑场 {s:.1f}–{e:.1f} 秒：转场用叠化，不要闪黑")
fs = [float(x) for x in re.findall(r"freeze_start: ([\d.]+)", r.stderr)]
fe = [float(x) for x in re.findall(r"freeze_end: ([\d.]+)", r.stderr)] + [dur]
for s, e in zip(fs, fe):
    if e - s >= 3 and e < dur - 0.3:
        problems.append(f"画面 {s:.1f}–{e:.1f} 秒几乎不动（{e - s:.1f} 秒）：加镜头运动或让东西动起来")

# 响度
if a:
    r = run("ffmpeg", "-nostats", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-")
    I = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr)[-1])
    P = float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", r.stderr)[-1])
    notes.append(f"响度 {I:.1f} LUFS  真峰值 {P:.1f} dBTP")
    if not -16 <= I <= -12:
        problems.append(f"响度 {I:.1f} LUFS，应在 -14 左右：重跑 npm run audio")
    if P > -0.9:
        problems.append(f"真峰值 {P:.1f} dBTP，会破音：重跑 npm run audio")
    r = run("ffmpeg", "-nostats", "-t", "0.5", "-i", path, "-af", "volumedetect", "-f", "null", "-")
    mv = re.findall(r"mean_volume: (-?[\d.]+) dB", r.stderr)
    if mv and float(mv[-1]) < -45:
        problems.append("开头 0.5 秒没有声音：第一帧就该有音乐或音效")

# 联系表：每 2 秒一格，640 宽，相当于手机横屏全屏看
files = []
for i, t in enumerate([x * 2.0 for x in range(int(dur // 2) + 1)]):
    f = f"out/check/f{round(t * 30):05d}.png"
    run("ffmpeg", "-y", "-v", "error", "-ss", f"{min(t, dur - 0.05):.2f}", "-i", path, "-frames:v", "1", "-vf", "scale=640:-2", f)
    if os.path.exists(f):
        files.append(f)
here = os.path.dirname(os.path.abspath(__file__))
subprocess.run([sys.executable, os.path.join(here, "sheet.py"), "out/check.jpg", "5", *files], check=True, stdout=subprocess.DEVNULL)

print("\n".join(notes))
print("联系表：out/check.jpg（每 2 秒一格）")
if problems:
    print(f"\n发现 {len(problems)} 个问题：")
    for p in problems:
        print("  - " + p)
    sys.exit(1)
print("\n机器能查的都过了。接下来自己看联系表和成片：每一格不看字幕也知道在讲什么吗？")
