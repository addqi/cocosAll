/**
 * 玩家经验与等级管理
 *
 * 升级公式: requiredXP(lv) = BASE + lv * GROWTH
 * 升级时 emit 回调，外部决定触发三选一或其他逻辑
 */

const BASE_XP = 50;
const XP_GROWTH = 30;

export type LevelUpCallback = (newLevel: number) => void;

export class PlayerExperience {
    private _level = 1;
    private _xp = 0;
    private _onLevelUp: LevelUpCallback | null = null;

    get level(): number { return this._level; }
    get xp(): number { return this._xp; }
    get xpToNextLevel(): number { return BASE_XP + this._level * XP_GROWTH; }
    get xpRatio(): number { return Math.min(this._xp / this.xpToNextLevel, 1); }

    set onLevelUp(fn: LevelUpCallback | null) { this._onLevelUp = fn; }

    addXp(amount: number): void {
        if (amount <= 0) return;
        this._xp += amount;
        while (this._xp >= this.xpToNextLevel) {
            this._xp -= this.xpToNextLevel;
            this._level++;
            this._onLevelUp?.(this._level);
        }
    }

    reset(): void {
        this._level = 1;
        this._xp = 0;
    }
}
