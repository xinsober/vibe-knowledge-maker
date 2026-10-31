# 真实地形：按经纬度范围下载公开的高程瓦片，算出山体阴影、海拔图，
# 再按"水往低处流"从高程里追出河网。输出给 src/pieces/Terrain.tsx 用。
#
# 用法：
#   python3 scripts/terrain.py 名字 西经度 南纬度 东经度 北纬度 [--zoom 10] [--width 2400] [--rivers 0.004]
# 例子（黄河晋陕峡谷里连续拐弯的一段）：
#   python3 scripts/terrain.py bends 110.30 36.62 110.56 36.80
# 输出：public/terrain/名字/shade.png（阴影）、height.png（海拔，越亮越高）、rivers.json（河道折线）、
#       main.json（穿过这块地的主河道，带长度）、meta.json
#
# 数据：AWS 公开数据集 Terrain Tiles（Mapzen terrarium 格式），可商用，片尾或出处写
# 「地形数据：Mapzen / AWS Terrain Tiles（含 SRTM、GMTED 等）」。
# 河网是从高程算出来的，适合讲"水往哪流"；要精确到真实河道名字和位置，请对照地图核实。
import argparse
import heapq
import io
import json
import math
import os
import sys
import urllib.request

import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('name')
ap.add_argument('west', type=float)
ap.add_argument('south', type=float)
ap.add_argument('east', type=float)
ap.add_argument('north', type=float)
ap.add_argument('--zoom', type=int, default=0, help='瓦片级别，默认按范围自动选')
ap.add_argument('--width', type=int, default=2400, help='输出图宽（像素）')
ap.add_argument('--rivers', type=float, default=0.004, help='汇水面积超过全图多少比例才算河，越小河越多')
ap.add_argument('--sun', type=float, default=315, help='光从哪个方位来（度，315 = 西北）')
a = ap.parse_args()

URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'


def lonlat_to_tile(lon, lat, z):
    n = 2 ** z
    x = (lon + 180) / 360 * n
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    return x, y


# 自动选级别：让输出宽度大约对上瓦片像素
z = a.zoom
if not z:
    # 公开高程大多是 30 米精度，12 级以上只是放大，不会更清楚
    for z in range(4, 13):
        x0, _ = lonlat_to_tile(a.west, a.north, z)
        x1, _ = lonlat_to_tile(a.east, a.north, z)
        if (x1 - x0) * 256 >= a.width * 0.9:
            break
x0, y0 = lonlat_to_tile(a.west, a.north, z)
x1, y1 = lonlat_to_tile(a.east, a.south, z)
tx0, ty0, tx1, ty1 = int(x0), int(y0), int(x1), int(y1)
ntiles = (tx1 - tx0 + 1) * (ty1 - ty0 + 1)
if ntiles > 300:
    sys.exit(f'范围太大（{ntiles} 块瓦片），把 --zoom 调小或缩小范围')
print(f'级别 {z}，下载 {ntiles} 块瓦片…')

mosaic = np.zeros(((ty1 - ty0 + 1) * 256, (tx1 - tx0 + 1) * 256), np.float32)
cache = os.path.join('out', 'tile-cache')
os.makedirs(cache, exist_ok=True)
for ty in range(ty0, ty1 + 1):
    for tx in range(tx0, tx1 + 1):
        fn = os.path.join(cache, f'{z}_{tx}_{ty}.png')
        if not os.path.exists(fn):
            with urllib.request.urlopen(URL.format(z=z, x=tx, y=ty), timeout=30) as r:
                open(fn, 'wb').write(r.read())
        im = np.asarray(Image.open(fn).convert('RGB')).astype(np.float32)
        h = im[..., 0] * 256 + im[..., 1] + im[..., 2] / 256 - 32768
        mosaic[(ty - ty0) * 256:(ty - ty0 + 1) * 256, (tx - tx0) * 256:(tx - tx0 + 1) * 256] = h

# 裁到经纬度范围，再缩放到输出尺寸
px0, py0 = (x0 - tx0) * 256, (y0 - ty0) * 256
px1, py1 = (x1 - tx0) * 256, (y1 - ty0) * 256
crop = mosaic[int(py0):int(math.ceil(py1)), int(px0):int(math.ceil(px1))]
W = a.width
H = round(W * crop.shape[0] / crop.shape[1])
dem = np.asarray(Image.fromarray(crop).resize((W, H), Image.BICUBIC), np.float32)

# 每像素多少米（用于阴影的坡度）
lat_mid = math.radians((a.north + a.south) / 2)
m_per_px = (a.east - a.west) * 111320 * math.cos(lat_mid) / W

# 山体阴影（Horn 算法），再混一点多方向光，让暗面不死黑
def shade(azi, alt=40):
    gy, gx = np.gradient(dem, m_per_px)
    slope = np.arctan(np.hypot(gx, gy) * 1.6)
    aspect = np.arctan2(-gx, gy)
    az, al = math.radians(azi), math.radians(alt)
    return np.clip(np.sin(al) * np.cos(slope) + np.cos(al) * np.sin(slope) * np.cos(az - aspect), 0, 1)

hs = 0.7 * shade(a.sun) + 0.3 * shade(a.sun - 90)
lo, hi = np.percentile(dem, 1), np.percentile(dem, 99.5)
height = np.clip((dem - lo) / max(1, hi - lo), 0, 1)

