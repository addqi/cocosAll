import floorRaw from './floors.json';

export type FloorType = 'combat' | 'elite' | 'boss' | 'shop' | 'rest' | 'treasure';

export interface FloorScaling {
    hpMultiplier: number;
    atkMultiplier: number;
    defMultiplier: number;
    speedMultiplier: number;
}

export interface EnemyUnlockEntry {
    floor: number;
    types: string[];
}

const _cfg = floorRaw as {
    enemyCountBase: number;
    enemyCountGrowthPerFloor: number;
    enemyCountMax: number;
    scaling: { hpPerFloor: number; atkPerFloor: number; defPerFloor: number; speedPerFloor: number };
    enemyUnlock: EnemyUnlockEntry[];
    sequence: {
        bossEvery: number; shopEvery: number;
        eliteEvery: number; eliteChance: number;
        restMinFloor: number; restChance: number;
        treasureChance: number;
    };
};

export function getEnemyCount(floor: number): number {
    const raw = _cfg.enemyCountBase + Math.floor(floor * _cfg.enemyCountGrowthPerFloor);
    return Math.min(raw, _cfg.enemyCountMax);
}

export function getFloorScaling(floor: number): FloorScaling {
    const s = _cfg.scaling;
    return {
        hpMultiplier:    1 + floor * s.hpPerFloor,
        atkMultiplier:   1 + floor * s.atkPerFloor,
        defMultiplier:   1 + floor * s.defPerFloor,
        speedMultiplier: 1 + floor * s.speedPerFloor,
    };
}

export function getUnlockedEnemyTypes(floor: number): string[] {
    const out: string[] = [];
    for (const entry of _cfg.enemyUnlock) {
        if (floor >= entry.floor) out.push(...entry.types);
    }
    return out;
}

export function getFloorType(floor: number): FloorType {
    const seq = _cfg.sequence;
    if (floor % seq.bossEvery === 0) return 'boss';
    if (floor % seq.shopEvery === 0) return 'shop';
    if (floor >= seq.restMinFloor && Math.random() < seq.restChance) return 'rest';
    if (floor % seq.eliteEvery === 0 && Math.random() < seq.eliteChance) return 'elite';
    if (Math.random() < seq.treasureChance) return 'treasure';
    return 'combat';
}

export function floorConfig() { return _cfg; }
