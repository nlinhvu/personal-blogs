"""Rasterise the vulinh.dev mark to PNG and ICO with no third-party libraries.

The mark is a rounded square with a V cut into it, described once in a 100x100
coordinate space and shared with site/public/favicon.svg, so editing the V here
means editing it there too and all three files stay in step.

Pillow and ImageMagick are not dependencies of this project and this script does
not add them: the PNG encoder is zlib plus struct, and an ICO is a 22-byte
header wrapped around that PNG.

    python3 scripts/make-favicon.py
"""
import struct
import zlib
from pathlib import Path

# Run from anywhere: the output lands next to the repo, not next to the shell.
OUT = Path(__file__).resolve().parent.parent / "site" / "public"

BG = (24, 24, 27)        # --color-ink  #18181b
FG = (225, 228, 232)     # --code-fg    #e1e4e8
RADIUS = 22.0            # corner radius in the 100-unit space

# The V, traced clockwise from the outer top-left.
# Thick down-stroke, thin up-stroke: the letter reads as drawn rather than
# as two identical bars leaning together.
V = [
    (20, 25), (39, 25), (51, 60), (67, 25),
    (80, 25), (57, 79), (43, 79),
]

SS = 4  # supersampling factor per axis


def in_polygon(x, y, poly):
    inside = False
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        if (y1 > y) != (y2 > y):
            xin = x1 + (y - y1) / (y2 - y1) * (x2 - x1)
            if x < xin:
                inside = not inside
    return inside


def in_rounded_square(x, y, size=100.0, r=RADIUS):
    if x < 0 or y < 0 or x > size or y > size:
        return False
    cx = min(max(x, r), size - r)
    cy = min(max(y, r), size - r)
    dx, dy = x - cx, y - cy
    return dx * dx + dy * dy <= r * r


def render(size):
    """Return RGBA rows for a size x size image."""
    rows = []
    step = 100.0 / size
    for py in range(size):
        row = bytearray()
        for px in range(size):
            bg_hits = 0
            fg_hits = 0
            for sy in range(SS):
                for sx in range(SS):
                    x = (px + (sx + 0.5) / SS) * step
                    y = (py + (sy + 0.5) / SS) * step
                    if not in_rounded_square(x, y):
                        continue
                    bg_hits += 1
                    if in_polygon(x, y, V):
                        fg_hits += 1
            total = SS * SS
            if bg_hits == 0:
                row += bytes((0, 0, 0, 0))
                continue
            alpha = bg_hits / total
            # Coverage of the glyph relative to the square it sits on.
            t = fg_hits / bg_hits
            r = round(BG[0] + (FG[0] - BG[0]) * t)
            g = round(BG[1] + (FG[1] - BG[1]) * t)
            b = round(BG[2] + (FG[2] - BG[2]) * t)
            row += bytes((r, g, b, round(alpha * 255)))
        rows.append(bytes(row))
    return rows


def png_bytes(rows, size):
    raw = b"".join(b"\x00" + r for r in rows)  # filter type 0 per scanline

    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


def ico_bytes(png, size):
    # ICONDIR, then one ICONDIRENTRY, then the PNG verbatim. Storing a PNG
    # inside an ICO is legal since Vista and every current browser reads it.
    header = struct.pack("<HHH", 0, 1, 1)
    entry = struct.pack(
        "<BBBBHHII",
        0 if size >= 256 else size,  # width, 0 means 256
        0 if size >= 256 else size,  # height
        0,                           # palette size, 0 for truecolour
        0,                           # reserved
        1,                           # colour planes
        32,                          # bits per pixel
        len(png),
        len(header) + 16,
    )
    return header + entry + png


OUT.mkdir(parents=True, exist_ok=True)

png32 = png_bytes(render(32), 32)
(OUT / "favicon.ico").write_bytes(ico_bytes(png32, 32))

png180 = png_bytes(render(180), 180)
(OUT / "apple-touch-icon.png").write_bytes(png180)

for name in ("favicon.ico", "apple-touch-icon.png"):
    p = OUT / name
    print(f"{name:24} {p.stat().st_size:>7} bytes")
