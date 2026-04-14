import type { EntityBuffMgr } from '../../entity/EntityBuffMgr';
import type { HitEffectMgr } from '../../entity/HitEffectMgr';
import type { UpgradeManager } from '../../upgrade/UpgradeManager';
import type { SkillSystem } from '../../skill/SkillSystem';

export interface PlayerServices {
    readonly buffMgr: EntityBuffMgr;
    readonly hitEffectMgr: HitEffectMgr;
    readonly upgradeMgr: UpgradeManager;
    readonly skillSystem: SkillSystem;
}
