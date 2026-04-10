import type { IBuffOwner } from '../../baseSystem/buff';
import type { EntityPropertyMgr } from '../entity/EntityPropertyMgr';
import type { EnemyProperty } from './EnemyProperty';

export class EnemyBuffOwner implements IBuffOwner {
    readonly uid: string;

    constructor(
        private readonly enemyProperty: EnemyProperty,
        uid = 'enemy'
    ) {
        this.uid = uid;
    }

    getPropertyManager(): EntityPropertyMgr {
        return this.enemyProperty;
    }
}
