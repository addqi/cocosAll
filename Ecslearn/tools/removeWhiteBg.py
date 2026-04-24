"""
白底 → 透明（洪水填充版）
===============================================
用途：把四角/边缘连通的白色背景扣成 alpha=0，保留图中所有亮色细节。
相比"RGB>阈值直接置零"，对含有亮白高光/中间亮色的图不会误伤。

核心算法：
  1. 从图像四角的像素开始，用 BFS 扩散
  2. 只要相邻像素 "足够白"（RGB 均 >= threshold）且未访问过，就入队并标记
  3. 所有被标记的像素 alpha=0；其他像素原样保留
  4. 边界上遗留的半透明毛刺用可选的羽化半径柔化

用法：
    python3 tools/removeWhiteBg.py <input.png> <output.png> \
        [--threshold 240] [--resize 128] [--feather 1]

示例：
    python3 tools/removeWhiteBg.py \
        assets/resources/Gemini_Generated_Image_50vbv50vbv50vbv5.png \
        assets/resources/coin.png \
        --threshold 235 --resize 128 --feather 1
"""
from __future__ import annotations

import argparse
import sys
from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter


def flood_fill_alpha(img: Image.Image, threshold: int) -> Image.Image:
    """从四角洪水填充"白"区域，抠成 alpha=0。返回新的 RGBA 图。"""
    if img.mode != "RGBA":
        img = img.convert("RGBA")

    w, h = img.size
    px = img.load()
    assert px is not None

    visited = bytearray(w * h)
    q: deque[tuple[int, int]] = deque()

    def is_white(r: int, g: int, b: int) -> bool:
        return r >= threshold and g >= threshold and b >= threshold

    # 四角 + 边缘上每个白色像素作为种子
    seeds: list[tuple[int, int]] = []
    for x in range(w):
        seeds.append((x, 0))
        seeds.append((x, h - 1))
    for y in range(h):
        seeds.append((0, y))
        seeds.append((w - 1, y))

    for sx, sy in seeds:
        idx = sy * w + sx
        if visited[idx]:
            continue
        r, g, b, _ = px[sx, sy]
        if is_white(r, g, b):
            visited[idx] = 1
            q.append((sx, sy))

    while q:
        x, y = q.popleft()
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            nx, ny = x + dx, y + dy
            if nx < 0 or ny < 0 or nx >= w or ny >= h:
                continue
            nidx = ny * w + nx
            if visited[nidx]:
                continue
            r, g, b, _ = px[nx, ny]
            if is_white(r, g, b):
                visited[nidx] = 1
                q.append((nx, ny))

    # 应用 alpha 掩码
    for y in range(h):
        row_base = y * w
        for x in range(w):
            if visited[row_base + x]:
                r, g, b, _ = px[x, y]
                px[x, y] = (r, g, b, 0)

    return img


def feather_alpha(img: Image.Image, radius: float) -> Image.Image:
    """对 alpha 通道做轻度高斯模糊，软化硬边。"""
    if radius <= 0:
        return img
    r, g, b, a = img.split()
    a = a.filter(ImageFilter.GaussianBlur(radius=radius))
    return Image.merge("RGBA", (r, g, b, a))


def main() -> int:
    ap = argparse.ArgumentParser(description="Flood-fill white background to transparent.")
    ap.add_argument("input", type=Path, help="input PNG path")
    ap.add_argument("output", type=Path, help="output PNG path")
    ap.add_argument("--threshold", type=int, default=240,
                    help="white threshold (RGB each >=, default 240)")
    ap.add_argument("--resize", type=int, default=0,
                    help="resize to NxN after keying (0 = no resize)")
    ap.add_argument("--feather", type=float, default=0,
                    help="gaussian blur radius on alpha edge (0 = off)")
    args = ap.parse_args()

    if not args.input.exists():
        print(f"input not found: {args.input}", file=sys.stderr)
        return 1

    img = Image.open(args.input)
    print(f"[in]  {args.input.name}  {img.size}  mode={img.mode}")

    img = flood_fill_alpha(img, args.threshold)
    img = feather_alpha(img, args.feather)

    if args.resize > 0:
        img = img.resize((args.resize, args.resize), Image.LANCZOS)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    img.save(args.output, "PNG", optimize=True)
    print(f"[out] {args.output.name}  {img.size}  threshold={args.threshold} "
          f"resize={args.resize} feather={args.feather}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
