import { CellBrushEntry } from '../types/types';

/** 内存中的涂色操作记录器，维护有序操作序列。 */
export class PaintRecord {
    private readonly _history: CellBrushEntry[] = [];

    record(row: number, col: number, brushIndex: number): void {
        this._history.push({ row, col, brushIndex });
    }

    getHistory(): readonly CellBrushEntry[] {
        return this._history;
    }

    get length(): number {
        return this._history.length;
    }

    clear(): void {
        this._history.length = 0;
    }
}
