"""卫星图：按经纬度范围，从公开的 Sentinel-2 影像里挑一景没有云的，裁出真彩色卫星图，给 src/pieces/Satellite.tsx 用。
范围和 scripts/terrain.py 用同一套（同名同范围时，卫星图和地形图逐像素对齐，可以从地形叠化成卫星图）。

用法：
  python3 scripts/satellite.py 名字 西经度 南纬度 东经度 北纬度 [--width 2400] [--months 3,4,5,9,10,11] [--years 2025,2024,2023] [--date 2024-04-21]
例子（示范片用的那段黄河）：
  python3 scripts/satellite.py bends 110.30 36.62 110.56 36.80
输出：public/sat/名字/image.jpg、water.png（水面，用近红外和绿光算的，白 = 水）、meta.json（范围、尺寸、拍摄日期、出处）；
      同名同范围的地形已经追出了主河道（terrain.py 的 main.json），会把它贴到影像里真实的水面上，写 public/sat/名字/main.json

数据：Copernicus Sentinel-2 L2A（10 米分辨率），AWS 公开桶 sentinel-cogs，可商用，出处写
「卫星影像：Copernicus Sentinel-2（拍摄日期）」。10 米一个像素：看得清河道、田块、城市街区，看不清单个房子和车。
范围十几公里到一两百公里见方最合适；太大会很慢（要读好几景）。
依赖：pip3 install rasterio mgrs scipy
"""
import argparse
import json
import math
import os
import re
import sys
import urllib.request

import numpy as np
from PIL import Image

try:
    import mgrs
    import rasterio
    from rasterio.enums import Resampling
    from rasterio.transform import from_bounds
    from rasterio.vrt import WarpedVRT
    from scipy import ndimage
except ImportError:
    sys.exit('缺依赖：pip3 install rasterio mgrs scipy')

ap = argparse.ArgumentParser()
ap.add_argument('name')
ap.add_argument('west', type=float)
ap.add_argument('south', type=float)
ap.add_argument('east', type=float)
ap.add_argument('north', type=float)
ap.add_argument('--width', type=int, default=2400)
ap.add_argument('--months', default='4,5,9,10,3,11', help='优先找哪几个月（植被和光线都好、云少的月份在前）')
ap.add_argument('--years', default='2025,2024,2023')
ap.add_argument('--date', help='指定日期 YYYY-MM-DD（不自动挑）')
a = ap.parse_args()

BUCKET = 'https://sentinel-cogs.s3.us-west-2.amazonaws.com'
ROOT = 'sentinel-s2-l2a-cogs'

# 输出尺寸：和 terrain.py 一样按 Web 墨卡托算高宽比
mercY = lambda lat: math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
W = a.width
H = round(W * (mercY(a.north) - mercY(a.south)) / math.radians(a.east - a.west))
# 同名的地形图已经有了，就用它的尺寸，两张图逐像素对齐
tm = os.path.join('public', 'terrain', a.name, 'meta.json')
if os.path.exists(tm):
    t = json.load(open(tm))
    if [t['west'], t['south'], t['east'], t['north']] == [a.west, a.south, a.east, a.north]:
        W, H = t['width'], t['height']
R = 6378137.0
x0, x1 = math.radians(a.west) * R, math.radians(a.east) * R
y0, y1 = mercY(a.south) * R, mercY(a.north) * R

# 这块范围落在哪几个 MGRS 图幅里
m = mgrs.MGRS()
tiles = sorted({m.toMGRS(a.south + (a.north - a.south) * j / 4, a.west + (a.east - a.west) * i / 4, MGRSPrecision=0) for i in range(5) for j in range(5)})
print('图幅：' + '、'.join(tiles))


def get(url):
    with urllib.request.urlopen(url, timeout=60) as r:
        return r.read()


