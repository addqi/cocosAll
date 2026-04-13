import { Graphics, Vec3 } from 'cc';
import { enemyBehavior } from '../../../../baseSystem/enemy';
import { enemyConfig } from '../../config/enemyConfig';
import type { EnemyConfigData } from '../../config/enemyConfig';
import type { PropertyBaseConfig } from '../../../entity/EntityPropertyMgr';
import type { EnemyCombat } from '../../EnemyCombat';
import { getEnemyData } from '../../../../config/enemyConfig';
import { EMobState } from '../../base/types';
import { MinionBehavior } from '../MinionBehavior';

const _data = getEnemyData('bomber');

@enemyBehavior
export class BomberBehavior extends MinionBehavior {
    readonly typeId = 'bomber';
    readonly config: EnemyConfigData = { ...enemyConfig, ..._data.overrides };
    readonly propertyCfg: PropertyBaseConfig = _data.properties;

    drawIndicator(g: Graphics, radius: number): void {
        g.circle(0, 0, radius);
    }

    checkHit(selfPos: Readonly<Vec3>, targetPos: Readonly<Vec3>, _facingAngle: number): boolean {
        return Vec3.distance(selfPos, targetPos) <= this.config.attackRange * 1.3;
    }

    onAttackHit(combat: EnemyCombat): void {
        combat.takePureDamage(combat.currentHp);
    }

    get afterAttackState(): EMobState { return EMobState.Dead; }
}
