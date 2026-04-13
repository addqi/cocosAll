import type { BuffData, IBuffOwner } from '../../baseSystem/buff';
import type { HitEffectData } from '../../baseSystem/hitEffect';
import type { EntityBuffMgr } from '../entity/EntityBuffMgr';
import type { HitEffectMgr } from '../entity/HitEffectMgr';
import type { IShootPolicy } from '../shoot/types';

export interface UpgradeEffect {
    type: 'buff' | 'hit_effect' | 'shoot_policy';
    /** buff → BuffData, hit_effect → HitEffectData, shoot_policy → ShootPolicyData */
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
    rarity: 'common' | 'rare' | 'epic';
    category: 'attr' | 'proj' | 'onhit' | 'policy';
    effects: UpgradeEffect[];
    /** 进化前置：全部已 apply 时可触发进化 */
    evolvesFrom?: string[];
}

export interface UpgradeTarget {
    buffMgr: EntityBuffMgr;
    buffOwner: IBuffOwner;
    hitEffectMgr: HitEffectMgr;
    setShootPolicy(policy: IShootPolicy): void;
}
