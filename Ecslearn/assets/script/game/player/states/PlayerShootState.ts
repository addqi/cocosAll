import type { IState } from '../../../baseSystem/fsm';
import { EPropertyId } from '../../config/enum/propertyEnum';
import { EPlayerAnim } from '../anim/PlayerAnimation';
import { ArrowProjectile } from '../../projectile/ArrowProjectile';
import { ProjectilePool } from '../../projectile/ProjectilePool';
import { ShootResolver } from '../../shoot/ShootResolver';
import { createHitContext } from '../../hitEffects/types';
import type { EnemyControl } from '../../enemy/EnemyControl';
import type { PlayerCtx } from './PlayerContext';

export class PlayerShootState implements IState<PlayerCtx> {

    enter(_ctx: PlayerCtx) {}

    update(ctx: PlayerCtx, _dt: number) {
        if (ctx.shootCooldown > 0) return;

        const atkSpeed = Math.max(ctx.prop.getValue(EPropertyId.AttackSpeed), 0.1);
        const baseDur = ctx.anim.animator.getClipDuration(EPlayerAnim.Shoot);
        ctx.shootCooldown = baseDur / atkSpeed;
        ctx.anim.animator.speed = atkSpeed;

        ctx.targetEnemy = ctx.findNearestEnemy();
        const enemy = ctx.targetEnemy;

        if (enemy?.node.isValid) {
            const facing = enemy.node.worldPosition.x > ctx.node.worldPosition.x ? 1 : -1;
            ctx.body.setScale(facing, 1, 1);
        }

        ctx.anim.playOnce(EPlayerAnim.Shoot);
        this._fire(ctx);
    }

    exit(ctx: PlayerCtx) {
        ctx.anim.animator.speed = 1;
    }

    private _fire(ctx: PlayerCtx) {
        const shots = ShootResolver.resolve(
            ctx.node.worldPosition,
            ctx.body.scale.x,
            ctx.targetEnemy,
            ctx.prop,
        );
        const projConfig = ShootResolver.snapshotProjectileConfig(ctx.prop);
        const combat = ctx.combat;
        const mgr = ctx.hitEffectMgr;

        const onHit = (target: EnemyControl, damageRatio: number) => {
            const hitCtx = createHitContext(
                ctx.prop, combat, target.combat, target.buffMgr, target.buffOwner,
            );
            hitCtx.damageRatio = damageRatio;
            hitCtx.targetNode = target.node;
            hitCtx.hitOriginPos = ctx.node.worldPosition.clone();
            mgr.execute(hitCtx);
        };

        for (const shot of shots) {
            const arrowNode = ProjectilePool.acquire();
            let arrow = arrowNode.getComponent(ArrowProjectile);
            if (!arrow) arrow = arrowNode.addComponent(ArrowProjectile);

            arrow.init(
                shot.curve, shot.duration, shot.hasTarget, shot.target,
                projConfig, onHit,
            );
        }
    }
}
