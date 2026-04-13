import { Vec3 } from 'cc';
import { QuadBezier } from '../../baseSystem/math';
import { EPropertyId } from '../config/enum/propertyEnum';
import { playerConfig } from '../player/config/playerConfig';
import { ArrowProjectile } from '../projectile/ArrowProjectile';
import { ProjectilePool } from '../projectile/ProjectilePool';
import { ShootResolver } from '../shoot/ShootResolver';
import { EnemyControl } from '../enemy/EnemyControl';
import { findNearestEnemy } from '../enemy/EnemyQuery';
import { createHitContext } from '../hitEffects/types';
import type { IActiveSkill, SkillContext } from './SkillTypes';

export class ArrowStormSkill implements IActiveSkill {
    readonly id = 'arrow-storm';
    readonly name = '箭雨倾泻';
    readonly maxCooldown: number;
    currentCd = 0;
    level = 1;

    private _arrowMultiplier: number;
    private _skyHeight: number;
    private _scatter: number;

    constructor(cfg?: Partial<{
        cooldown: number;
        arrowMultiplier: number;
        skyHeight: number;
        scatter: number;
    }>) {
        this.maxCooldown      = cfg?.cooldown ?? 8;
        this._arrowMultiplier = cfg?.arrowMultiplier ?? 3;
        this._skyHeight       = cfg?.skyHeight ?? 500;
        this._scatter         = cfg?.scatter ?? 200;
    }

    canUse(): boolean { return this.currentCd <= 0; }

    tick(dt: number): void {
        if (this.currentCd > 0) this.currentCd = Math.max(0, this.currentCd - dt);
    }

    execute(ctx: SkillContext): void {
        this.currentCd = this.maxCooldown;

        const extraProj   = Math.floor(ctx.playerProp.getValue(EPropertyId.ExtraProjectiles));
        const totalArrows = this.level * (1 + extraProj) * this._arrowMultiplier;
        const center      = ctx.mouseWorldPos;

        const { arrowSpeed, arrowArcRatio } = playerConfig;
        const projConfig = ShootResolver.snapshotProjectileConfig(ctx.playerProp);
        projConfig.pierceCount = 0;
        projConfig.bounceCount = 0;
        projConfig.splitCount  = 0;

        const onHit = (target: EnemyControl, damageRatio: number) => {
            const hitCtx = createHitContext(
                ctx.playerProp, ctx.playerCombat,
                target.combat, target.buffMgr, target.buffOwner,
            );
            hitCtx.damageRatio  = damageRatio;
            hitCtx.targetNode   = target.node;
            hitCtx.hitOriginPos = new Vec3(
                target.node.worldPosition.x,
                target.node.worldPosition.y + this._skyHeight,
                0,
            );
            ctx.hitEffectMgr.execute(hitCtx);
        };

        for (let i = 0; i < totalArrows; i++) {
            const offX  = (Math.random() - 0.5) * this._scatter;
            const endX  = center.x + (Math.random() - 0.5) * this._scatter * 0.5;
            const endY  = center.y + (Math.random() - 0.5) * this._scatter * 0.3;
            const start = new Vec3(center.x + offX, center.y + this._skyHeight, 0);

            const landing = new Vec3(endX, endY, 0);
            const near    = findNearestEnemy(landing, 120);
            const end     = near ? near.node.worldPosition.clone() : landing;

            const dist   = Vec3.distance(start, end);
            const facing  = end.x > start.x ? 1 : -1;
            const arc     = dist * arrowArcRatio * 0.2 * facing * (Math.random() > 0.5 ? 1 : -1);
            const curve   = QuadBezier.createArc(start, end, arc);
            const dur     = dist / arrowSpeed * (0.8 + Math.random() * 0.4);

            const arrowNode = ProjectilePool.acquire();
            let arrow = arrowNode.getComponent(ArrowProjectile);
            if (!arrow) arrow = arrowNode.addComponent(ArrowProjectile);

            arrow.init(
                curve, dur, !!near, near,
                projConfig, onHit,
            );
        }
    }

}
