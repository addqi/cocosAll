import upgradesRaw from './upgrades.json';
import evolutionsRaw from './evolutions.json';

export interface UpgradeEffectData {
    type: string;
    data: Record<string, unknown>;
}

export interface UpgradeDef {
    id: string;
    name: string;
    desc: string;
    tier: number;
    rarity: string;
    category: string;
    effects: UpgradeEffectData[];
}

export interface EvolutionDef {
    id: string;
    name: string;
    requires: string[];
    result: string;
    [key: string]: unknown;
}

const _upgrades = upgradesRaw as UpgradeDef[];
const _upgradeMap = new Map<string, UpgradeDef>();
for (const u of _upgrades) _upgradeMap.set(u.id, u);

const _evolutions = evolutionsRaw as EvolutionDef[];

export function upgradeConfig() { return { upgrades: _upgrades, map: _upgradeMap }; }
export function evolutionConfig() { return _evolutions; }

export function getUpgradeDef(id: string): UpgradeDef | null {
    return _upgradeMap.get(id) ?? null;
}

export function allUpgradeIds(): string[] {
    return Array.from(_upgradeMap.keys());
}

export function getUpgradesByTier(tier: number): UpgradeDef[] {
    return _upgrades.filter(u => u.tier === tier);
}

export function getUpgradesByRarity(rarity: string): UpgradeDef[] {
    return _upgrades.filter(u => u.rarity === rarity);
}
