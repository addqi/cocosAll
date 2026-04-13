"""
Sprite Sheet → 独立帧图片切割工具

usage: python3 tools/splitSheet.py

将 resources 目录下的 sprite sheet PNG 按 frameSize 切割为
独立帧图片，输出到 frameDir 子目录。
"""

from PIL import Image
import os
import shutil

RESOURCES = os.path.join(os.path.dirname(__file__), '..', 'assets', 'resources')

FRAME_SIZE = 192

SHEETS = [
    # (sheet_path_relative_to_resources, output_dir_relative_to_resources)
    ('Archer/Archer_Idle.png',   'Archer/idle'),
    ('Archer/Archer_Run.png',    'Archer/run'),
    ('Archer/Archer_Shoot.png',  'Archer/shoot'),
    ('Warrior/Warrior_Idle.png', 'Warrior/idle'),
    ('Warrior/Warrior_Run.png',  'Warrior/run'),
    ('Warrior/Warrior_Attack.png', 'Warrior/attack'),
]


def split_sheet(src_path: str, out_dir: str, fw: int, fh: int):
    img = Image.open(src_path)
    cols = img.width // fw
    rows = img.height // fh

    os.makedirs(out_dir, exist_ok=True)

    idx = 0
    for r in range(rows):
        for c in range(cols):
            box = (c * fw, r * fh, (c + 1) * fw, (r + 1) * fh)
            frame = img.crop(box)
            if frame.getbbox() is None:
                continue
            out_path = os.path.join(out_dir, f'frame_{idx:02d}.png')
            frame.save(out_path, optimize=True, compress_level=9)
            idx += 1

    print(f'  {os.path.basename(src_path)} → {idx} frames → {out_dir}')
    return idx


def main():
    base = os.path.abspath(RESOURCES)
    total = 0

    for sheet_rel, dir_rel in SHEETS:
        src = os.path.join(base, sheet_rel)
        dst = os.path.join(base, dir_rel)

        if not os.path.isfile(src):
            print(f'  SKIP (not found): {sheet_rel}')
            continue

        total += split_sheet(src, dst, FRAME_SIZE, FRAME_SIZE)

    print(f'\nDone. {total} frames total.')


if __name__ == '__main__':
    main()
