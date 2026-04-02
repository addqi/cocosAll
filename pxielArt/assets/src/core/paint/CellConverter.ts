import { CellPosition } from "../../types/types";


export class CellConverter {
    /** 网格列数 */
    private _gridCols: number;
    /** 网格行数 */
    private _gridRows: number;
    /** 每个格子在屏幕上的显示尺寸（像素） */
    private _cellWidth: number;
    /** 每个格子在屏幕上的显示尺寸（像素） */
    private _cellHeight: number;
    /** 总宽度（像素） */
    private _totalWidth: number;
    /** 总高度（像素） */
    private _totalHeight: number;

    /** 
     * @param gridCols 网格列数
     * @param gridRows 网格行数
     * @param cellWidth 每个格子在屏幕上的显示尺寸（像素）
     * @param cellHeight 每个格子在屏幕上的显示尺寸（像素）
     */
    constructor(
        gridCols: number,
        gridRows: number,
        cellWidth: number,
        cellHeight: number,
    ) {
        this._gridCols = gridCols;
        this._gridRows = gridRows;
        this._cellWidth = cellWidth;
        this._cellHeight = cellHeight;
        this._totalWidth = gridCols * cellWidth;
        this._totalHeight = gridRows * cellHeight;
    }
  /**
     * 屏幕触摸坐标 → 格子行列
     * @param localX   触摸点在内容节点的本地坐标 X
     * @param localY   触摸点在内容节点的本地坐标 Y
     * @param offsetX  内容偏移 X（Phase 2 阶段传 0）
     * @param offsetY  内容偏移 Y（Phase 2 阶段传 0）
     * @param scale    当前缩放值（Phase 2 阶段传 1）
     * @returns 格子位置，越界返回 null
     */
  pointerToCell(localX: number, localY: number, offsetX: number, offsetY: number, scale: number): CellPosition | null {
    const x = (localX - offsetX) / scale;
    const y = (localY - offsetY) / scale;
    const col = Math.floor((x + this._totalWidth / 2) / this._cellWidth);
    const row = this._gridRows - 1 - Math.floor((this._totalHeight / 2 - y) / this._cellHeight);
    if (col < 0 || col >= this._gridCols || row < 0 || row >= this._gridRows) return null;
    return { row, col };
}

    /** 更新网格尺寸（切换关卡时调用） */
    updateGridSize(cols: number, rows: number,cellWidth: number,cellHeight: number): void {
        this._gridCols = cols;
        this._gridRows = rows;
        this._cellWidth = cellWidth;
        this._cellHeight = cellHeight;
        this._totalWidth = cols * this._cellWidth;
        this._totalHeight = rows * this._cellHeight;
    }
}