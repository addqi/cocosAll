import { EPropertyId } from '../config/enum/propertyEnum';
import type { EnemyProperty } from './EnemyProperty';

/** 防御减免常数：DEF / (DEF + K) = 减免比例 */
const DEF_FACTOR = 100;

export class EnemyCombat {
    private _currentHp: number;

    constructor(private readonly prop: EnemyProperty) {
        this._currentHp = this.maxHp;
    }

    get currentHp(): number { return this._currentHp; }
    get maxHp(): number { return Math.round(this.prop.getValue(EPropertyId.Hp)); }
    get defense(): number { return Math.round(this.prop.getValue(EPropertyId.Defense)); }
    get isDead(): boolean { return this._currentHp <= 0; }

    /**
     * 百分比减免公式：actual = rawDmg × K / (DEF + K)
     * DEF=30, K=100 → 减免 23%，actual ≈ rawDmg × 0.77
     * DEF 永远无法达到 100% 减免
     */
    takeDamage(rawDmg: number): number {
        const def = this.defense;
        const reduction = def / (def + DEF_FACTOR);
        const actual = Math.max(Math.round(rawDmg * (1 - reduction)), 1);
        this._currentHp = Math.max(this._currentHp - actual, 0);
        return actual;
    }

    heal(amount: number): number {
        const before = this._currentHp;
        this._currentHp = Math.min(this._currentHp + Math.round(amount), this.maxHp);
        return this._currentHp - before;
    }

    reset(): void {
        this._currentHp = this.maxHp;
    }
}
