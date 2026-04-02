import { PuzzleData } from "../../types/types";


/**
 * 盘面数据
 */
export class BoardData {

    /** 网格列数 */
    readonly gridCols: number;
    /** 网格行数 */
    readonly gridRows: number;
    /** 调色板 hex 颜色数组 */
    readonly palette: string[];
    /** 每格的正确颜色编号 */
    readonly cellData: Int8Array;

    constructor(puzzleData: PuzzleData) {
        this.gridCols = puzzleData.gridSize;
        this.gridRows = puzzleData.gridSize;
        this.palette = puzzleData.palette;
        const flat = BoardData.rleDecode(puzzleData.pixels);
        const total = this.gridCols * this.gridRows;
        this.cellData = new Int8Array(total);
        for (let i = 0; i < total; i++) {
            this.cellData[i] = i < flat.length ? flat[i] : -1;
        }
    }

    /** 获取某格的正确颜色编号, -1=空格 */
    getBrushIndex(row: number, col: number): number {
        return this.cellData[row * this.gridCols + col];
    }
    /** 某格是否为空格（不需要涂色） */
    isEmpty(row: number, col: number): boolean {
        return this.cellData[row * this.gridCols + col] < 0;
    }
    /** RLE 解码："-1:8,3,0:3" → [-1,-1,-1,-1,-1,-1,-1,-1,3,0,0,0] */
    static rleDecode(encoded: string): number[] {
        if (!encoded) return [];
        const result: number[] = [];
        const parts = encoded.split(',');
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const colonIdx = part.indexOf(':');
            if (colonIdx === -1) {
                // 纯数字，如 "3"
                result.push(parseInt(part, 10));
            } else {
                // 值:次数，如 "-1:8"
                const value = parseInt(part.substring(0, colonIdx), 10);
                const count = parseInt(part.substring(colonIdx + 1), 10);
                for (let j = 0; j < count; j++) {
                    result.push(value);
                }
            }
        }
        return result;
    }
    /** hex 颜色 → 灰度值 (给底图用的, 后面 Phase 5 才会用到) */
    static hexToGray(hex: string): number {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
    }

}