out = os.path.join('public', 'terrain', a.name)
os.makedirs(out, exist_ok=True)
Image.fromarray((hs * 255).astype(np.uint8)).save(os.path.join(out, 'shade.png'))
Image.fromarray((height * 255).astype(np.uint8)).save(os.path.join(out, 'height.png'))

# 河网：先在缩小的网格上填洼（priority-flood），再按 D8 算每格的汇水面积
G = 600 if W > 600 else W
gh = round(G * H / W)
g = np.asarray(Image.fromarray(dem).resize((G, gh), Image.BILINEAR), np.float64)
filled = g.copy()
seen = np.zeros(g.shape, bool)
pq = []
for yy in range(gh):
    for xx in (0, G - 1):
        heapq.heappush(pq, (filled[yy, xx], yy, xx)); seen[yy, xx] = True
for xx in range(G):
    for yy in (0, gh - 1):
        if not seen[yy, xx]:
            heapq.heappush(pq, (filled[yy, xx], yy, xx)); seen[yy, xx] = True
order = []
NB = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
while pq:
    v, yy, xx = heapq.heappop(pq)
    order.append((yy, xx))
    for dy, dx in NB:
        ny, nx = yy + dy, xx + dx
        if 0 <= ny < gh and 0 <= nx < G and not seen[ny, nx]:
            seen[ny, nx] = True
            filled[ny, nx] = max(filled[ny, nx], v + 1e-3)
            heapq.heappush(pq, (filled[ny, nx], ny, nx))
# 每格流向最陡的下坡邻居
down = np.full(g.shape + (2,), -1, int)
for yy, xx in order:
    best, bd = None, 0.0
    for dy, dx in NB:
        ny, nx = yy + dy, xx + dx
        if 0 <= ny < gh and 0 <= nx < G:
            d = (filled[yy, xx] - filled[ny, nx]) / math.hypot(dy, dx)
            if d > bd:
                bd, best = d, (ny, nx)
    if best:
        down[yy, xx] = best
acc = np.ones(g.shape)
for yy, xx in reversed(order):
    ny, nx = down[yy, xx]
    if ny >= 0:
        acc[ny, nx] += acc[yy, xx]
thr = a.rivers * G * gh
# 从每个河源顺流而下，连成折线；汇入已画过的河就停
river = acc >= thr
done = np.zeros(g.shape, bool)
lines = []
heads = [(acc[y, x], y, x) for y, x in zip(*np.nonzero(river))]
heads.sort()
for _, y, x in heads:
    if done[y, x]:
        continue
    pts = []
    while True:
        pts.append([round(x / (G - 1), 5), round(y / (gh - 1), 5), round(float(acc[y, x]) / (G * gh), 6)])
        if done[y, x]:
            break
        done[y, x] = True
        ny, nx = down[y, x]
        if ny < 0:
            break
        y, x = ny, nx
    if len(pts) > 3:
        lines.append(pts)
json.dump({'lines': lines}, open(os.path.join(out, 'rivers.json'), 'w'))

# 主河道：从图边上最低的入口顺流到出口（穿过这块地的那条大河）。量它的长度和两头的直线距离，
# 片子里"这段河绕了多远"这类数字可以直接从这里来（D8 路径平滑后估算，误差约 5%，写"约"）
bd = [(yy, xx) for yy in range(gh) for xx in (0, G - 1)] + [(yy, xx) for xx in range(G) for yy in (0, gh - 1)]
oy, ox = max(bd, key=lambda c: acc[c])
main = None
for ey, ex in sorted(bd, key=lambda c: filled[c]):
    if math.hypot(ey - oy, ex - ox) < (G + gh) / 4:
        continue
    path, (y, x) = [], (ey, ex)
    while y >= 0 and len(path) < G * gh:
        path.append((x, y))
        y, x = down[y, x]
    if math.hypot(path[-1][1] - oy, path[-1][0] - ox) < 3 and len(path) > 20:
        main = np.array(path, float)
        break
if main is not None:
    k = np.ones(5) / 5
    sm = np.c_[np.convolve(np.pad(main[:, 0], 2, mode='edge'), k, 'valid'), np.convolve(np.pad(main[:, 1], 2, mode='edge'), k, 'valid')]
    px = m_per_px * W / G
    length = float(np.sum(np.hypot(*np.diff(sm, axis=0).T)) * px / 1000)
    straight = float(np.hypot(*(sm[-1] - sm[0])) * px / 1000)
    pts = [[round(x / (G - 1), 5), round(y / (gh - 1), 5)] for x, y in sm]
    json.dump({'points': pts, 'lengthKm': round(length, 1), 'straightKm': round(straight, 1)}, open(os.path.join(out, 'main.json'), 'w'))
    print(f'主河道：河道长约 {length:.1f} 公里，两头直线距离约 {straight:.1f} 公里（写在 main.json）')
meta = {'west': a.west, 'south': a.south, 'east': a.east, 'north': a.north, 'width': W, 'height': H,
        'zoom': z, 'minElev': float(lo), 'maxElev': float(hi), 'metersPerPixel': m_per_px}
json.dump(meta, open(os.path.join(out, 'meta.json'), 'w'), indent=1)
print(f'完成：{out}（{W}×{H}，海拔 {lo:.0f}–{hi:.0f} 米，{len(lines)} 条河道）')
