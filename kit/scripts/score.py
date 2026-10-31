"""配乐和音效：读 out/timeline.json（npm run cues 生成），合成整片的音乐和音效，写 out/score.wav。

不用任何音频素材，全部用 numpy 现场合成，所以没有版权问题，也和画面严格同一条时间轴：
  - 每换一章（chapter），和弦进行从头开始，小节线落在换章那一帧上——音乐的段落和画面的段落一起换；
  - 场景叠化的地方自动加一声轻的 whoosh；剧本里写的 sfx 按帧放；
  - 'hush' 不是声音，是让音乐在那几帧里退下去，让一个揭晓落在安静里；
  - 整体强度从开头到 3/4 处一路往上走，最后几秒收回到主和弦。
曲风由 film.ts 里的 music 决定：mood = wonder（好奇、宏大）/ warm（温暖、人）/ tense（悬疑、紧张）/
bright（轻快）/ calm（安静、沉思），可以再给 bpm、drums（要不要鼓）。

用法：python3 scripts/score.py [out/timeline.json] [out/score.wav]
"""
import json
import sys
import wave

import numpy as np

SR = 48000
TL = sys.argv[1] if len(sys.argv) > 1 else "out/timeline.json"
OUT = sys.argv[2] if len(sys.argv) > 2 else "out/score.wav"
tl = json.load(open(TL))
FPS = tl["fps"]
TOTAL = tl["total"] / FPS
N = int(TOTAL * SR) + SR // 2
music_cfg = (tl.get("film") or {}).get("music") or {}
MOOD = music_cfg.get("mood", "wonder")

