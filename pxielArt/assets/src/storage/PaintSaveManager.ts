import { BoardData } from '../core/data/BoardData';
import { PaintEntry } from '../types/types';
import { PaintRecord } from './PaintRecord';
import { StorageService } from './StorageService';

/**
 * 涂色存档管理器 — 拥有运行时 paintMap / 进度计数 / 操作记录。
 *
 * - commitMatchedEntries: 触摸结束时同步写入内存，调度防抖落盘。
 * - forceFlush: 退出关卡或全图完成时立即写盘。
 */
export class PaintSaveManager {
    readonly levelId: string;
    readonly paintMap: number[];
    readonly brushTotalCounts: number[];
    readonly brushFilledCounts: number[];
    readonly record: PaintRecord;

    private _flushTimer: any = null;
    private _onAllComplete: (() => void) | null = null;

    constructor(levelId: string, boardData: BoardData) {
        this.levelId = levelId;
        this.record = new PaintRecord();

        const total = boardData.gridCols * boardData.gridRows;
        this.paintMap = new Array<number>(total).fill(-1);

        const paletteLen = boardData.palette.length;
        this.brushTotalCounts = new Array<number>(paletteLen).fill(0);
        this.brushFilledCounts = new Array<number>(paletteLen).fill(0);

        for (let i = 0; i < total; i++) {
            const bi = boardData.cellData[i];
            if (bi >= 0 && bi < paletteLen) {
                this.brushTotalCounts[bi]++;
            }
        }
    }

    set onAllComplete(cb: (() => void) | null) { this._onAllComplete = cb; }

    /**
     * 触摸结束后调用：将 PaintExecutor.entries 中 matched 的格子
     * 写入 paintMap + paintRecord，调度防抖落盘。
     */
    commitMatchedEntries(entries: readonly PaintEntry[], gridCols: number): void {
        let hasNew = false;
        for (let i = 0; i < entries.length; i++) {
            const e = entries[i];
            if (!e.matched) continue;
            const idx = e.row * gridCols + e.col;
            if (this.paintMap[idx] >= 0) continue;

            this.paintMap[idx] = e.brushIndex;
            this.record.record(e.row, e.col, e.brushIndex);
            if (this.brushFilledCounts[e.brushIndex] < this.brushTotalCounts[e.brushIndex]) {
                this.brushFilledCounts[e.brushIndex]++;
            }
            hasNew = true;
        }
        if (!hasNew) return;

        this._scheduleFlush();

        if (this._isAllComplete()) {
            StorageService.markLevelDone(this.levelId);
            this.forceFlush();
            this._onAllComplete?.();
        }
    }

    forceFlush(): void {
        this._cancelFlush();
        this._doFlush();
    }

    /* ── 内部 ── */

    private _scheduleFlush(): void {
        this._cancelFlush();
        this._flushTimer = setTimeout(() => {
            this._flushTimer = null;
            this._doFlush();
        }, 1000);
    }

    private _cancelFlush(): void {
        if (this._flushTimer !== null) {
            clearTimeout(this._flushTimer);
            this._flushTimer = null;
        }
    }

    private _doFlush(): void {
        const history = this.record.getHistory();
        if (!history.length) return;
        StorageService.savePaintRecord(this.levelId, history);
    }

    private _isAllComplete(): boolean {
        for (let i = 0; i < this.brushTotalCounts.length; i++) {
            if (this.brushTotalCounts[i] > 0 &&
                this.brushFilledCounts[i] < this.brushTotalCounts[i]) {
                return false;
            }
        }
        return true;
    }
}
