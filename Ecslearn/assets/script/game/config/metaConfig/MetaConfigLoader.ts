import raw from './meta.json';

export type MetaEffectType = 'base_stat' | 'gold_bonus' | 'skill_choice' | 'revive';

export interface MetaEffect {
    type: MetaEffectType;
    target: string;
    valuePerLevel: number;
}

export interface MetaUpgradeDef {
    id: string;
    name: string;
    desc: string;
    maxLevel: number;
    costs: number[];
    effect: MetaEffect;
}

export type UnlockConditionType = 'reach_floor' | 'total_kills' | 'kill_boss' | 'meta_upgrade';

export interface UnlockCondition {
    type: UnlockConditionType;
    floor?: number;
    count?: number;
    bossId?: string;
    upgradeId?: string;
}

export interface SkillUnlockEntry {
    skillId: string;
    conditions: UnlockCondition[];
}

interface MetaCfg {
    upgrades: MetaUpgradeDef[];
    skillUnlocks: SkillUnlockEntry[];
}

const _cfg = raw as MetaCfg;
const _upgradeMap = new Map<string, MetaUpgradeDef>();
for (const u of _cfg.upgrades) _upgradeMap.set(u.id, u);

export function getMetaUpgrade(id: string): MetaUpgradeDef | null {
    return _upgradeMap.get(id) ?? null;
}

export function allMetaUpgrades(): readonly MetaUpgradeDef[] {
    return _cfg.upgrades;
}

export function getUpgradeCost(id: string, currentLevel: number): number | null {
    const def = _upgradeMap.get(id);
    if (!def || currentLevel >= def.maxLevel) return null;
    return def.costs[currentLevel] ?? null;
}

export function allSkillUnlocks(): readonly SkillUnlockEntry[] {
    return _cfg.skillUnlocks;
}

export function metaConfig() { return _cfg; }
