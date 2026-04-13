import type { IState } from '../../../baseSystem/fsm';
import type { PlayerCtx } from './PlayerContext';

const HURT_STAGGER = 0.15;

export class PlayerHurtState implements IState<PlayerCtx> {
    private _timer = 0;

    enter(_ctx: PlayerCtx) {
        this._timer = HURT_STAGGER;
    }

    update(ctx: PlayerCtx, dt: number) {
        this._timer -= dt;
        if (this._timer <= 0) {
            ctx.fsm.changeState('idle' as any);
        }
    }

    exit(_ctx: PlayerCtx) {}
}
