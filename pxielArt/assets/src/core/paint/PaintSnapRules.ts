import { CellBrushEntry, CellPosition } from '../../types/types';
import { BoardData } from '../data/BoardData';
import { PixelBuffer } from '../PixelBuffer';

/**
 * 涂色命中与路径规则，对齐 G15_FBase：
 * PointerSnapPaintCell / CellHitTest / CollectPaintCells / PaintLogic 过滤逻辑
 */

export function cellFilled(board: BoardData, brush: PixelBuffer, row: number, col: number): boolean {
    if (board.isEmpty(row, col)) return true;
    return brush.getAlpha(row, col) === 255;
}

function cellCenterLocal(
    row: number,
    col: number,
    gridRows: number,
    totalW: number,
    totalH: number,
    cellW: number,
    cellH: number,
): { cx: number; cy: number } {
    const cx = -totalW * 0.5 + (col + 0.5) * cellW;
    const cy = totalH * 0.5 - (gridRows - 1 - row + 0.5) * cellH;
    return { cx, cy };
}

function tryExpandHit(
    adjRow: number,
    adjCol: number,
    localX: number,
    localY: number,
    halfW: number,
    halfH: number,
    expand: number,
    gridRows: number,
    gridCols: number,
    totalW: number,
    totalH: number,
    cellW: number,
    cellH: number,
    brushIndex: number,
    board: BoardData,
): CellPosition | null {
    if (adjRow < 0 || adjRow >= gridRows || adjCol < 0 || adjCol >= gridCols) return null;
    if (board.getBrushIndex(adjRow, adjCol) !== brushIndex) return null;
    const { cx, cy } = cellCenterLocal(adjRow, adjCol, gridRows, totalW, totalH, cellW, cellH);
    if (localX < cx - halfW - expand) return null;
    if (localX > cx + halfW + expand) return null;
    if (localY < cy - halfH - expand) return null;
    if (localY > cy + halfH + expand) return null;
    return { row: adjRow, col: adjCol };
}

export class PaintSnapSession {
    private _lastRawRow = -1;
    private _lastRawCol = -1;
    private _snappedOnRawCell = false;

    reset(): void {
        this._lastRawRow = -1;
        this._lastRawCol = -1;
        this._snappedOnRawCell = false;
    }

    /**
     * G15 PointerSnapPaintCell：正确格直中；错误格四向扩展吸附未填正确格；滑动中缩小错误格命中盒
     */
    snap(
        localX: number,
        localY: number,
        scale: number,
        brushIndex: number,
        gridCols: number,
        gridRows: number,
        cellW: number,
        cellH: number,
        board: BoardData,
        brush: PixelBuffer,
        correctCellExpandPx: number,
        paintStarted: boolean,
    ): CellPosition | null {
        if (!paintStarted) {
            this._snappedOnRawCell = false;
            this._lastRawRow = -1;
            this._lastRawCol = -1;
        }

        const totalW = gridCols * cellW;
        const totalH = gridRows * cellH;
        const col = Math.floor((localX + totalW * 0.5) / cellW);
        const row = gridRows - 1 - Math.floor((totalH * 0.5 - localY) / cellH);
        if (col < 0 || col >= gridCols || row < 0 || row >= gridRows) return null;

        if (row !== this._lastRawRow || col !== this._lastRawCol) {
            const wasSnapped = this._snappedOnRawCell;
            this._snappedOnRawCell = false;
            this._lastRawRow = row;
            this._lastRawCol = col;
            if (wasSnapped && !paintStarted && board.getBrushIndex(row, col) !== brushIndex) return null;
        }

        if (board.getBrushIndex(row, col) === brushIndex) return { row, col };

        const halfW = cellW * 0.5;
        const halfH = cellH * 0.5;
        const expandRaw = correctCellExpandPx / Math.max(scale, 0.0001);
        const expand = Math.min(expandRaw, halfW * 0.4, halfH * 0.4);

        let isExpandHit = false;
        const tryNeighbor = (adjRow: number, adjCol: number): CellPosition | null => {
            const p = tryExpandHit(
                adjRow,
                adjCol,
                localX,
                localY,
                halfW,
                halfH,
                expand,
                gridRows,
                gridCols,
                totalW,
                totalH,
                cellW,
                cellH,
                brushIndex,
                board,
            );
            if (!p) return null;
            isExpandHit = true;
            if (!cellFilled(board, brush, p.row, p.col)) {
                this._snappedOnRawCell = true;
                return p;
            }
            return null;
        };

        const nbs: [number, number][] = [
            [row - 1, col],
            [row + 1, col],
            [row, col - 1],
            [row, col + 1],
        ];
        for (let i = 0; i < nbs.length; i++) {
            const hit = tryNeighbor(nbs[i][0], nbs[i][1]);
            if (hit) return hit;
        }

        if (paintStarted && isExpandHit) {
            const { cx, cy } = cellCenterLocal(row, col, gridRows, totalW, totalH, cellW, cellH);
            const sL = cx - halfW + expand;
            const sR = cx + halfW - expand;
            const sB = cy - halfH + expand;
            const sT = cy + halfH - expand;
            if (sR <= sL || sT <= sB) return null;
            if (localX < sL || localX > sR || localY < sB || localY > sT) return null;
        }

        if (this._snappedOnRawCell) return null;
        return { row, col };
    }
}

