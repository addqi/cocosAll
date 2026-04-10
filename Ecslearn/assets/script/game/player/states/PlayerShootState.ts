import type { IState } from '../../../baseSystem/fsm';
import { EPlayerAnim } from '../anim/PlayerAnimation';
import { EPlayerState, type PlayerCtx } from './PlayerContext';

export class PlayerShootState implements IState<PlayerCtx> {
    enter(ctx: PlayerCtx) {
        ctx.anim.playOnce(EPlayerAnim.Shoot, () => {
            ctx.fsm.changeState(EPlayerState.Idle);
        });
    }

    update(_ctx: PlayerCtx, _dt: number) {
    }

    exit(_ctx: PlayerCtx) {
    }
}
