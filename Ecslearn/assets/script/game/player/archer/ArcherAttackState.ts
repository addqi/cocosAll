import { Vec3 } from 'cc';
import type { IState } from '../../../baseSystem/fsm';
import { EPropertyId } from '../../config/enum/propertyEnum';
import { EPlayerAnim } from '../anim/PlayerAnimation';
import { ArrowProjectile } from '../../projectile/ArrowProjectile';
import { ProjectilePool } from '../../projectile/ProjectilePool';
import { ShootResolver } from '../../shoot/ShootResolver';
import type { ProjectileConfig, ShotDescriptor } from '../../shoot/types';
import {
    createHitContext,
    createShootEventContext,
    type ShootExtraSpec,
} from '../../hitEffects/types';
import type { EnemyControl } from '../../enemy/EnemyControl';
import type { PlayerCtx } from '../states/PlayerContext';
import { archerConfig } from './archerConfig';
import type { ArcherBehavior } from './ArcherBehavior';

/**
 * 计算蓄力伤害倍率。
 * damageRatio = 1 + t * (maxDamageRatio - 1),  t = clamp(chargeSec / maxChargeSec, 0, 1)
 */
export function computeChargeDamageRatio(
    chargeSec: number,
    maxChargeSec: number,
    maxDamageRatio: number,
): number {
    if (maxChargeSec <= 0) return 1;
    const t = Math.min(Math.max(chargeSec / maxChargeSec, 0), 1);
    return 1 + t * (maxDamageRatio - 1);
}

export class ArcherAttackState implements IState<PlayerCtx> {

    enter(_ctx: PlayerCtx) {}

    update(ctx: PlayerCtx, _dt: number) {
        if (ctx.attackCooldown > 0) return;

        const atkSpeed = Math.max(ctx.prop.getValue(EPropertyId.AttackSpeed), 0.1);
        const baseDur = ctx.anim.animator.getClipDuration(EPlayerAnim.Shoot);
        ctx.attackCooldown = baseDur / atkSpeed;
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
            archerConfig.arrowArcRatio,
            archerConfig.arrowNoTargetRange,
        );
        const projConfig = ShootResolver.snapshotProjectileConfig(ctx.prop);

        // 蓄力流：消费 pendingChargeSec → 伤害倍率
        const mode = (ctx.behavior as ArcherBehavior).shootMode;
        if (mode?.type === 'charge') {
            projConfig.damageRatio = computeChargeDamageRatio(
                ctx.pendingChargeSec,
                mode.maxChargeSec,
                mode.maxDamageRatio,
            );
            ctx.pendingChargeSec = 0;
        }

        const onHit = this._makeOnHitCallback(ctx);

        for (const shot of shots) {
            this._spawnArrow(shot, projConfig, onHit);
        }

        // ─── onShoot 钩子 ──────────────────────────────────
        // trigger-happy / split-arrow 等 effect 可在此追加弹道
        const mgr = ctx.hitEffectMgr;
        if (mgr) {
            const fireExtra = (spec: ShootExtraSpec) => this._fireExtra(ctx, spec, projConfig, onHit);
            const shootCtx = createShootEventContext(
                ctx.prop, ctx.combat,
                shots.length,
                ctx.node.worldPosition,
                ctx.targetEnemy?.node ?? null,
                fireExtra,
            );
            mgr.executeOnShoot(shootCtx);
        }
    }

    private _makeOnHitCallback(ctx: PlayerCtx): (target: EnemyControl, damageRatio: number) => void {
        const combat = ctx.combat;
        const mgr = ctx.hitEffectMgr;
        return (target, damageRatio) => {
            const hitCtx = createHitContext(
                ctx.prop, combat, target.combat, target.buffMgr, target.buffOwner,
            );
            hitCtx.damageRatio = damageRatio;
            hitCtx.targetNode = target.node;
            hitCtx.hitOriginPos = ctx.node.worldPosition.clone();
            mgr.execute(hitCtx);
        };
    }

    private _spawnArrow(
        shot: ShotDescriptor,
        projConfig: ProjectileConfig,
        onHit: (target: EnemyControl, damageRatio: number) => void,
    ): void {
        const arrowNode = ProjectilePool.acquire();
        let arrow = arrowNode.getComponent(ArrowProjectile);
        if (!arrow) arrow = arrowNode.addComponent(ArrowProjectile);
        arrow.init(shot.curve, shot.duration, shot.hasTarget, shot.target,
            projConfig, onHit);
    }

    /**
     * effect.onShoot 通过 ctx.fireExtra(spec) 调入本方法 —— 排队一发额外箭。
     *
     * 语义：
     *   - `delaySec > 0` 时 setTimeout 后再射，营造"双发错位"感觉（trigger-happy 要的）
     *   - 偏移 `offsetX/offsetY` 基于发射瞬间的玩家位置
     *   - `damageRatio` 倍率叠加在本次已有 projConfig.damageRatio 上
     *   - 节点销毁后（玩家死亡 / 场景切换）静默 return，避免空指针
     */
    private _fireExtra(
        ctx: PlayerCtx,
        spec: ShootExtraSpec,
        baseCfg: ProjectileConfig,
        onHit: (target: EnemyControl, damageRatio: number) => void,
    ): void {
        const exec = () => {
            if (!ctx.node?.isValid) return;

            const origin = new Vec3(
                ctx.node.worldPosition.x + spec.offsetX,
                ctx.node.worldPosition.y + spec.offsetY,
                ctx.node.worldPosition.z,
            );
            const shots = ShootResolver.resolve(
                origin, ctx.body.scale.x, ctx.targetEnemy,
                ctx.prop, archerConfig.arrowArcRatio, archerConfig.arrowNoTargetRange,
            );
            const cfg: ProjectileConfig = {
                ...baseCfg,
                damageRatio: baseCfg.damageRatio * spec.damageRatio,
            };
            for (const shot of shots) {
                this._spawnArrow(shot, cfg, onHit);
            }
        };

        if (spec.delaySec <= 0) exec();
        else setTimeout(exec, spec.delaySec * 1000);
    }
}
