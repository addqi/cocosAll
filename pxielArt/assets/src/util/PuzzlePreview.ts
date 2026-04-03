import { ImageAsset, SpriteFrame, Texture2D } from 'cc';
import { PuzzleData } from '../types/types';
import { BoardData } from '../core/data/BoardData';

/**
 * PuzzleData → 缩略图 SpriteFrame。
 *
 * 默认灰度模式（与 BoardLayer 同算法）：hexToGray → 映射到 90~200 区间。
 * 传入 paintedSet 时，已涂对的格子叠真实颜色，其余保持灰度。
 */
export class PuzzlePreview {

    /**
     * @param puzzle    谜题数据
     * @param paintedSet 已正确涂色的 flat index 集合（可选，后续存档功能用）
     */
    static createSpriteFrame(puzzle: PuzzleData, paintedSet?: ReadonlySet<number>): SpriteFrame {
        const size = puzzle.gridSize;
        const flat = BoardData.rleDecode(puzzle.pixels);
        const total = size * size;
        const rgba = new Uint8Array(total * 4);

        for (let i = 0; i < total; i++) {
            const brushIdx = i < flat.length ? flat[i] : -1;
            const off = i * 4;

            if (brushIdx < 0 || brushIdx >= puzzle.palette.length) {
                rgba[off] = rgba[off + 1] = rgba[off + 2] = rgba[off + 3] = 0;
                continue;
            }

            const hex = puzzle.palette[brushIdx];

            if (paintedSet && paintedSet.has(i)) {
                rgba[off]     = parseInt(hex.slice(1, 3), 16);
                rgba[off + 1] = parseInt(hex.slice(3, 5), 16);
                rgba[off + 2] = parseInt(hex.slice(5, 7), 16);
            } else {
                const gray = BoardData.hexToGray(hex);
                const v = Math.round(90 + (gray / 255) * 110);
                rgba[off] = rgba[off + 1] = rgba[off + 2] = v;
            }
            rgba[off + 3] = 255;
        }

        const flipped = new Uint8Array(total * 4);
        const stride = size * 4;
        for (let r = 0; r < size; r++) {
            flipped.set(
                rgba.subarray((size - 1 - r) * stride, (size - r) * stride),
                r * stride,
            );
        }

        const img = new ImageAsset({
            _data: flipped,
            _compressed: false,
            width: size,
            height: size,
            format: Texture2D.PixelFormat.RGBA8888,
        });
        const tex = new Texture2D();
        tex.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
        tex.image = img;

        const sf = new SpriteFrame();
        sf.texture = tex;
        return sf;
    }
}
