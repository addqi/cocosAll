import { Graphics, Vec3 } from 'cc';
import { EnemyBehaviorBase } from '../../../baseSystem/enemy';
import type { EnemyConfigData } from '../config/enemyConfig';
import type { PropertyBaseConfig } from '../../entity/EntityPropertyMgr';
import type { EnemyCombat } from '../EnemyCombat';
import { EPropertyId } from '../../config/enum/propertyEnum';
import { PlayerControl } from '../../player/PlayerControl';
import { EMobState } from '../base/types';
import type { IMinionCtx } from './MinionContext';

/**
 * 小怪行为基类
 *
 * 所有小怪类型继承此类，覆写攻击判定 / 指示器绘制。
 * 默认提供全圆范围判定 + 圆形指示器。
 *
 * 4 个生命周期钩子供状态机调用，子类覆写即可定制：
 * createIndicator / tickIndicator / destroyIndicator / onAttackFrame
 */
export abstract class MinionBehavior extends EnemyBehaviorBase {
    abstract readonly config: EnemyConfigData;
    abstract readonly propertyCfg: PropertyBaseConfig;

    get indicatorNeedsRotation(): boolean { return false; }
    get indicatorScalesXOnly(): boolean { return false; }

    drawIndicator(g: Graphics, radius: number): void {
        g.circle(0, 0, radius);
    }

    checkHit(selfPos: Readonly<Vec3>, targetPos: Readonly<Vec3>, facingAngle: number): boolean {
        return Vec3.distance(selfPos, targetPos) <= this.config.attackRange * 1.3;
    }

    /** 命中帧触发后的行为钩子，子类覆写实现类型专属逻辑 */
    onAttackHit(_combat: EnemyCombat): void {}

    get afterAttackState(): EMobState { return EMobState.Recovery; }

    // ─── 生命周期钩子（状态机调用） ───────────────

    createIndicator(ctx: IMinionCtx): void {
        ctx.visual.showIndicator(
            ctx.groundFX, ctx.cfg.attackRange, ctx.facingAngle,
            this.indicatorNeedsRotation,
            (g, r) => this.drawIndicator(g, r),
        );
    }

    tickIndicator(ctx: IMinionCtx, t: number): void {
        ctx.visual.scaleInner(t, this.indicatorScalesXOnly ? 1 : t);
    }

    destroyIndicator(ctx: IMinionCtx): void {
        ctx.visual.hideIndicator();
    }

    onAttackFrame(ctx: IMinionCtx): void {
        const player = PlayerControl.instance;
        if (!player) return;

        const hit = this.checkHit(
            ctx.node.worldPosition,
            player.node.worldPosition,
            ctx.facingAngle,
        );
        if (hit) {
            const dmg = ctx.prop.getValue(EPropertyId.Attack);
            player.applyDamage(dmg);
        }
        this.onAttackHit(ctx.combat);
    }
}
