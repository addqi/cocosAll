import type { IState } from '../../../baseSystem/fsm';
import { EPlayerAnim } from '../anim/PlayerAnimation';
import type { PlayerCtx, EPlayerState } from './PlayerContext';

export class PlayerRunState implements IState<PlayerCtx> {
    enter(ctx: PlayerCtx) {
        ctx.anim.play(EPlayerAnim.Run);
    }

    update(_ctx: PlayerCtx, _dt: number) {
    }

    exit(_ctx: PlayerCtx) {
    }
}
