import { Config } from '../common/Config';
import { ArrowData } from './LevelData';

/** 像素坐标 */
export interface Pixel {
    x: number;
    y: number;
}

/**
 * 格子坐标 → 像素坐标（棋盘居中于 (0, 0)）
 * @param row  1-based 行号，从上往下
 * @param col  1-based 列号，从左往右
 * @param rows 棋盘总行数
 * @param cols 棋盘总列数
 */
export function gridToPixel(
    row: number, col: number, rows: number, cols: number,
): Pixel {
    const centerRow = (rows + 1) / 2;
    const centerCol  = (cols + 1) / 2;
    return {
        x: (col - centerCol) * Config.gap,
        y: (centerRow - row) * Config.gap
    };
}

/**
 * 像素坐标 → 格子坐标（最近的格子，可能越界）
 */
export function pixelToGrid(
    x: number, y: number, rows: number, cols: number,
): { row: number; col: number } {
    const centerRow = (rows + 1) / 2;
    const centerCol = (cols + 1) / 2;
    return {
        row: Math.round(centerRow - y / Config.gap),
        col: Math.round(x / Config.gap + centerCol),
    };
}

/** 判断格子坐标是否在棋盘范围内 */
export function isInsideBoard(row: number, col: number, rows: number, cols: number): boolean {
    return row >= 1 && row <= rows && col >= 1 && col <= cols;
}

/**
 * 根据本地像素坐标查找被点中的箭头索引。
 * 找不到返回 -1。
 *
 * 注：这里吃 ArrowData[]（静态配置）而不是 ArrowRuntime[]。
 * 08 章箭头尚未移动，配置和运行时的占位格子完全一致。
 * 若 09 章后需要按动态 runtime.coords 判定，再调整签名。
 */
export function findArrowIndex(
    localX: number, localY: number,
    arrows: readonly ArrowData[],
    rows: number, cols: number,
): number {
    const { row, col } = pixelToGrid(localX, localY, rows, cols);
    for (let i = 0; i < arrows.length; i++) {
        if (arrows[i].coords.some(c => c[0] === row && c[1] === col)) {
            return i;
        }
    }
    return -1;
}
