import { EAction } from '../component';
import type { ActionComp } from '../component';
import type { IShootPolicy } from './types';

export class HoldToShoot implements IShootPolicy {
    readonly priority = 1;
    wantShoot(input: ActionComp): boolean {
        return input.active.has(EAction.Attack);
    }
}

export class ClickToShoot implements IShootPolicy {
    readonly priority = 0;
    wantShoot(input: ActionComp): boolean {
        return input.justPressed.has(EAction.Attack);
    }
}

/**
 * Lv1: 静止 + 有目标 → 自动射击
 * Lv2: 有目标 → 自动射击（移动中也可）
 * Lv3: 始终自动射击（无目标则朝面向方向）
 */
export class AutoShoot implements IShootPolicy {
    readonly priority = 2;
    constructor(private _level: number = 1) {}

    get level(): number { return this._level; }

    wantShoot(_input: ActionComp, hasTarget: boolean, isMoving: boolean): boolean {
        if (this._level >= 3) return true;
        if (!hasTarget) return false;
        if (this._level >= 2) return true;
        return !isMoving;
    }
}
