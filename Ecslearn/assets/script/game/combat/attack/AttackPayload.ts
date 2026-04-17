/**
 * 统一攻击载荷 — "命中后发生什么" 的完整描述。
 *
 * 普攻、技能、召唤物命中时都引用同一种 payload，
 * 不再各自拼凑命中逻辑。
 */
export interface AttackPayloadDef {
    id: string;
    damageRatio: number;
    hitEffects?: string[];
    targetBuffs?: string[];
    attackerBuffs?: string[];
    tags?: string[];
}

export type AttackType = 'projectile' | 'area' | 'melee' | 'summon';

/**
 * 攻击规格 — 技能只生产这个东西，交给执行器落地。
 *
 * 必填字段保持最小集，便于向前兼容测试；
 * 真实战斗执行所需的瞬时量（原点、目标、命中回调）通过可选字段携带，
 * 由 handler 各自按需读取。
 */
export interface AttackSpec {
    attackType: AttackType;
    skillId: string;
    payloadRef: string;
    [key: string]: unknown;
}

export { getPayloadDef, allPayloadIds } from '../../config/payloadConfig/PayloadConfigLoader';
