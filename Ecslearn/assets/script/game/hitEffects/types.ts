import type { IBuffOwner } from '../../baseSystem/buff';
import type { PlayerCombat } from '../player/combat/PlayerCombat';
import type { PlayerProperty } from '../player/property/playerProperty';
import type { EnemyCombat } from '../enemy/EnemyCombat';
import type { EntityBuffMgr } from '../entity/EntityBuffMgr';
/**
 * 命中上下文
 * 包含命中相关的所有信息
 */
export interface GameHitContext {
    /** 攻击者属性管理器 */
    attackerProp: PlayerProperty;
    /** 攻击者战斗对象 */
    attackerCombat: PlayerCombat;
    /** 目标战斗对象 */
    targetCombat: EnemyCombat;
    /** 目标Buff管理器 */
    targetBuffMgr: EntityBuffMgr;
    /** 目标Buff挂载目标 */
    targetBuffOwner: IBuffOwner;
    /** 基础伤害 */
    baseDamage: number;
    /** 原始伤害 */
    rawDamage: number;
    /** 最终伤害 */
    finalDamage: number;
    /** 是否暴击 */
    isCrit: boolean;
    /** 暴击倍率 */
    critMultiplier: number;
    /** 总治疗量 */
    totalHealed: number;
    /** 伤害缩放（穿透衰减等），1.0 = 满额 */
    damageRatio: number;
}

export function createHitContext(
    attackerProp: PlayerProperty,
    attackerCombat: PlayerCombat,
    targetCombat: EnemyCombat,
    targetBuffMgr: EntityBuffMgr,
    targetBuffOwner: IBuffOwner,
): GameHitContext {
    return {
        attackerProp,
        attackerCombat,
        targetCombat,
        targetBuffMgr,
        targetBuffOwner,
        baseDamage: 0,
        rawDamage: 0,
        finalDamage: 0,
        isCrit: false,
        critMultiplier: 1,
        totalHealed: 0,
        damageRatio: 1,
    };
}
