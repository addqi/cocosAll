import { sys } from 'cc';
import { CellBrushEntry } from '../types/types';
import { PaintRecordCodec } from './PaintRecordCodec';

const RECORD_PREFIX = 'pa_rec_';
const DONE_KEY = 'pa_done';

interface SavedRecord {
    v: number;
    r: number[];
    t: number;
}

export class StorageService {

    /* ── 涂色记录 ── */

    static savePaintRecord(levelId: string, history: readonly CellBrushEntry[]): void {
        const data: SavedRecord = {
            v: 1,
            r: PaintRecordCodec.encode(history),
            t: Date.now(),
        };
        sys.localStorage.setItem(RECORD_PREFIX + levelId, JSON.stringify(data));
    }

    static loadPaintRecord(levelId: string): CellBrushEntry[] {
        const raw = sys.localStorage.getItem(RECORD_PREFIX + levelId);
        if (!raw) return [];
        try {
            const saved: SavedRecord = JSON.parse(raw);
            if (saved && Array.isArray(saved.r) && saved.r.length) {
                return PaintRecordCodec.decode(saved.r);
            }
        } catch { /* corrupted — treat as empty */ }
        return [];
    }

    static hasPaintRecord(levelId: string): boolean {
        return !!sys.localStorage.getItem(RECORD_PREFIX + levelId);
    }

    /* ── 关卡完成 ── */

    static markLevelDone(levelId: string): void {
        const list = this._loadDoneList();
        if (list.includes(levelId)) return;
        list.push(levelId);
        sys.localStorage.setItem(DONE_KEY, JSON.stringify(list));
    }

    static isLevelDone(levelId: string): boolean {
        return this._loadDoneList().includes(levelId);
    }

    private static _loadDoneList(): string[] {
        const raw = sys.localStorage.getItem(DONE_KEY);
        if (!raw) return [];
        try {
            const list = JSON.parse(raw);
            return Array.isArray(list) ? list : [];
        } catch { return []; }
    }
}
