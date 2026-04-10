import { Vec3 } from 'cc';
import { QuadBezier } from '../../baseSystem/math';
import { EPropertyId } from '../config/enum/propertyEnum';
import { playerConfig } from '../player/config/playerConfig';
import type { PlayerProperty } from '../player/property/playerProperty';
import type { EnemyControl } from '../enemy/EnemyControl';
import type { ShotDescriptor, ProjectileConfig } from './types';

const DEG2RAD = Math.PI / 180;
const _dir = new Vec3();

export class ShootResolver {

    static resolve(
        shooterPos: Vec3,
        facingX: number,
        target: EnemyControl | null,
        prop: PlayerProperty,
    ): ShotDescriptor[] {
        const arrowSpeed = prop.getValue(EPropertyId.ArrowSpeed);
        const extraProj  = Math.floor(prop.getValue(EPropertyId.ExtraProjectiles));
        const spreadAngle = prop.getValue(EPropertyId.SpreadAngle);
        const totalCount  = 1 + Math.max(0, extraProj);

        const start = shooterPos.clone();

        if (target?.node.isValid) {
            return this._resolveTargeted(start, target, totalCount, spreadAngle, arrowSpeed);
        }
        return this._resolveUntargeted(start, facingX, totalCount, spreadAngle, arrowSpeed);
    }

    static snapshotProjectileConfig(prop: PlayerProperty): ProjectileConfig {
        return {
            pierceCount:      Math.floor(prop.getValue(EPropertyId.PierceCount)),
            bounceCount:      Math.floor(prop.getValue(EPropertyId.BounceCount)),
            splitCount:       0,
            splitDamageRatio: 0.4,
            homingStrength:   prop.getValue(EPropertyId.HomingStrength),
            damageRatio:      1,
        };
    }

    private static _resolveTargeted(
        start: Vec3,
        target: EnemyControl,
        count: number,
        spreadDeg: number,
        speed: number,
    ): ShotDescriptor[] {
        const end = target.node.worldPosition.clone();
        const dist = Vec3.distance(start, end);
        const duration = dist / speed;
        const baseFacing = end.x > start.x ? 1 : -1;
        const { arrowArcRatio } = playerConfig;

        if (count <= 1) {
            const curve = QuadBezier.createArc(start, end, dist * arrowArcRatio * baseFacing);
            return [{ curve, duration, hasTarget: true, target }];
        }

        const arcBase = dist * arrowArcRatio;
        const results: ShotDescriptor[] = [];

        for (let i = 0; i < count; i++) {
            const arcMul = 0.5 + i / (count - 1);
            const curve = QuadBezier.createArc(start, end, arcBase * arcMul * baseFacing);
            results.push({ curve, duration, hasTarget: true, target });
        }
        return results;
    }

    private static _resolveUntargeted(
        start: Vec3,
        facingX: number,
        count: number,
        spreadDeg: number,
        speed: number,
    ): ShotDescriptor[] {
        const facing = facingX >= 0 ? 1 : -1;
        const range = playerConfig.arrowNoTargetRange;
        const duration = range / speed;

        if (count <= 1) {
            const end = new Vec3(start.x + facing * range, start.y, 0);
            const curve = QuadBezier.createArc(start, end, range * 0.5 * facing);
            return [{ curve, duration, hasTarget: false, target: null }];
        }

        const baseAngle = facing > 0 ? 0 : Math.PI;
        const halfSpread = (spreadDeg * DEG2RAD) / 2;
        const step = count > 1 ? (spreadDeg * DEG2RAD) / (count - 1) : 0;
        const arcBase = range * 0.5;
        const results: ShotDescriptor[] = [];

        for (let i = 0; i < count; i++) {
            const angle = baseAngle - halfSpread + step * i;
            const end = new Vec3(
                start.x + Math.cos(angle) * range,
                start.y + Math.sin(angle) * range,
                0,
            );
            const f = end.x > start.x ? 1 : -1;
            const arcMul = 0.5 + i / (count - 1);
            const curve = QuadBezier.createArc(start, end, arcBase * arcMul * f);
            results.push({ curve, duration, hasTarget: false, target: null });
        }
        return results;
    }
}
