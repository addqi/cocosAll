import type { Node, Vec3 } from 'cc';
import type { IBuffOwner } from '../../baseSystem/buff';
import type { PlayerCombat } from '../player/combat/PlayerCombat';
import type { PlayerProperty } from '../player/property/playerProperty';
import type { EnemyCombat } from '../enemy/EnemyCombat';
import type { EntityBuffMgr } from '../entity/EntityBuffMgr';

export interface GameHitContext {
    attackerProp: PlayerProperty;
    attackerCombat: PlayerCombat;
    targetCombat: EnemyCombat;
    targetBuffMgr: EntityBuffMgr;
    targetBuffOwner: IBuffOwner;
    /** 被击实体节点（击退/位移用） */
    targetNode: Node | null;
    /** 攻击发起点（击退方向 = targetNode.pos - hitOriginPos） */
    hitOriginPos: Vec3 | null;
    baseDamage: number;
    rawDamage: number;
    finalDamage: number;
    isCrit: boolean;
    critMultiplier: number;
    totalHealed: number;
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
        targetNode: null,
        hitOriginPos: null,
        baseDamage: 0,
        rawDamage: 0,
        finalDamage: 0,
        isCrit: false,
        critMultiplier: 1,
        totalHealed: 0,
        damageRatio: 1,
    };
}
