import type { Vec3 } from 'cc';
import type { QuadBezier } from '../../baseSystem/math';
import type { ActionComp } from '../component';
import type { EnemyControl } from '../enemy/EnemyControl';

export interface IShootPolicy {
    readonly priority: number;
    wantShoot(input: ActionComp, hasTarget: boolean, isMoving: boolean): boolean;
}

export interface ShotDescriptor {
    curve: QuadBezier;
    duration: number;
    hasTarget: boolean;
    target: EnemyControl | null;
}

export interface ProjectileConfig {
    pierceCount: number;
    bounceCount: number;
    splitCount: number;
    splitDamageRatio: number;
    homingStrength: number;
    damageRatio: number;
}