/**
 * G15 CollectPaintCells：Amanatides & Woo DDA；跳过空格、已填(alpha=255)；与 CellConverter 行列约定一致
 */
export function collectPaintCellsDDA(
    hasFrom: boolean,
    fromLocalX: number,
    fromLocalY: number,
    toLocalX: number,
    toLocalY: number,
    brushIndex: number,
    gridCols: number,
    gridRows: number,
    cellW: number,
    cellH: number,
    board: BoardData,
    brush: PixelBuffer,
    out: CellBrushEntry[],
): CellBrushEntry[] {
    out.length = 0;
    const halfW = gridCols * cellW * 0.5;
    const halfH = gridRows * cellH * 0.5;

    const lx0 = hasFrom ? fromLocalX : toLocalX;
    const ly0 = hasFrom ? fromLocalY : toLocalY;

    const cf0 = (lx0 + halfW) / cellW;
    const rf0 = (halfH - ly0) / cellH;
    const cf1 = (toLocalX + halfW) / cellW;
    const rf1 = (halfH - toLocalY) / cellH;

    let col = Math.floor(cf0);
    let rowG = Math.floor(rf0);
    const endCol = Math.floor(cf1);
    const endRowG = Math.floor(rf1);

    const dc = cf1 - cf0;
    const dr = rf1 - rf0;
    const stepC = dc > 0 ? 1 : dc < 0 ? -1 : 0;
    const stepR = dr > 0 ? 1 : dr < 0 ? -1 : 0;

    const EPS = 1e-12;
    const absDc = Math.abs(dc);
    const absDr = Math.abs(dr);
    const tDeltaC = absDc > EPS ? 1 / absDc : 1e30;
    const tDeltaR = absDr > EPS ? 1 / absDr : 1e30;

    let tMaxC =
        stepC > 0 ? (col + 1 - cf0) * tDeltaC : stepC < 0 ? (cf0 - col) * tDeltaC : 1e30;
    let tMaxR =
        stepR > 0 ? (rowG + 1 - rf0) * tDeltaR : stepR < 0 ? (rf0 - rowG) * tDeltaR : 1e30;

    const tryPush = (rG: number, c: number): void => {
        const r = gridRows - 1 - rG;
        if (r < 0 || r >= gridRows || c < 0 || c >= gridCols) return;
        for (let i = 0; i < out.length; i++) {
            if (out[i].row === r && out[i].col === c) return;
        }
        if (board.isEmpty(r, c)) return;
        if (brush.getAlpha(r, c) === 255) return;
        out.push({ row: r, col: c, brushIndex });
    };

    tryPush(rowG, col);

    const maxSteps = Math.abs(endCol - col) + Math.abs(endRowG - rowG) + 2;
    for (let s = 0; (col !== endCol || rowG !== endRowG) && s < maxSteps; s++) {
        if (tMaxC < tMaxR) {
            col += stepC;
            tMaxC += tDeltaC;
        } else if (tMaxR < tMaxC) {
            rowG += stepR;
            tMaxR += tDeltaR;
        } else {
            col += stepC;
            rowG += stepR;
            tMaxC += tDeltaC;
            tMaxR += tDeltaR;
        }
        tryPush(rowG, col);
    }

    return out;
}

/** G15 PaintLogic：路径只保留与画笔索引一致的格，snap 目标格始终保留 */
export function filterPaintPathToBrush(
    pending: CellBrushEntry[],
    snapPos: CellPosition,
    board: BoardData,
    brushIndex: number,
): void {
    for (let i = pending.length - 1; i >= 0; i--) {
        const p = pending[i];
        if (board.getBrushIndex(p.row, p.col) !== brushIndex && (p.row !== snapPos.row || p.col !== snapPos.col)) {
            pending[i] = pending[pending.length - 1];
            pending.length--;
        }
    }
}

/** G15 CellHitTest：吸附到未填且答案与当前笔一致 */
export function cellHitAllowsDraw(
    pos: CellPosition | null,
    board: BoardData,
    brush: PixelBuffer,
    brushIndex: number,
): boolean {
    if (!pos) return false;
    if (cellFilled(board, brush, pos.row, pos.col)) return false;
    const idx = board.getBrushIndex(pos.row, pos.col);
    return idx >= 0 && idx === brushIndex;
}
