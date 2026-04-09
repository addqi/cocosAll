import { EPropertyId } from '../config/enum/propertyEnum';
import type { PlayerProperty } from './playerProperty';

/**
 * 玩家战斗状态管理
 *
 * 职责：
 * - 维护当前血量（currentHp），与属性系统中的 MaxHp 分离
 * - 提供受伤 / 治疗 / 复活接口
 * - 提供暴击判定与伤害计算
 *
 * 使用方式：
 *   const combat = new PlayerCombat(playerProperty);
 *   combat.takeDamage(200);   // 扣血
 *   combat.heal(100);         // 治疗
 *   combat.isDead             // 是否死亡
 */
export class PlayerCombat {
    private _currentHp: number;

    /**
     * @param prop 玩家属性管理器（读取 MaxHp / Defense / CritRate / CritDmg）
     */
    constructor(private readonly prop: PlayerProperty) {
        this._currentHp = this.maxHp;
    }

    // ─── 只读属性 ────────────────────────────────────────────────

    get currentHp(): number { return this._currentHp; }

    get maxHp(): number { return this.prop.getValue(EPropertyId.Hp); }

    get isDead(): boolean { return this._currentHp <= 0; }

    // ─── 战斗接口 ────────────────────────────────────────────────

    /**
     * 受到原始伤害（已经过攻击方计算），本方扣除防御后落地
     * 最终扣血 = max(rawDmg - defense, 1)，保证至少扣 1 点
     */
    takeDamage(rawDmg: number): number {
        const defense = this.prop.getValue(EPropertyId.Defense);
        const actual = Math.max(rawDmg - defense, 1);
        this._currentHp = Math.max(this._currentHp - actual, 0);
        return actual;
    }

    /**
     * 治疗，不超过 MaxHp 上限
     */
    heal(amount: number): number {
        const before = this._currentHp;
        this._currentHp = Math.min(this._currentHp + amount, this.maxHp);
        return this._currentHp - before;
    }

    /**
     * 重置当前血量为 MaxHp（复活 / 场景重置时调用）
     */
    reset(): void {
        this._currentHp = this.maxHp;
    }

    /**
     * 判定本次攻击是否暴击，并返回最终伤害值
     * @param baseDmg 攻击方的基础伤害（已计算 Attack 等）
     */
    calcOutgoingDamage(baseDmg: number): { damage: number; isCrit: boolean } {
        const critRate = this.prop.getValue(EPropertyId.CritRate);
        const critDmg  = this.prop.getValue(EPropertyId.CritDmg);
        const isCrit   = Math.random() < critRate;
        const damage   = isCrit ? baseDmg * critDmg : baseDmg;
        return { damage, isCrit };
    }
}
