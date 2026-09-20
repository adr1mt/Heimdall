#!/usr/bin/env python3
"""Draw the application icon.

Writes `build/icon.png` (512x512, the one the Electron window uses) and
`build/icons/<n>x<n>.png` in the sizes the .deb package installs --
electron-builder reads the size off the file name, so the folder has to name
them exactly like that.

No dependencies: it draws the logo with supersampling and writes the PNG with
zlib. Run it by hand when the logo changes; the resulting PNGs are committed,
so building the app does not need Python.

    python3 scripts/make-icon.py
"""
import os
import struct
import zlib

SIZES = (512, 256, 128, 64, 48, 32, 16)
SS = 4                      # supersampling

# Brand blue (the same primary as the application theme).
TOP = (0x3B, 0x82, 0xF6)
BOT = (0x1D, 0x4E, 0xD8)
WHITE = (0xFF, 0xFF, 0xFF)
GREEN = (0x16, 0xA3, 0x4A)

def rounded_rect(x, y, w, h, r):
    def inside(px, py):
        if px < x or py < y or px > x + w or py > y + h:
            return False
        cx = min(max(px, x + r), x + w - r)
        cy = min(max(py, y + r), y + h - r)
        return (px - cx) ** 2 + (py - cy) ** 2 <= r * r
    return inside

def rect(x, y, w, h):
    return lambda px, py: x <= px <= x + w and y <= py <= y + h

def circle(cx, cy, r):
    return lambda px, py: (px - cx) ** 2 + (py - cy) ** 2 <= r * r

def segment(x1, y1, x2, y2, width):
    """Thick stroke with rounded ends."""
    dx, dy = x2 - x1, y2 - y1
    length2 = dx * dx + dy * dy
    half = width / 2
    def inside(px, py):
        t = ((px - x1) * dx + (py - y1) * dy) / length2
        t = min(max(t, 0.0), 1.0)
        qx, qy = x1 + t * dx, y1 + t * dy
        return (px - qx) ** 2 + (py - qy) ** 2 <= half * half
    return inside

def make_color_at(size):
    """Build the logo at the requested scale. The shapes are always described
    on a logical 512 canvas, so every size comes out of the same drawing."""
    w = size * SS
    def s(v):
        return v * w / 512

    body = rounded_rect(s(16), s(16), s(480), s(480), s(112))
    # H: two stems and a crossbar.
    h_left = rect(s(104), s(128), s(56), s(232))
    h_right = rect(s(248), s(128), s(56), s(232))
    h_bar = rect(s(104), s(216), s(200), s(56))
    badge = circle(s(374), s(374), s(104))
    badge_inner = circle(s(374), s(374), s(86))
    check_a = segment(s(336), s(376), s(364), s(406), s(30))
    check_b = segment(s(364), s(406), s(414), s(342), s(30))

    def color_at(px, py):
        """Return (r,g,b,a) for a point of the supersampled canvas."""
        if not body(px, py):
            return (0, 0, 0, 0)
        if badge(px, py):
            if badge_inner(px, py):
                if check_a(px, py) or check_b(px, py):
                    return GREEN + (255,)
                return WHITE + (255,)
            # separating ring between the badge and the blue background
            return WHITE + (255,)
        if h_left(px, py) or h_right(px, py) or h_bar(px, py):
            return WHITE + (255,)
        k = py / w
        return (
            round(TOP[0] + (BOT[0] - TOP[0]) * k),
            round(TOP[1] + (BOT[1] - TOP[1]) * k),
            round(TOP[2] + (BOT[2] - TOP[2]) * k),
            255,
        )
    return color_at


def render(size):
    color_at = make_color_at(size)
    rows = []
    n = SS * SS
    for y in range(size):
        row = bytearray()
        for x in range(size):
            r = g = b = a = 0
            for sy in range(SS):
                for sx in range(SS):
                    cr, cg, cb, ca = color_at(x * SS + sx, y * SS + sy)
                    # premultiplied so the edge does not smear
                    r += cr * ca
                    g += cg * ca
                    b += cb * ca
                    a += ca
            if a == 0:
                row += b"\x00\x00\x00\x00"
            else:
                row += bytes((round(r / a), round(g / a), round(b / a), round(a / n)))
        rows.append(bytes(row))
    return rows


def write_png(path, size, rows):
    raw = b"".join(b"\x00" + r for r in rows)
    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


if __name__ == "__main__":
    build = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "build"))
    icons = os.path.join(build, "icons")
    os.makedirs(icons, exist_ok=True)
    for size in SIZES:
        rows = render(size)
        write_png(os.path.join(icons, "%dx%d.png" % (size, size)), size, rows)
        if size == 512:
            write_png(os.path.join(build, "icon.png"), size, rows)
        print("written %dx%d" % (size, size))
