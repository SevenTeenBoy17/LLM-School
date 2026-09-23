"""Trim white background from logo.png and produce a transparent PNG.

Uses 4-corner flood-fill (with tolerance) so only the OUTSIDE white area is
made transparent — the white interior of the icon (behind the tree) remains.

Then crops to the tight bounding box of remaining opaque pixels.
"""
from PIL import Image, ImageDraw

SRC = r"D:\VB\LLM-School\开发材料\logo.png"
DST = r"D:\VB\LLM-School\app\public\float\logo.png"

img = Image.open(SRC).convert("RGBA")
w, h = img.size
print(f"Input  : {w}x{h}, mode={img.mode}")

# Flood-fill from each corner with white tolerance so anti-aliased edges go too.
TRANSPARENT = (0, 0, 0, 0)
for corner in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
    ImageDraw.floodfill(img, corner, TRANSPARENT, thresh=14)

# Tighten: crop to the bounding box of fully-/partially-opaque pixels.
alpha = img.split()[-1]
bbox = alpha.getbbox()
if bbox:
    print(f"Bbox   : {bbox}")
    img = img.crop(bbox)

# Optional: re-sample down a bit to keep file size reasonable for a small UI icon.
MAX = 512
if max(img.size) > MAX:
    ratio = MAX / max(img.size)
    new_size = (round(img.size[0] * ratio), round(img.size[1] * ratio))
    img = img.resize(new_size, Image.LANCZOS)
    print(f"Resize : {new_size}")

img.save(DST, "PNG", optimize=True)
print(f"Output : {DST}  ({img.size[0]}x{img.size[1]})")
