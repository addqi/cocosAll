import type { Vec3 } from 'cc';

export enum GoldSource {
    Kill    = 'kill',
    Pickup  = 'pickup',
    Chest   = 'chest',
    Quest   = 'quest',
    Cheat   = 'cheat',
}

export interface GoldGainContext {
    source: GoldSource;
    baseAmount: number;
    enemyId?: string;
    killerId?: string;
    worldPos?: Readonly<Vec3>;
    meta?: {
        isCrit?: boolean;
        isExecute?: boolean;
    };
}
