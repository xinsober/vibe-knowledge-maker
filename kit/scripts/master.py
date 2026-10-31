"""响度：把 out/score.wav 调到短视频平台的标准响度，写到 public/audio.wav（渲染和 studio 预览都读它）。
目标：整体 -14 LUFS，真峰值不超过 -1 dBTP。两遍 loudnorm：先量，再按量到的数线性调整。
用法：python3 scripts/master.py [输入=out/score.wav] [输出=public/audio.wav]
"""
import json
import re
import subprocess
import sys

src = sys.argv[1] if len(sys.argv) > 1 else "out/score.wav"
dst = sys.argv[2] if len(sys.argv) > 2 else "public/audio.wav"
target = "I=-14:TP=-1.5:LRA=11"

r = subprocess.run(["ffmpeg", "-nostats", "-i", src, "-af", f"loudnorm={target}:print_format=json", "-f", "null", "-"], capture_output=True, text=True)
m = json.loads(re.findall(r"\{[^{}]+\}", r.stderr)[-1])
af = (
    f"loudnorm={target}:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
    f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true,aresample=48000"
)
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", src, "-af", af, "-ar", "48000", "-c:a", "pcm_s16le", dst], check=True)

r = subprocess.run(["ffmpeg", "-nostats", "-i", dst, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True)
I = re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr)[-1]
P = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", r.stderr)[-1]
print(f"响度：{dst}  整体 {I} LUFS  真峰值 {P} dBTP（目标 -14 / ≤ -1）")
