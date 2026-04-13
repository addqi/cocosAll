import type { IState } from '../../../../baseSystem/fsm';
import type { IMinionCtx } from '../MinionContext';
import { EMobState } from '../../base/types';
import { PlayerControl } from '../../../player/PlayerControl';

export class MinionIdleState implements IState<IMinionCtx> {
    private _timer = 0;
    private _duration = 2;

    enter(ctx: IMinionCtx): void {
        this._timer = 0;
        const cfg = ctx.cfg;
        this._duration = cfg.idleTimeMin + Math.random() * (cfg.idleTimeMax - cfg.idleTimeMin);
        ctx.anim.play('idle' as any);
    }

    update(ctx: IMinionCtx, dt: number): void {
        const player = PlayerControl.instance;
        if (!player || player.combat.isDead) return;

        if (ctx.movement.distTo(player.node) < ctx.cfg.detectionRange) {
            ctx.fsm.changeState(EMobState.Chase);
            return;
        }
        this._timer += dt;
        if (this._timer >= this._duration) {
            ctx.fsm.changeState(EMobState.Wander);
        }
    }

    exit(_ctx: IMinionCtx): void {}
}
