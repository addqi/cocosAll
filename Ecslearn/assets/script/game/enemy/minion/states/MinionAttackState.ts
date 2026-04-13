import type { IState } from '../../../../baseSystem/fsm';
import type { IMinionCtx } from '../MinionContext';
import { EMobState } from '../../base/types';
import { PlayerControl } from '../../../player/PlayerControl';

export class MinionAttackState implements IState<IMinionCtx> {
    private _hitApplied = false;

    enter(ctx: IMinionCtx): void {
        this._hitApplied = false;

        if (ctx.cfg.attackWindUp <= 0) {
            const player = PlayerControl.instance;
            if (player) {
                const dx = player.node.worldPosition.x - ctx.node.worldPosition.x;
                const dy = player.node.worldPosition.y - ctx.node.worldPosition.y;
                ctx.facingAngle = Math.atan2(dy, dx);
                ctx.movement.faceTarget(player.node);
            }
            ctx.behavior.createIndicator(ctx);
        }

        ctx.anim.playOnce('attack' as any, () => {
            ctx.fsm.changeState(ctx.behavior.afterAttackState);
        });
    }

    update(ctx: IMinionCtx, dt: number): void {
        if (ctx.cfg.attackWindUp <= 0 && ctx.visual.indicatorInner) {
            const hitFrame = Math.max(ctx.cfg.attackHitFrame, 1);
            const t = Math.min(ctx.anim.animator.frameIndex / hitFrame, 1);
            ctx.behavior.tickIndicator(ctx, t);
        }

        if (this._hitApplied) return;

        if (ctx.anim.animator.frameIndex >= ctx.cfg.attackHitFrame) {
            this._hitApplied = true;
            ctx.behavior.onAttackFrame(ctx);
        }
    }

    exit(ctx: IMinionCtx): void {
        ctx.behavior.destroyIndicator(ctx);
    }
}
