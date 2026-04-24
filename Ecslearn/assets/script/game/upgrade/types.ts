import type { BuffData, IBuffOwner } from '../../baseSystem/buff';
import type { HitEffectData } from '../../baseSystem/hitEffect';
import type { EntityBuffMgr } from '../entity/EntityBuffMgr';
import type { HitEffectMgr } from '../entity/HitEffectMgr';
export type UpgradeEffectType =
    | 'buff'
    | 'hit_effect'
    | 'shoot_policy'
    | 'behavior_command'
    | 'grant_skill'
    | 'modify_skill';

export interface UpgradeEffect {
    type: UpgradeEffectType;
    data: any;
}

export interface ShootPolicyData {
    policyClass: 'ClickToShoot' | 'HoldToShoot' | 'AutoShoot';
    level?: number;
}

export interface UpgradeConfig {
    id: string;
    name: string;
    desc: string;
    tier: number;
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
    category: 'attr' | 'proj' | 'onhit' | 'policy';
    effects: UpgradeEffect[];
    /** 进化前置：全部已 apply 时可触发进化 */
    evolvesFrom?: string[];
    /**
     * 流派限定：仅当当前玩家流派 id ∈ classIds 时可入候选池
     * - 缺省或空数组 = 通用升级（所有流派都能抽到）
     * - 长度 > 0 = 流派独有升级（仅对匹配流派可见）
     */
    classIds?: readonly string[];
}

export interface UpgradeTarget {
    buffMgr: EntityBuffMgr;
    buffOwner: IBuffOwner;
    hitEffectMgr: HitEffectMgr;
    /** @deprecated 由 behavior_command 替代 */
    setShootPolicy(policy: unknown): void;
    sendBehaviorCommand?(cmd: string, ...args: unknown[]): void;
}
