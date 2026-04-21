import { IRed } from '../IRed';
import { Signal } from '../Signal';
import { regRedFactory } from '../RedRegister';
import { RedGroup } from '../RedGroup';
import { LevelClickTracker } from './LevelClickTracker';

export const LEVEL_COUNT = 10;

class LevelRed implements IRed {
    constructor(private readonly id: number) { }
    calcRed(): boolean {
        return LevelClickTracker.has(this.id);
    }
    getSignals(out: Signal<any>[]): void {
        out.push(LevelClickTracker.changed);
    }
}

class AnyLevelRedGroup extends RedGroup {
    protected children: IRed[] = Array.from(
        { length: LEVEL_COUNT },
        (_, i) => new LevelRed(i),
    );
}

let _registered = false;
export function registerLevelReds(): void {
    if (_registered) return;
    _registered = true;

    LevelClickTracker.init();

    for (let i = 0; i < LEVEL_COUNT; i++) {
        regRedFactory(`Level_${i}`, () => new LevelRed(i));
    }
    regRedFactory('AnyLevel', () => new AnyLevelRedGroup());
}
