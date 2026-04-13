import type { IState } from '../../../../baseSystem/fsm';
import type { IMinionCtx } from '../MinionContext';
import { EMobState } from '../../base/types';

export class MinionRecoveryState implements IState<IMinionCtx> {
    private _timer = 0;

    enter(ctx: IMinionCtx): void {
        this._timer = 0;
        ctx.anim.play('idle' as any);
    }

    update(ctx: IMinionCtx, dt: number): void {
        this._timer += dt;
        if (this._timer >= ctx.cfg.attackCooldown) {
            ctx.fsm.changeState(EMobState.Idle);
        }
    }

    exit(_ctx: IMinionCtx): void {}
}