def scenes(tile, year, month):
    zone, band, sq = tile[:2].lstrip('0'), tile[2], tile[3:]
    prefix = f'{ROOT}/{zone}/{band}/{sq}/{year}/{month}/'
    xml = get(f'{BUCKET}/?list-type=2&delimiter=/&prefix={prefix}').decode()
    return [(prefix + s + '/', s) for s in sorted(set(re.findall(r'(S2[ABC]_\w+?_L2A)/', xml)))]


def read(tile_items, file='TCI.tif', bands=3):
    """把同一天的几个图幅读进同一张 Web 墨卡托画布"""
    rgb = np.zeros((bands, H, W), np.uint16)
    for prefix, sid in tile_items:
        url = f'/vsicurl/{BUCKET}/{prefix}{file}'
        with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR', CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tif', AWS_NO_SIGN_REQUEST='YES'):
            grid = dict(crs='EPSG:3857', transform=from_bounds(x0, y0, x1, y1, W, H), width=W, height=H, resampling=Resampling.bilinear, nodata=0)
            with rasterio.open(url) as src, WarpedVRT(src, **grid) as vrt:
                part = vrt.read(indexes=list(range(1, bands + 1)))
        empty = rgb.sum(0) == 0
        rgb[:, empty] = part[:, empty]
    return rgb


# 候选：按月份优先级把每一景的云量列出来，同一天几个图幅都要有
cands = []
if a.date:
    y, mo, d = a.date.split('-')
    items = {}
    for t in tiles:
        for prefix, sid in scenes(t, int(y), int(mo)):
            if y + mo + d in sid:
                items[t] = (prefix, sid)
    if len(items) < len(tiles):
        sys.exit(f'{a.date} 没有覆盖全部图幅的影像')
    cands.append((0, a.date, list(items.values())))
else:
    for year in [int(v) for v in a.years.split(',')]:
        for month in [int(v) for v in a.months.split(',')]:
            by_day = {}
            for t in tiles:
                for prefix, sid in scenes(t, year, month):
                    day = sid.split('_')[2]
                    try:
                        p = json.loads(get(f'{BUCKET}/{prefix}{sid}.json'))['properties']
                    except Exception:
                        continue
                    score = p.get('eo:cloud_cover', 100) + 0.3 * p.get('s2:nodata_pixel_percentage', 0)
                    by_day.setdefault(day, {})[t] = (score, prefix, sid)
            for day, items in by_day.items():
                if len(items) == len(tiles):
                    cands.append((max(v[0] for v in items.values()), f'{day[:4]}-{day[4:6]}-{day[6:]}', [(v[1], v[2]) for v in items.values()]))
            good = [c for c in cands if c[0] < 3]
            print(f'  {year}-{month:02d}：{len(by_day)} 天有影像，目前最好的云量分 {min([c[0] for c in cands], default=99):.1f}')
            if len(good) >= 3:
                break
        if len([c for c in cands if c[0] < 3]) >= 3:
            break
cands.sort(key=lambda c: c[0])
if not cands:
    sys.exit('没找到影像：换 --years / --months 再试')

# 图幅的云量是整景的，这块范围里可能正好有云：读出来再量一次（很亮又不带颜色的像素算云），不行就换下一景
best = None
for score, date, items in cands[:6]:
    tile_items = items
    print(f'读 {date}（整景云量分 {score:.1f}）…')
    rgb = read(items)
    px = rgb.reshape(3, -1).astype(np.int16)
    valid = px.sum(0) > 0
    bright = (px.min(0) > 200) & (px.max(0) - px.min(0) < 25)
    cloud = bright[valid].mean() if valid.any() else 1
    hole = 1 - valid.mean()
    print(f'  这块范围里：云 {cloud * 100:.1f}%  缺数据 {hole * 100:.1f}%')
    if best is None or cloud + hole < best[0]:
        best = (cloud + hole, date, rgb, items)
    if cloud < 0.005 and hole < 0.005:
        break
_, date, rgb, items = best

