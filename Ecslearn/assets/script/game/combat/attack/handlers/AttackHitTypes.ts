import type { EnemyBase } from '../../../enemy/base/EnemyBase';

export type AttackHitFn = (target: EnemyBase, damageRatio: number) => void;
