#!/usr/bin/env python3
"""
img2puzzle.py — Convert a pixel-art PNG into PuzzleData JSON.

Usage:
    python3 img2puzzle.py <input.png> <output.json> [--size 100] [--colors 50]

Output format matches PuzzleData:
    { "gridSize": N, "palette": ["#rrggbb", ...], "pixels": "RLE string" }

Row convention: row 0 = visual BOTTOM of image (Y-up, matching Cocos Creator).
PIL reads top-to-bottom, so rows are flipped before RLE encoding.
Transparent pixels (alpha < 128) → index -1.
"""

import sys
import os
import json
import argparse

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '.pylib'))  # pip install --target=../.pylib Pillow

from PIL import Image
from collections import Counter


def rgba_to_hex(r, g, b):
    return f'#{r:02x}{g:02x}{b:02x}'


def color_distance_sq(c1, c2):
    return sum((a - b) ** 2 for a, b in zip(c1, c2))


def is_background(pixel, bg_threshold):
    """Transparent (alpha<128) or near-white beyond threshold → background."""
    if pixel[3] < 128:
        return True
    if bg_threshold > 0:
        return pixel[0] >= bg_threshold and pixel[1] >= bg_threshold and pixel[2] >= bg_threshold
    return False


def quantize_pixels(pixels, max_colors, bg_threshold=0):
    """Use Pillow's median-cut quantizer on opaque/non-background pixels only."""
    opaque = [(i, p) for i, p in enumerate(pixels) if not is_background(p, bg_threshold)]
    if not opaque:
        return [], [-1] * len(pixels)

    opaque_rgb = [p[:3] for _, p in opaque]

    temp = Image.new('RGB', (len(opaque_rgb), 1))
    temp.putdata(opaque_rgb)
    quantized = temp.quantize(colors=max_colors, method=Image.Quantize.MEDIANCUT)

    q_palette_flat = quantized.getpalette()[:max_colors * 3]
    palette = []
    for i in range(0, len(q_palette_flat), 3):
        palette.append((q_palette_flat[i], q_palette_flat[i+1], q_palette_flat[i+2]))

    q_indices = list(quantized.getdata())

    result = [-1] * len(pixels)
    for j, (orig_idx, _) in enumerate(opaque):
        result[orig_idx] = q_indices[j]

    used = set(i for i in result if i >= 0)
    if len(used) < len(palette):
        old_to_new = {}
        new_palette = []
        for old_idx in sorted(used):
            old_to_new[old_idx] = len(new_palette)
            new_palette.append(palette[old_idx])
        palette = new_palette
        result = [old_to_new.get(v, -1) for v in result]

    return palette, result


def rle_encode(indices):
    if not indices:
        return ''
    parts = []
    i = 0
    while i < len(indices):
        val = indices[i]
        count = 1
        while i + count < len(indices) and indices[i + count] == val:
            count += 1
        if count == 1:
            parts.append(str(val))
        else:
            parts.append(f'{val}:{count}')
        i += count
    return ','.join(parts)


def main():
    parser = argparse.ArgumentParser(description='Convert pixel-art PNG to PuzzleData JSON')
    parser.add_argument('input', help='Input PNG file')
    parser.add_argument('output', help='Output JSON file')
    parser.add_argument('--size', type=int, default=100, help='Grid size (square, default 100)')
    parser.add_argument('--colors', type=int, default=50, help='Max palette colors (default 50)')
    parser.add_argument('--bg', type=int, default=0,
                        help='Background removal: pixels with ALL channels >= this value become transparent. '
                             '0=off, 240=aggressive white removal (default 0)')
    args = parser.parse_args()

    img = Image.open(args.input).convert('RGBA')
    print(f'Original size: {img.size[0]}x{img.size[1]}')

    img = img.resize((args.size, args.size), Image.NEAREST)
    print(f'Resized to: {args.size}x{args.size}')

    pixels = list(img.getdata())

    if args.bg > 0:
        print(f'Background removal: RGB all >= {args.bg} → transparent')

    palette_rgb, indices = quantize_pixels(pixels, args.colors, bg_threshold=args.bg)

    # PIL row 0 = visual top (Y-down); game expects row 0 = visual bottom (Y-up).
    grid = args.size
    flipped = []
    for r in range(grid - 1, -1, -1):
        flipped.extend(indices[r * grid : (r + 1) * grid])
    indices = flipped

    palette_hex = [rgba_to_hex(*c) for c in palette_rgb]

    rle = rle_encode(indices)

    puzzle = {
        'gridSize': args.size,
        'palette': palette_hex,
        'pixels': rle,
    }

    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(puzzle, f, ensure_ascii=False, indent=2)

    total = args.size * args.size
    opaque = sum(1 for v in indices if v >= 0)
    print(f'Done: {len(palette_hex)} colors, {opaque}/{total} opaque pixels')
    print(f'RLE length: {len(rle)} chars')
    print(f'Output: {args.output}')


if __name__ == '__main__':
    main()
