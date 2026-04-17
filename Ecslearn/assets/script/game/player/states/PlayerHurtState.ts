import type { IState } from '../../../baseSystem/fsm';
import { EPlayerAnim } from '../anim/PlayerAnimation';
import { EPlayerState, type PlayerCtx } from './PlayerContext';

const HURT_STAGGER = 0.15;

export class PlayerHurtState implements IState<PlayerCtx> {
    private _timer = 0;

    enter(ctx: PlayerCtx) {
        this._timer = HURT_STAGGER;
        ctx.anim.play(EPlayerAnim.Idle);
    }

    update(ctx: PlayerCtx, dt: number) {
        this._timer -= dt;
        if (this._timer <= 0) {
            ctx.fsm.changeState(EPlayerState.Idle);
        }
    }

    exit(_ctx: PlayerCtx) {}
}
