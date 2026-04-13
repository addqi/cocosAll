import { EntityPropertyMgr } from '../entity/EntityPropertyMgr';
import type { PropertyBaseConfig } from '../entity/EntityPropertyMgr';

export class EnemyProperty extends EntityPropertyMgr {
    constructor(propertyCfg: PropertyBaseConfig) {
        super();
        this.setInitialValues(propertyCfg);
    }
}
