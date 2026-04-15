import raw from './roguelike.json';

export interface RarityWeights {
    common: number;
    rare: number;
    epic: number;
    legendary: number;
}

export interface PityConfig {
    epicAfter: number;
    epicBoost: number;
    legendaryAfter: number;
    legendaryBoost: number;
}

interface RoguelikeCfg {
    expCurve: { base: number; perLevel: number };
    goldOnDeath: { keepRatio: number };
    skillSelect: { choiceCount: number; rarityWeights: RarityWeights };
    pity: PityConfig;
    synergies: Record<string, string[]>;
    shop: { skillSlots: number; healRatio: number; rerollCost: number };
}

const _cfg = raw as RoguelikeCfg;

export function expToNextLevel(level: number): number {
    return _cfg.expCurve.base + level * _cfg.expCurve.perLevel;
}

export function goldKeepRatio(): number {
    return _cfg.goldOnDeath.keepRatio;
}

export function skillChoiceCount(): number {
    return _cfg.skillSelect.choiceCount;
}

export function rarityWeights(): RarityWeights {
    return _cfg.skillSelect.rarityWeights;
}

export function pityConfig(): PityConfig {
    return _cfg.pity;
}

export function getSynergies(skillId: string): string[] {
    return _cfg.synergies[skillId] ?? [];
}

export function shopConfig() {
    return _cfg.shop;
}

export function roguelikeConfig() { return _cfg; }
