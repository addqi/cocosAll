import { Signal } from '../Signal';
import { GameEvents } from './GameEvents';

export class LevelClickTracker {
    private static _clicked: Set<number> = new Set();
    /** 点击状态发生变化时派发 */
    static readonly changed: Signal<void> = new Signal<void>();
    private static _inited: boolean = false;

    static init(): void {
        if (this._inited) return;
        this._inited = true;
        GameEvents.levelClicked.add((id) => {
            if (this._clicked.has(id)) this._clicked.delete(id);
            else this._clicked.add(id);
            this.changed.dispatch();
        });
    }

    static has(id: number): boolean {
        return this._clicked.has(id);
    }
}
