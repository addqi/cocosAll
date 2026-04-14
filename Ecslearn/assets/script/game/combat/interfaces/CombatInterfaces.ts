import type { Node } from 'cc';
import type { IBuffOwner } from '../../../baseSystem/buff';
import type { EntityBuffMgr } from '../../entity/EntityBuffMgr';

export type Faction = 'player' | 'enemy' | 'neutral' | 'ally';

/**
 * 攻击来源 — 玩家/敌人/召唤物/陷阱都可实现。
 * 攻击链只面向此接口，不绑定具体 actor 类型。
 */
export interface IAttackSource {
    readonly uid: string;
    readonly faction: Faction;
    getAttackPower(): number;
    getCritRate(): number;
    getCritMultiplier(): number;
}

/**
 * 攻击目标 — 可被命中、承受伤害、接收 Buff。
 */
export interface IAttackTarget {
    readonly uid: string;
    readonly node: Node;
    readonly faction: Faction;
    readonly isDead: boolean;
    applyDamage(rawDmg: number): number;
    readonly buffMgr: EntityBuffMgr;
    readonly buffOwner: IBuffOwner;
}

/**
 * 判定两个阵营是否敌对。
 */
export function isHostile(a: Faction, b: Faction): boolean {
    if (a === b) return false;
    if (a === 'neutral' || b === 'neutral') return false;
    if (a === 'player' && b === 'ally') return false;
    if (a === 'ally' && b === 'player') return false;
    return true;
}
