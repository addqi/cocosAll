import { EntityPropertyMgr } from '../entity/EntityPropertyMgr';
import type { PropertyBaseConfig } from '../entity/EntityPropertyMgr';
import enemyConfig from './config/enemy.json';

export class EnemyProperty extends EntityPropertyMgr {
    constructor() {
        super();
        this.setInitialValues(enemyConfig as PropertyBaseConfig);
    }
}
