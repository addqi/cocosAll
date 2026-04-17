import { ToolType, ToolDefs } from '../../config/ToolConfig';
import { StorageService } from '../../storage/StorageService';

/**
 * 全局道具状态：次数持久化 + 当前激活道具。
 * 由 AppRoot 创建一次，跨关卡复用；每关开始时 resetActive()。
 */
export class ToolState {
    activeType: ToolType = ToolType.None;

    private _counts: Map<ToolType, number>;
    onChanged: (() => void) | null = null;

    constructor() {
        this._counts = new Map();
        const saved = StorageService.loadToolCounts();
        for (const def of ToolDefs) {
            this._counts.set(def.type, saved.get(def.type) ?? def.initCount);
        }
    }

    getCount(type: ToolType): number {
        return this._counts.get(type) ?? 0;
    }

    addCount(type: ToolType, n: number): void {
        const c = this.getCount(type);
        this._counts.set(type, c + n);
        this._persist();
        this.onChanged?.();
    }

    consume(type: ToolType): boolean {
        const c = this.getCount(type);
        if (c <= 0) return false;
        this._counts.set(type, c - 1);
        this._persist();
        this.onChanged?.();
        return true;
    }

    activate(type: ToolType): void {
        this.activeType = type;
        this.onChanged?.();
    }

    deactivate(): void {
        this.activeType = ToolType.None;
        this.onChanged?.();
    }

    resetActive(): void {
        this.activeType = ToolType.None;
    }

    private _persist(): void {
        StorageService.saveToolCounts(this._counts);
    }
}
