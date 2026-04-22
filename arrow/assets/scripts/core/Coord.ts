import { Config } from '../common/Config';

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