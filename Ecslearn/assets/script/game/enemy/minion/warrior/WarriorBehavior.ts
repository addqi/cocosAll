import { Graphics, Vec3 } from 'cc';
import { enemyBehavior } from '../../../../baseSystem/enemy';
import { enemyConfig } from '../../config/enemyConfig';
import type { EnemyConfigData } from '../../config/enemyConfig';
import type { PropertyBaseConfig } from '../../../entity/EntityPropertyMgr';
import { getEnemyData } from '../../../../config/enemyConfig';
import { MinionBehavior } from '../MinionBehavior';

const DEG2RAD = Math.PI / 180;
const _data = getEnemyData('warrior');

@enemyBehavior
export class WarriorBehavior extends MinionBehavior {
    readonly typeId = 'warrior';
    readonly config: EnemyConfigData = { ...enemyConfig, ..._data.overrides };
    readonly propertyCfg: PropertyBaseConfig = _data.properties;

    get indicatorNeedsRotation() { return true; }

    drawIndicator(g: Graphics, radius: number): void {
        const halfAngle = this.config.attackAngle * 0.5 * DEG2RAD;
        g.moveTo(0, 0);
        g.arc(0, 0, radius, -halfAngle, halfAngle, true);
        g.lineTo(0, 0);
        g.close();
    }

    checkHit(selfPos: Readonly<Vec3>, targetPos: Readonly<Vec3>, facingAngle: number): boolean {
        const dist = Vec3.distance(selfPos, targetPos);
        if (dist > this.config.attackRange * 1.3) return false;

        const dx = targetPos.x - selfPos.x;
        const dy = targetPos.y - selfPos.y;
        const toTarget = Math.atan2(dy, dx);

        let diff = toTarget - facingAngle;
        if (diff > Math.PI) diff -= Math.PI * 2;
        if (diff < -Math.PI) diff += Math.PI * 2;

        return Math.abs(diff) <= this.config.attackAngle * 0.5 * DEG2RAD;
    }
}
