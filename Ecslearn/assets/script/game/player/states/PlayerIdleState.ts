import type { IState } from '../../../baseSystem/fsm';
import { EPlayerAnim } from '../anim/PlayerAnimation';
import type { PlayerCtx } from './PlayerContext';

export class PlayerIdleState implements IState<PlayerCtx> {
    enter(ctx: PlayerCtx) {
        ctx.anim.play(EPlayerAnim.Idle);
    }

    update(_ctx: PlayerCtx, _dt: number) {
    }

    exit(_ctx: PlayerCtx) {
    }
}
