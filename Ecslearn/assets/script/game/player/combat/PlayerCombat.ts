import { EPropertyId } from '../../config/enum/propertyEnum';
import type { PlayerProperty } from '../property/playerProperty';
import type { EnemyCombat } from '../../enemy/EnemyCombat';

/** 防御减免常数 */
const DEF_FACTOR = 100;

export interface AttackResult {
    playerAtk: number;
    critRate: number;
    critDmg: number;
    isCrit: boolean;
    rawDamage: number;
    finalDamage: number;
    lifestealRate: number;
    healed: number;
}

export class PlayerCombat {
    private _currentHp: number;

    constructor(private readonly prop: PlayerProperty) {
        this._currentHp = this.maxHp;
    }

    get currentHp(): number { return this._currentHp; }
    get maxHp(): number { return Math.round(this.prop.getValue(EPropertyId.Hp)); }
    get isDead(): boolean { return this._currentHp <= 0; }

    setHpRatio(ratio: number) {
        this._currentHp = Math.floor(this.maxHp * Math.max(0, Math.min(1, ratio)));
    }

    takeDamage(rawDmg: number): number {
        const def = Math.round(this.prop.getValue(EPropertyId.Defense));
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

    attack(target: EnemyCombat): AttackResult {
        const playerAtk = Math.round(this.prop.getValue(EPropertyId.Attack));
        const critRate = this.prop.getValue(EPropertyId.CritRate);
        const critDmg = this.prop.getValue(EPropertyId.CritDmg);
        const isCrit = Math.random() < critRate;
        const rawDamage = Math.round(isCrit ? playerAtk * critDmg : playerAtk);

        const finalDamage = target.takeDamage(rawDamage);

        let healed = 0;
        const lifestealRate = this.prop.getValue(EPropertyId.LifestealRate);
        if (lifestealRate > 0) {
            healed = this.heal(finalDamage * lifestealRate);
        }

        return { playerAtk, critRate, critDmg, isCrit, rawDamage, finalDamage, lifestealRate, healed };
    }
}
