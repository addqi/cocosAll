import { ToolType, ToolParams } from '../../config/ToolConfig';
import { CellBrushEntry } from '../../types/types';
import { BoardData } from '../data/BoardData';
import { floodFill } from '../algorithm/FloodFill';

type FilledFn = (row: number, col: number) => boolean;

export class ToolExecutor {

    /**
     * 魔术棒：从 (row,col) FloodFill 同色相邻未填格，用正确颜色批量涂色。
     */
    static magicWand(
        row: number, col: number,
        boardData: BoardData,
        isFilled: FilledFn,
    ): CellBrushEntry[] {
        const brushIdx = boardData.getBrushIndex(row, col);
        if (brushIdx < 0) return [];
        if (isFilled(row, col)) return [];
        return floodFill(row, col, brushIdx, boardData, isFilled);
    }

    /**
     * 炸弹：以 (row,col) 为圆心，bombDiameter 为直径的圆内，
     * 所有未填充非透明格子用正确颜色涂上。
     */
    static bomb(
        row: number, col: number,
        boardData: BoardData,
        isFilled: FilledFn,
    ): CellBrushEntry[] {
        if (isFilled(row, col)) return [];

        const radius = ToolParams.bombDiameter * 0.5;
        const r2 = radius * radius;
        const half = Math.ceil(radius);
        const rows = boardData.gridRows;
        const cols = boardData.gridCols;

        const rMin = Math.max(0, row - half);
        const rMax = Math.min(rows - 1, row + half);
        const cMin = Math.max(0, col - half);
        const cMax = Math.min(cols - 1, col + half);

        const pending: CellBrushEntry[] = [];
        for (let r = rMin; r <= rMax; r++) {
            const dr = r - row;
            for (let c = cMin; c <= cMax; c++) {
                const dc = c - col;
                if (dr * dr + dc * dc > r2) continue;
                if (isFilled(r, c)) continue;
                const bi = boardData.getBrushIndex(r, c);
                if (bi < 0) continue;
                pending.push({ row: r, col: c, brushIndex: bi });
            }
        }
        return pending;
    }

    /**
     * 放大镜：找当前 brushIndex 对应的第一个未涂连通区域。
     * 从上到下、左到右扫描 → FloodFill 扩展。
     * 若当前色已全涂完，返回空（调用方负责自动切画笔）。
     */
    static magnifierFind(
        brushIndex: number,
        boardData: BoardData,
        isFilled: FilledFn,
    ): CellBrushEntry[] {
        const rows = boardData.gridRows;
        const cols = boardData.gridCols;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (boardData.getBrushIndex(r, c) !== brushIndex) continue;
                if (isFilled(r, c)) continue;
                return floodFill(r, c, brushIndex, boardData, isFilled);
            }
        }
        return [];
    }
}
