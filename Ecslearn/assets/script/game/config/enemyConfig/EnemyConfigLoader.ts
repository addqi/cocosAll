import enemiesRaw from './enemies.json';

export interface EnemyPropertyDef {
    base: number;
    min?: number;
    max?: number;
}

export interface EnemyOverrides {
    detectionRange?: number;
    attackRange?: number;
    attackAngle?: number;
    attackWindUp?: number;
    attackCooldown?: number;
    attackHitFrame?: number;
    xpReward?: number;
    goldDrop?: number;
}

export interface EnemyDataEntry {
    readonly id: string;
    readonly name: string;
    readonly category: string;
    readonly properties: Record<string, EnemyPropertyDef>;
    readonly overrides: Partial<EnemyOverrides>;
}

const _map = new Map<string, EnemyDataEntry>();
for (const raw of enemiesRaw as EnemyDataEntry[]) {
    _map.set(raw.id, raw);
}

export function getEnemyData(id: string): EnemyDataEntry {
    const data = _map.get(id);
    if (!data) throw new Error(`[EnemyData] unknown id: "${id}"`);
    return data;
}

export function allEnemyData(): readonly EnemyDataEntry[] {
    return enemiesRaw as EnemyDataEntry[];
}

export function allEnemyIds(): string[] {
    return Array.from(_map.keys());
}