# 调色：真彩色原图偏灰偏暗，三个通道一起按 0.5%–99.5% 拉伸（分开拉会偏色），再提一点饱和度
img = rgb.transpose(1, 2, 0).astype(np.float32)
valid = img.sum(2) > 0
lo = np.percentile(img[valid], 0.5)
hi = np.percentile(img[valid], 99.5)
img = np.clip((img - lo) / np.maximum(1, hi - lo), 0, 1) ** 0.9
grey = img.mean(2, keepdims=True)
img = np.clip(grey + (img - grey) * 1.1, 0, 1)
img[~valid] = 0

out = os.path.join('public', 'sat', a.name)
os.makedirs(out, exist_ok=True)
Image.fromarray((img * 255).astype(np.uint8)).save(os.path.join(out, 'image.jpg'), quality=90)
meta = {'west': a.west, 'south': a.south, 'east': a.east, 'north': a.north, 'width': W, 'height': H, 'date': date,
        'metersPerPixel': (a.east - a.west) * 111320 * math.cos(math.radians((a.north + a.south) / 2)) / W,
        'credit': f'卫星影像：Copernicus Sentinel-2（{date}）'}
json.dump(meta, open(os.path.join(out, 'meta.json'), 'w'), ensure_ascii=False, indent=1)
print(f'卫星图：{out}/image.jpg  {W}×{H}  拍摄于 {date}')

# 水面：绿光比近红外亮的地方是水（NDWI > 0），浑水、清水都认得出
g = read(items, 'B03.tif', 1)[0].astype(np.float32)
n = read(items, 'B08.tif', 1)[0].astype(np.float32)
ndwi = (g - n) / np.maximum(1, g + n)
water = ndimage.binary_opening(ndwi > 0.0, iterations=1)
Image.fromarray((water * 255).astype(np.uint8)).save(os.path.join(out, 'water.png'))
print(f'水面：{out}/water.png（占 {water.mean() * 100:.1f}%）')

# 地形追出的主河道是 30 米精度的高程算的，弯道上会偏出河面：贴到影像里真实水面的中线上
tmain = os.path.join('public', 'terrain', a.name, 'main.json')
if os.path.exists(tmain) and os.path.exists(tm):
    inside = ndimage.distance_transform_edt(water)  # 离岸多远：河中线上最大
    pts = np.array(json.load(open(tmain))['points']) * [W, H]
    r = int(max(8, 300 / meta['metersPerPixel']))  # 最多挪 300 米
    yy, xx = np.mgrid[-r:r + 1, -r:r + 1]
    snapped = []
    for x, y in pts:
        xi, yi = int(round(x)), int(round(y))
        x0_, y0_ = max(0, xi - r), max(0, yi - r)
        win = inside[y0_:yi + r + 1, x0_:xi + r + 1]
        if win.max() <= 0:
            snapped.append((x, y))
            continue
        oy, ox = yy[y0_ - (yi - r):y0_ - (yi - r) + win.shape[0], x0_ - (xi - r):x0_ - (xi - r) + win.shape[1]], xx[y0_ - (yi - r):y0_ - (yi - r) + win.shape[0], x0_ - (xi - r):x0_ - (xi - r) + win.shape[1]]
        score = win - 0.35 * np.hypot(ox, oy)
        k = np.unravel_index(np.argmax(score), score.shape)
        snapped.append((x0_ + k[1], y0_ + k[0]))
    sp = np.array(snapped, float)
    ker = np.ones(15) / 15
    sp = np.c_[np.convolve(np.pad(sp[:, 0], 7, mode='edge'), ker, 'valid'), np.convolve(np.pad(sp[:, 1], 7, mode='edge'), ker, 'valid')]
    mpp = meta['metersPerPixel']
    length = np.hypot(*np.diff(sp, axis=0).T).sum() * mpp / 1000
    straight = np.hypot(*(sp[-1] - sp[0])) * mpp / 1000
    json.dump({'points': (sp / [W, H]).round(5).tolist(), 'lengthKm': round(length, 1), 'straightKm': round(straight, 1)}, open(os.path.join(out, 'main.json'), 'w'))
    print(f'主河道贴到水面上：河道长约 {length:.1f} 公里，两头直线约 {straight:.1f} 公里（{out}/main.json）')
