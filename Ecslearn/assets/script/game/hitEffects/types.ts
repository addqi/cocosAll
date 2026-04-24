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

// ─── 发射事件钩子 ───────────────────────────────────────
// 用途：trigger-happy（概率再发一箭）、split-arrow（命中分裂）等

/**
 * 二次发射描述 —— effect 通过 fireExtra 排队，AttackState 统一处理。
 *
 * 为什么用 "Pending List + 回调"而不是让 effect 直接 spawn：
 *   - effect 不应该知道 ProjectilePool / ArrowProjectile 这种底层细节
 *   - 回调由 AttackState 提供，保持"谁负责发射就谁管细节"
 */
export interface ShootExtraSpec {
    /** 延迟多少秒发射（0 = 同帧立即；> 0 = setTimeout）*/
    delaySec: number;
    /** 发射点相对玩家的偏移（世界坐标系，ctx.originWorldPos + offset 为最终起点）*/
    offsetX: number;
    offsetY: number;
    /** 伤害倍率（1 = 原伤害；0.5 = 半伤害；用于 split-arrow）*/
    damageRatio: number;
}

/**
 * 玩家每次发射箭时的 context。
 *
 * - `shotsCount` 本次已经发了几支（带 multi-shot / spread 计算后）；供 effect 做"每 N 发触发一次"
 * - `originWorldPos` 本次箭的起点（玩家位置）
 * - `targetEnemy`    主瞄准目标（可能为 null 表示无目标朝面向发射）
 * - `fireExtra(spec)` effect 通过此方法排队"追加一箭"
 */
export interface ShootEventContext {
    attackerProp: PlayerProperty;
    attackerCombat: PlayerCombat;
    shotsCount: number;
    originWorldPos: Readonly<Vec3>;
    targetEnemyNode: Node | null;
    /** 追加一支额外的箭 —— AttackState 回调 */
    fireExtra: (spec: ShootExtraSpec) => void;
}

// ─── 被伤害事件钩子 ─────────────────────────────────────
// 用途：second-wind（免死一次）、命中减伤 + 冷却、反弹伤害等

/**
 * 玩家被敌人伤害时的 context。
 *
 * **`rawDamage` 是可变字段** —— effect 可修改它：
 *   - 减半： `ctx.rawDamage *= 0.5`
 *   - 清零（免伤）： `ctx.rawDamage = 0`
 *   - 反弹： 保持 rawDamage 不变，但额外给 attacker 回伤（效果自己实现）
 *
 * 多 effect 顺序按 `data.priority` 执行；先执行的先改值。
 */
export interface TakenDamageContext {
    victimProp: PlayerProperty;
    victimCombat: PlayerCombat;
    /** 可变：伤害数值，effect 可修改 */
    rawDamage: number;
    /** 攻击源（如有），用于反弹等场景 */
    attackerNode: Node | null;
    attackerWorldPos: Vec3 | null;
}

export function createShootEventContext(
    attackerProp: PlayerProperty,
    attackerCombat: PlayerCombat,
    shotsCount: number,
    originWorldPos: Readonly<Vec3>,
    targetEnemyNode: Node | null,
    fireExtra: (spec: ShootExtraSpec) => void,
): ShootEventContext {
    return {
        attackerProp,
        attackerCombat,
        shotsCount,
        originWorldPos,
        targetEnemyNode,
        fireExtra,
    };
}

export function createTakenDamageContext(
    victimProp: PlayerProperty,
    victimCombat: PlayerCombat,
    rawDamage: number,
    attackerNode: Node | null = null,
    attackerWorldPos: Vec3 | null = null,
): TakenDamageContext {
    return { victimProp, victimCombat, rawDamage, attackerNode, attackerWorldPos };
}
