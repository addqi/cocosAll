import type { IState } from '../../../baseSystem/fsm';
import type { PlayerCtx } from './PlayerContext';
import { EPlayerAnim } from '../anim/PlayerAnimation';

export class PlayerDeadState implements IState<PlayerCtx> {
    enter(ctx: PlayerCtx) {
        ctx.anim.play(EPlayerAnim.Idle);
    }

    update(_ctx: PlayerCtx, _dt: number) {}

    exit(_ctx: PlayerCtx) {}
}
