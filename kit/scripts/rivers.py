"""世界大河：从 Natural Earth（公有领域）下载大河的走向，按名字挑出来，写到 public/world/rivers.json，
给地球组件（Globe）画河用。名字用英文，Natural Earth 里黄河叫 Huang，长江叫 Chang Jiang / Yangtze。
用法：python3 scripts/rivers.py Huang "Chang Jiang" Yangtze Nile
不带参数会列出能用的名字。
"""
import json
import os
import sys
import urllib.request

URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_rivers_lake_centerlines.geojson"
data = json.load(urllib.request.urlopen(URL, timeout=60))
names = sorted({f["properties"].get("name") or "" for f in data["features"]} - {""})
if len(sys.argv) < 2:
    print("能用的名字：" + "、".join(names))
    sys.exit(0)
out = {}
for want in sys.argv[1:]:
    lines = []
    for f in data["features"]:
        if f["properties"].get("name") == want:
            g = f["geometry"]
            lines += [g["coordinates"]] if g["type"] == "LineString" else g["coordinates"]
    if not lines:
        sys.exit(f"没找到 {want}。不带参数运行可以看全部名字。")
    out[want] = {"type": "MultiLineString", "coordinates": lines}
os.makedirs("public/world", exist_ok=True)
path = "public/world/rivers.json"
old = json.load(open(path)) if os.path.exists(path) else {}
old.update(out)
json.dump(old, open(path, "w"))
print(f"写到 {path}：" + "、".join(f"{k}（{len(v['coordinates'])} 段）" for k, v in out.items()))
