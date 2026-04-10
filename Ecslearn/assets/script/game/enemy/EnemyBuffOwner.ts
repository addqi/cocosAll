import type { IBuffOwner } from '../../baseSystem/buff';
import type { EntityPropertyMgr } from '../entity/EntityPropertyMgr';
import type { EnemyProperty } from './EnemyProperty';
import type { EnemyCombat } from './EnemyCombat';

export class EnemyBuffOwner implements IBuffOwner {
    readonly uid: string;

    constructor(
        private readonly enemyProperty: EnemyProperty,
        private readonly combat: EnemyCombat,
        uid = 'enemy',
    ) {
        this.uid = uid;
    }

    getPropertyManager(): EntityPropertyMgr {
        return this.enemyProperty;
    }

    heal(amount: number): void {
        this.combat.heal(amount);
    }

    damage(amount: number): void {
        this.combat.takePureDamage(amount);
    }
}
