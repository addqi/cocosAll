import { Vec3 } from 'cc';
import type { IState } from '../../../baseSystem/fsm';
import { QuadBezier } from '../../../baseSystem/math';
import { EPlayerAnim } from '../anim/PlayerAnimation';
import { EPlayerState, type PlayerCtx } from './PlayerContext';
import { ArrowProjectile } from '../../projectile/ArrowProjectile';
import { ProjectilePool } from '../../projectile/ProjectilePool';
import { playerConfig } from '../config/playerConfig';

export class PlayerShootState implements IState<PlayerCtx> {
    enter(ctx: PlayerCtx) {
        const enemy = ctx.targetEnemy;

        if (enemy?.node.isValid) {
            const facing = enemy.node.worldPosition.x > ctx.node.worldPosition.x ? 1 : -1;
            ctx.body.setScale(facing, 1, 1);
        }

        ctx.anim.playOnce(EPlayerAnim.Shoot, () => {
            ctx.fsm.changeState(EPlayerState.Idle);
        });

        this._spawnArrow(ctx);
    }

    update(_ctx: PlayerCtx, _dt: number) {}

    exit(_ctx: PlayerCtx) {}

    private _spawnArrow(ctx: PlayerCtx) {
        const { arrowSpeed, arrowTexture, arrowWidth, arrowHeight, arrowArcRatio, arrowNoTargetRange } = playerConfig;
        const enemy = ctx.targetEnemy;

        const arrowNode = ProjectilePool.acquire();
        let arrow = arrowNode.getComponent(ArrowProjectile);
        if (!arrow) arrow = arrowNode.addComponent(ArrowProjectile);

        const start = ctx.node.worldPosition.clone();

        if (enemy?.node.isValid) {
            const end = enemy.node.worldPosition.clone();
            const dist = Vec3.distance(start, end);
            const facing = end.x > start.x ? 1 : -1;
            const curve = QuadBezier.createArc(start, end, dist * arrowArcRatio * facing);
            const duration = dist / arrowSpeed;

            const combat = ctx.combat!;
            const enemyCombat = enemy.combat;
            arrow.init(
                curve, duration, true,
                arrowWidth, arrowHeight, arrowTexture,
                () => {
                    const r = combat.attack(enemyCombat);
                    const def = enemyCombat.defense;
                    const reduction = Math.round(def / (def + 100) * 100);
                    console.log(
                        `[Combat] ATK=${r.playerAtk} → raw=${r.rawDamage}` +
                        `${r.isCrit ? ` CRIT!(${(r.critRate * 100).toFixed(0)}%, ×${r.critDmg})` : ''}` +
                        ` → DEF=${def}(${reduction}%减免) → dmg=${r.finalDamage}` +
                        ` | enemy ${enemyCombat.currentHp}/${enemyCombat.maxHp}` +
                        (r.healed > 0
                            ? ` | steal ${(r.lifestealRate * 100).toFixed(0)}%: +${r.healed} → player ${combat.currentHp}/${combat.maxHp}`
                            : ''),
                    );
                },
            );
        } else {
            const facing = ctx.body.scale.x >= 0 ? 1 : -1;
            const range = arrowNoTargetRange;
            const end = new Vec3(start.x + facing * range, start.y, start.z);
            const curve = QuadBezier.createArc(start, end, range * 0.5 * facing);
            const duration = range / arrowSpeed;
            arrow.init(curve, duration, false, arrowWidth, arrowHeight, arrowTexture);
        }
    }
}
