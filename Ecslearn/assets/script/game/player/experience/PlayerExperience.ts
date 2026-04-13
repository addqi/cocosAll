/**
 * 玩家经验与等级管理
 *
 * 升级公式: requiredXP(lv) = xpBase + lv × xpGrowth
 * 参数来源: playerConfig
 */
import { playerConfig } from '../config/playerConfig';

export type LevelUpCallback = (newLevel: number) => void;

export class PlayerExperience {
    private _level = 1;
    private _xp = 0;
    private _onLevelUp: LevelUpCallback | null = null;

    get level(): number { return this._level; }
    get xp(): number { return this._xp; }
    get xpToNextLevel(): number { return playerConfig.xpBase + this._level * playerConfig.xpGrowth; }
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
