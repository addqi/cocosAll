import { sys } from 'cc';
import { CellBrushEntry } from '../types/types';
import { PaintRecordCodec } from './PaintRecordCodec';

const RECORD_PREFIX = 'pa_rec_';
const DONE_KEY = 'pa_done';
const TOOL_KEY = 'pa_tool_counts';

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

    /* ── 道具次数（全局） ── */

    static loadToolCounts(): Map<number, number> {
        const map = new Map<number, number>();
        const raw = sys.localStorage.getItem(TOOL_KEY);
        if (!raw) return map;
        try {
            const obj = JSON.parse(raw);
            for (const k of Object.keys(obj)) {
                map.set(Number(k), obj[k]);
            }
        } catch { /* corrupted */ }
        return map;
    }

    static saveToolCounts(counts: Map<number, number>): void {
        const obj: Record<string, number> = {};
        counts.forEach((v, k) => { obj[String(k)] = v; });
        sys.localStorage.setItem(TOOL_KEY, JSON.stringify(obj));
    }
}
