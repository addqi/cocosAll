import { CellBrushEntry } from '../types/types';

/**
 * 涂色记录位压缩编解码。
 *
 * 21-bit 整数: row(7) | col(7) | brushIndex(7)
 * 支持最大 128×128 网格 + 128 色调色板。
 */
export class PaintRecordCodec {
    static encode(history: readonly CellBrushEntry[]): number[] {
        const out = new Array<number>(history.length);
        for (let i = 0; i < history.length; i++) {
            const e = history[i];
            out[i] = (e.row << 14) | (e.col << 7) | e.brushIndex;
        }
        return out;
    }

    static decode(encoded: readonly number[]): CellBrushEntry[] {
        const out = new Array<CellBrushEntry>(encoded.length);
        for (let i = 0; i < encoded.length; i++) {
            const v = encoded[i];
            out[i] = {
                row: (v >> 14) & 0x7f,
                col: (v >> 7) & 0x7f,
                brushIndex: v & 0x7f,
            };
        }
        return out;
    }
}
