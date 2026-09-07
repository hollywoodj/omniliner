#!/usr/bin/env python3
"""Rasterize build/icon.svg into PNGs for GNOME/Spotlight (no extra deps)."""
from __future__ import annotations

import math
import os
import struct
import sys
import zlib

ORANGE = (0xE8, 0x77, 0x2E, 255)
WHITE = (255, 255, 255, 255)


def write_png(path: str, w: int, h: int, pixels: bytes) -> None:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(
            ">I", zlib.crc32(tag + data) & 0xFFFFFFFF
        )

    raw = bytearray()
    stride = w * 4
    for y in range(h):
        raw.append(0)
        raw.extend(pixels[y * stride : (y + 1) * stride])
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", ihdr))
        f.write(chunk(b"IDAT", zlib.compress(bytes(raw), 9)))
        f.write(chunk(b"IEND", b""))


def rounded_rect(s: int, x: float, y: float) -> bool:
    # SVG: rect rx="7" on 32x32 → scale to s.
    pad = 0.0
    x0, y0, x1, y1 = pad, pad, s - 1 - pad, s - 1 - pad
    r = 7.0 / 32.0 * s
    if x0 + r <= x <= x1 - r and y0 <= y <= y1:
        return True
    if y0 + r <= y <= y1 - r and x0 <= x <= x1:
        return True
    for cx, cy in (
        (x0 + r, y0 + r),
        (x1 - r, y0 + r),
        (x0 + r, y1 - r),
        (x1 - r, y1 - r),
    ):
        if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
            return True
    return False


def dist_to_segment(px: float, py: float, x1: float, y1: float, x2: float, y2: float) -> float:
    dx, dy = x2 - x1, y2 - y1
    length2 = dx * dx + dy * dy
    if length2 == 0:
        return math.hypot(px - x1, py - y1)
    t = max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / length2))
    return math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))


def render(s: int) -> bytes:
    # SVG lines: M8 9h16, M11 16h13, M14 23h10, stroke-width 2.4, round caps.
    scale = s / 32.0
    stroke = 2.4 * scale
    lines = (
        (8.0, 9.0, 24.0, 9.0),
        (11.0, 16.0, 24.0, 16.0),
        (14.0, 23.0, 24.0, 23.0),
    )
    px = bytearray(s * s * 4)
    for y in range(s):
        for x in range(s):
            cx, cy = x + 0.5, y + 0.5
            if not rounded_rect(s, cx, cy):
                continue
            color = ORANGE
            for x1, y1, x2, y2 in lines:
                if dist_to_segment(cx, cy, x1 * scale, y1 * scale, x2 * scale, y2 * scale) <= stroke / 2:
                    color = WHITE
                    break
            i = (y * s + x) * 4
            px[i : i + 4] = bytes(color)
    return bytes(px)


def main() -> int:
    out_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "build"
    )
    for size in (16, 32, 48, 64, 128, 256, 512):
        write_png(os.path.join(out_dir, f"icon-{size}.png"), size, size, render(size))
    write_png(os.path.join(out_dir, "icon.png"), 128, 128, render(128))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