STYLE = {
    #        调（主音 MIDI）  大/小调  和弦级数（每小节一个）       速度  鼓      亮度
    "wonder": dict(root=50, minor=False, prog=[0, 4, 5, 3], bpm=92, drums=True, bright=7.0),
    "warm": dict(root=53, minor=False, prog=[5, 3, 0, 4], bpm=84, drums=True, bright=5.5),
    "tense": dict(root=48, minor=True, prog=[0, 5, 2, 6], bpm=96, drums=True, bright=6.0),
    "bright": dict(root=55, minor=False, prog=[0, 3, 5, 4], bpm=108, drums=True, bright=8.0),
    "calm": dict(root=51, minor=False, prog=[0, 3, 0, 4], bpm=72, drums=False, bright=4.5),
}[MOOD]
BPM = music_cfg.get("bpm", STYLE["bpm"])
DRUMS = music_cfg.get("drums", STYLE["drums"])
BEAT = 60.0 / BPM
BAR = BEAT * 4
SCALE = [0, 2, 3, 5, 7, 8, 10] if STYLE["minor"] else [0, 2, 4, 5, 7, 9, 11]
rng = np.random.default_rng(music_cfg.get("seed", 7))


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def chord(deg):
    """级数 → 和弦音（MIDI）：三和弦 + 一个加九音，排在 A3–A4 之间，换和弦时声部自然靠近"""
    pcs = [STYLE["root"] + SCALE[(deg + k) % 7] + 12 * ((deg + k) // 7) for k in (0, 2, 4, 1)]
    return sorted(57 + (p - 57) % 12 for p in pcs)


def bass_note(deg):
    return 38 + (STYLE["root"] + SCALE[deg % 7] - 38) % 12


def env_adsr(n, a, r, sustain=1.0):
    e = np.full(n, sustain)
    na, nr = max(1, int(a * SR)), max(1, int(r * SR))
    e[:na] = np.linspace(0, 1, na) * sustain if na < n else np.linspace(0, 1, n)[: n] * sustain
    if nr < n:
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


def table(bright, harmonics=18):
    x = np.linspace(0, 1, 4096, endpoint=False)
    w = sum(np.sin(2 * np.pi * k * x) / k * np.exp(-k / bright) for k in range(1, harmonics + 1))
    return w / np.abs(w).max()


PAD_T = table(STYLE["bright"])


def osc(tab, f, n, phase=0.0):
    ph = (phase + f * np.arange(n) / SR) % 1.0
    return tab[(ph * len(tab)).astype(int)]


def add(buf, start, sig, pan=0.0, gain=1.0):
    """把单声道 sig 按声像 pan（-1 左 … 1 右）加进立体声 buf"""
    i = int(start * SR)
    if i >= len(buf) or i + len(sig) <= 0:
        return
    if i < 0:
        sig, i = sig[-i:], 0
    sig = sig[: len(buf) - i]
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[i : i + len(sig), 0] += sig * l * gain
    buf[i : i + len(sig), 1] += sig * r * gain


def fft_filter(x, lo=None, hi=None):
    """频域里做的平滑带通（没有 scipy 也能用）"""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    g = np.ones_like(f)
    if lo:
        g *= 1 / (1 + (lo / np.maximum(f, 1)) ** 4)
    if hi:
        g *= 1 / (1 + (f / hi) ** 4)
    return np.fft.irfft(X * g, len(x))


# ---------- 段落：每章一段，和弦进行从头开始 ----------
starts = []
for s in tl["scenes"]:
    if not starts or s["chapter"] != starts[-1][1]:
        starts.append((s["from"] / FPS, s["chapter"]))
sections = [(t, (starts[i + 1][0] if i + 1 < len(starts) else TOTAL)) for i, (t, _) in enumerate(starts)]
sections[0] = (0.0, sections[0][1])

# 强度：开头就在（抖音前两秒要抓人），往后一路加，3/4 处最满，最后收
def intensity(t):
    return float(np.interp(t / TOTAL, [0, 0.12, 0.4, 0.75, 0.9, 1.0], [0.5, 0.6, 0.75, 0.9, 0.62, 0.3]))


bars = []  # (开始秒, 长度秒, 级数, 段落序号, 段内第几小节)
for si, (a, b) in enumerate(sections):
    k = 0
    t = a
    while t < b - 0.25:
        bars.append((t, min(BAR, b - t), STYLE["prog"][k % len(STYLE["prog"])], si, k))
        t += BAR
        k += 1
# 最后一小节回到主和弦
if bars:
    t, ln, _, si, k = bars[-1]
    bars[-1] = (t, TOTAL - t, 0, si, k)

music = np.zeros((N, 2))

# ---------- 铺底：pad ----------
for t, ln, deg, si, k in bars:
    n = int((ln + 1.2) * SR)
    e = env_adsr(n, 0.35 if k else 0.12, 1.2) * (0.5 + 0.5 * intensity(t))
    for j, m in enumerate(chord(deg)):
        for d, pan in ((-0.004, -0.6), (0.0, 0.0), (0.0045, 0.6)):
            add(music, t, osc(PAD_T, hz(m) * (1 + d), n, rng.random()) * e, pan, 0.035)

# ---------- 低音 ----------
for t, ln, deg, si, k in bars:
    g = np.clip((intensity(t) - 0.42) / 0.12, 0, 1)
    if g <= 0 or t < 1.5:
        continue
    f = hz(bass_note(deg))
    n = int(ln * SR)
    x = np.arange(n) / SR
    w = np.sin(2 * np.pi * f * x) + 0.35 * np.sin(4 * np.pi * f * x) + 0.12 * np.sin(6 * np.pi * f * x)
    e = env_adsr(n, 0.02, 0.25) * (0.75 + 0.25 * np.exp(-x * 2))
    add(music, t, w * e, 0, 0.1 * g)

# ---------- 琶音：钢琴一样的拨弦 ----------
def pluck(f, dur=1.8, vel=1.0):
    n = int(dur * SR)
    x = np.arange(n) / SR
    s = np.zeros(n)
    for k in range(1, 8):
        s += np.sin(2 * np.pi * f * k * (1 + 0.0004 * k * k) * x) / k**1.25 * np.exp(-x * (2.2 + 1.7 * k))
    s *= np.minimum(1, x / 0.004)
    return s * vel


PATTERNS = {"low": [0, None, 2, None, 1, None, 2, None], "mid": [0, 2, 3, 2, 1, 2, 3, 2], "high": [0, 2, 3, 4, 3, 2, 1, 2]}
for t, ln, deg, si, k in bars:
    tones = chord(deg)[:3]
    tones = tones + [tones[0] + 12, tones[1] + 12]
    I = intensity(t)
    pat = PATTERNS["low" if I < 0.62 else "mid" if I < 0.85 else "high"]
    for i, idx in enumerate(pat):
        tt = t + i * BEAT / 2
        if idx is None or tt >= t + ln - 0.05 or tt > TOTAL - 0.5:
            continue
        vel = (0.75 + 0.25 * rng.random()) * (1.0 if i % 2 == 0 else 0.7)
        add(music, tt + rng.normal(0, 0.004), pluck(hz(tones[idx] + 12)), pan=(-0.35 + 0.1 * idx), gain=0.07 * vel)

# ---------- 鼓 ----------
def kick():
    n = int(0.45 * SR)
    x = np.arange(n) / SR
    f = 45 + 80 * np.exp(-x * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * 7) + rng.normal(0, 1, n) * np.exp(-x * 300) * 0.15


def hat(dur=0.06):
    n = int(dur * SR)
    x = np.arange(n) / SR
    return fft_filter(rng.normal(0, 1, n), lo=7000) * np.exp(-x * 60)


def clap():
    n = int(0.25 * SR)
    x = np.arange(n) / SR
    z = fft_filter(rng.normal(0, 1, n), lo=900, hi=5000)
    return z * (np.exp(-x * 25) + 0.6 * np.exp(-np.maximum(0, x - 0.012) * 40) * (x > 0.012))


if DRUMS:
    for t, ln, deg, si, k in bars:
        g = np.clip((intensity(t) - 0.6) / 0.12, 0, 1)
        if g <= 0 or t > TOTAL - BAR * 1.5:
            continue
        for b in range(4):
            tb = t + b * BEAT
            if tb >= t + ln - 0.05:
                continue
            if b in (0, 2) or (MOOD == "bright"):
                add(music, tb, kick(), 0, 0.22 * g)
            if b in (1, 3) and MOOD in ("tense", "bright", "wonder"):
                add(music, tb, clap(), 0.1, 0.07 * g)
            for h in (0.5,):
                add(music, tb + h * BEAT, hat(), 0.3, 0.05 * g * (0.7 + 0.3 * rng.random()))

# ---------- 音效 ----------
sfx = np.zeros((N, 2))


def noise_sweep(dur, f0, f1, rise=0.6):
    """噪声扫频：四个频带交叉淡化出来的"呼——"声"""
    n = int(dur * SR)
    z = rng.normal(0, 1, n)
    bands = [fft_filter(z, lo=c * 0.6, hi=c * 1.6) for c in np.geomspace(f0, f1, 4)]
    pos = np.linspace(0, 3, n)
    out = np.zeros(n)
    for i, b in enumerate(bands):
        out += b * np.clip(1 - np.abs(pos - i), 0, 1)
    x = np.linspace(0, 1, n)
    e = np.where(x < rise, (x / rise) ** 2, ((1 - x) / (1 - rise)) ** 1.5)
    return out / (np.abs(out).max() + 1e-9) * e


def bell(f, dur=2.2):
    n = int(dur * SR)
    x = np.arange(n) / SR
    s = sum(a * np.sin(2 * np.pi * f * p * x) * np.exp(-x * d) for p, a, d in ((1, 1, 2.2), (2.76, 0.5, 4), (5.4, 0.25, 7), (8.93, 0.12, 11)))
    return s * np.minimum(1, x / 0.002)


TONIC = hz(STYLE["root"] + 24)


def make(kind, length):
    x = lambda d: np.arange(int(d * SR)) / SR
    if kind == "whoosh":
        return noise_sweep(0.7, 300, 4000), 0.35
    if kind == "tick":
        t = x(0.05)
        return np.sin(2 * np.pi * 2600 * t) * np.exp(-t * 120), 0.25
    if kind == "click":
        return fft_filter(rng.normal(0, 1, int(0.02 * SR)), lo=2000, hi=8000) * np.exp(-x(0.02) * 300), 0.35
    if kind == "pop":
        t = x(0.12)
        return np.sin(2 * np.pi * np.cumsum(300 + 700 * np.exp(-t * 40)) / SR) * np.exp(-t * 30), 0.35
    if kind == "chime":
        return bell(TONIC * 2), 0.18
    if kind == "shimmer":
        s = np.zeros(int(2.5 * SR))
        for i, m in enumerate([0, 4, 7, 12, 16]):
            b = bell(TONIC * 2 * 2 ** (m / 12), 2.0)
            o = int(i * 0.06 * SR)
            s[o : o + len(b)] += b[: len(s) - o] * (0.8 ** i)
        return s, 0.12
    if kind == "thud":
        t = x(0.8)
        return np.sin(2 * np.pi * np.cumsum(40 + 60 * np.exp(-t * 20)) / SR) * np.exp(-t * 5) + rng.normal(0, 1, len(t)) * np.exp(-t * 80) * 0.2, 0.55
    if kind == "drop":
        t = x(1.6)
        return np.sin(2 * np.pi * np.cumsum(32 + 50 * np.exp(-t * 6)) / SR) * np.exp(-t * 2.2), 0.6
    if kind == "riser":
        d = max(0.8, length or 1.5)
        t = x(d)
        tone = np.sin(2 * np.pi * np.cumsum(200 * 2 ** (t / d * 2)) / SR) * 0.4
        return (noise_sweep(d, 400, 6000, rise=0.98) + tone) * (t / d) ** 2, 0.22
    if kind == "swell":
        d = max(0.8, length or 1.2)
        return noise_sweep(d, 2000, 9000, rise=0.97), 0.18
    if kind == "paper":
        t = x(0.45)
        z = fft_filter(rng.normal(0, 1, len(t)), lo=1500, hi=9000)
        return z * np.abs(np.sin(t * 50)) ** 3 * np.exp(-t * 4), 0.3
    if kind == "count":
        d = max(0.3, length or 1.0)
        s = np.zeros(int(d * SR))
        for i in range(int(d * 15)):
            tk = np.sin(2 * np.pi * 2200 * x(0.03)) * np.exp(-x(0.03) * 150)
            o = int(i / 15 * SR)
            s[o : o + len(tk)] += tk[: len(s) - o]
        return s, 0.15
    raise ValueError(f"不认识的音效：{kind}")


events = list(tl.get("sfx", []))
# 自动：叠化处一声轻 whoosh；flash 进场一声闷响 + 亮音
for s in tl["scenes"][1:]:
    if s["enter"] == "flash":
        events += [{"at": s["from"], "kind": "thud"}, {"at": s["from"], "kind": "shimmer", "gain": 0.7}]
    elif s["enter"] != "cut":
        events.append({"at": s["from"] + 4, "kind": "whoosh", "gain": 0.45, "auto": True})

duck = np.ones(N)
for ev in events:
    t = ev["at"] / FPS
    length = ev.get("len", 0) / FPS if ev.get("len") else None
    if ev["kind"] == "hush":
        a, b = int(t * SR), int((t + (length or 1.0)) * SR)
        r = int(0.25 * SR)
        seg = np.ones(N)
        seg[a:b] = 0.25
        ramp = np.linspace(1, 0.25, r)
        seg[max(0, a - r) : a] = ramp[r - (a - max(0, a - r)) :]
        seg[b : b + r] = ramp[::-1][: len(seg[b : b + r])]
        duck = np.minimum(duck, seg)
        continue
    sig, g = make(ev["kind"], length)
    start = t - (len(sig) / SR if ev["kind"] in ("riser", "swell") else 0)  # 上扬类在 at 那一刻到顶
    add(sfx, start, sig, pan=float(rng.uniform(-0.25, 0.25)), gain=g * ev.get("gain", 1.0))

# ---------- 混响、结尾、混音 ----------
def reverb(x, secs=2.4, mix=0.22):
    n = int(secs * SR)
    out = np.empty_like(x)
    L = len(x) + n
    nfft = 1 << (L - 1).bit_length()
    for c in range(2):
        ir = rng.normal(0, 1, n) * np.exp(-np.arange(n) / SR * 6.9 / secs)
        ir = fft_filter(ir, hi=6000)
        ir /= np.sqrt(np.sum(ir**2))
        wet = np.fft.irfft(np.fft.rfft(x[:, c], nfft) * np.fft.rfft(ir, nfft), nfft)[: len(x)]
        out[:, c] = x[:, c] * (1 - mix) + wet * mix
    return out


music = reverb(music, 2.6, 0.28)
sfx = reverb(sfx, 1.6, 0.15)
music *= duck[:, None]
mix = music + sfx
# 手机外放听不到 40Hz 以下，留着只会吃掉响度余量
for c in range(2):
    mix[:, c] = fft_filter(mix[:, c], lo=40)
# 结尾 2 秒淡出到无声，开头不淡入（第一帧就要有声音）
fade = int(2.0 * SR)
end = int(TOTAL * SR)
mix[end - fade : end] *= np.linspace(1, 0, fade)[:, None] ** 1.5
mix[end:] = 0
mix = np.tanh(mix * 1.2) / 1.2
mix = mix[:end]
peak = np.abs(mix).max() + 1e-9
mix = mix / peak * 0.89

with wave.open(OUT, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype("<i2").tobytes())
print(f"配乐：{OUT}  {TOTAL:.1f} 秒  曲风 {MOOD}  {BPM} bpm  {len(sections)} 段  音效 {len(events)} 个")
