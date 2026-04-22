import { Config } from '../common/Config';
import { ArrowMoveMode, ArrowRuntime } from './ArrowState';
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
 * 吃动态 runtime.coords 而不是 JSON 配置，
 * 原因：箭头飞起来后真实位置在变，点击判定必须跟随真实位置，
 * 否则玩家会点到"空地上 JSON 里的起始位置"。
 * 已 End 的箭头不接受点击（coords 可能还残留最后几格）。
 */
export function findArrowIndex(
    localX: number, localY: number,
    runtimes: readonly ArrowRuntime[],
    rows: number, cols: number,
): number {
    const { row, col } = pixelToGrid(localX, localY, rows, cols);
    for (let i = 0; i < runtimes.length; i++) {
        const rt = runtimes[i];
        if (rt.mode === ArrowMoveMode.End) continue;
        if (rt.coords.some(c => c[0] === row && c[1] === col)) {
            return i;
        }
    }
    return -1;
}