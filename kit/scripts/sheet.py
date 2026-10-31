# 把几张图拼成联系表，每格左上角标帧号和秒数。
# 用法：python3 scripts/sheet.py 输出.jpg 列数 图1.png 图2.png ...
import re
import sys

from PIL import Image, ImageDraw

out, cols, files = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
W = 640
ims = [Image.open(f).convert('RGB') for f in files]
h = round(W * ims[0].height / ims[0].width)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * W + (cols - 1) * 6, rows * h + (rows - 1) * 6), (20, 20, 20))
d = ImageDraw.Draw(sheet)
for i, (f, im) in enumerate(zip(files, ims)):
    x, y = (i % cols) * (W + 6), (i // cols) * (h + 6)
    sheet.paste(im.resize((W, h), Image.LANCZOS), (x, y))
    m = re.search(r'f(\d+)', f.split('/')[-1])
    if m:
        fr = int(m.group(1))
        d.rectangle([x, y, x + 150, y + 26], fill=(0, 0, 0))
        d.text((x + 6, y + 6), f'{fr}  {fr / 30:.1f}s', fill=(255, 220, 120))
sheet.save(out, quality=90)
print('联系表', out)
