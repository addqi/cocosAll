import type { PropertyBaseConfig, EnemyOverrides } from '../sharedTypes';
import enemiesRaw from './enemies.json';

export interface EnemyDataEntry {
    readonly id: string;
    readonly name: string;
    readonly category: string;
    readonly properties: PropertyBaseConfig;
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
