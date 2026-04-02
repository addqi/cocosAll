import { CellBrushEntry, PaintEntry } from "../../types/types";
import { BoardData } from "../data/BoardData";
import { BrushState } from "../data/BrushState";
import { PixelBuffer } from "../PixelBuffer";






export class PaintExecutor {

    private _brushPixels: PixelBuffer;
    private _boardData: BoardData;
    private _boardPixels: PixelBuffer | null;
    private _digitPixels: PixelBuffer | null;
    private _brushState: BrushState;

    /** 本次触摸生命周期内的涂色记录 */
    readonly entries: PaintEntry[] = [];
    /** 脏标记：有写入后为 true，flush 后重置 */
    brushDirty = false;
    boardDirty = false;
    digitDirty = false;

    /**
     * @param brushPixels  Brush 层像素（必须）
     * @param boardPixels  Board 层像素（Phase 2 传 null，Phase 5 再传）
     * @param digitPixels  Digit 层像素（Phase 2 传 null，Phase 5 再传）
     * @param boardData 盘面数据
     * @param brushState 画笔状态
     */
    constructor(
        brushPixels: PixelBuffer,
        boardPixels: PixelBuffer | null,
        digitPixels: PixelBuffer | null,
        boardData: BoardData,
        brushState: BrushState,
    ) {
        this._brushPixels = brushPixels;
        this._boardPixels = boardPixels;
        this._digitPixels = digitPixels;
        this._boardData = boardData;
        this._brushState = brushState;
    }
    /** 每次 touchStart 时清空记录 */
    clearEntries(): void {
        this.entries.length = 0;
    }

    paintCells(cells: CellBrushEntry[]): boolean[] {
        const results: boolean[] = [];
        const palette = this._brushState.palette;
        for (let i = 0; i < cells.length; i++) {
            const { row, col, brushIndex } = cells[i];
            // 1. 查正确答案
            const correctIndex = this._boardData.getBrushIndex(row, col);
            // 2. 判断匹配
            const matched = correctIndex >= 0 && correctIndex === brushIndex;
            // 3. 获取颜色
            const [r, g, b] = this._brushState.getRGB(brushIndex);
            // 4. 写 Brush 层
            const a = matched ? 255 : 100;
            this._brushPixels.setPixel(row, col, r, g, b, a);
            this.brushDirty = true;
            // 5. 如果涂对了，清除 Board 层和 Digit 层对应像素
            if (matched) {
                if (this._boardPixels) {
                    this._boardPixels.setPixel(row, col, 0, 0, 0, 0);
                    this.boardDirty = true;
                }
                if (this._digitPixels) {
                    this._digitPixels.setPixel(row, col, 0, 0, 0, 0);
                    this.digitDirty = true;
                }
            }
            // 6. 记录
            this.entries.push({ row, col, brushIndex, matched });
            results.push(matched);
        }
        return results;
    }

    /** 重置 dirty 标记（flush 之后调用） */
    resetDirty(): void {
        this.brushDirty = false;
        this.boardDirty = false;
        this.digitDirty = false;
    }
}