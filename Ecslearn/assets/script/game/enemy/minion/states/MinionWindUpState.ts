import type { IState } from '../../../../baseSystem/fsm';
import type { IMinionCtx } from '../MinionContext';
import { EMobState } from '../../base/types';
import { PlayerControl } from '../../../player/PlayerControl';

export class MinionWindUpState implements IState<IMinionCtx> {
    private _timer = 0;

    enter(ctx: IMinionCtx): void {
        this._timer = 0;
        ctx.anim.play('idle' as any);

        const player = PlayerControl.instance;
        if (player) {
            const dx = player.node.worldPosition.x - ctx.node.worldPosition.x;
            const dy = player.node.worldPosition.y - ctx.node.worldPosition.y;
            ctx.facingAngle = Math.atan2(dy, dx);
            ctx.movement.faceTarget(player.node);
        }

        ctx.behavior.createIndicator(ctx);
    }

    update(ctx: IMinionCtx, dt: number): void {
        this._timer += dt;

        const t = Math.min(this._timer / ctx.cfg.attackWindUp, 1);
        ctx.behavior.tickIndicator(ctx, t);

        if (this._timer >= ctx.cfg.attackWindUp) {
            ctx.fsm.changeState(EMobState.Attack);
        }
    }

    exit(_ctx: IMinionCtx): void {}
}
