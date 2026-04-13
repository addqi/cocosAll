import type { IState } from '../../../../baseSystem/fsm';
import type { IMinionCtx } from '../MinionContext';
import { EMobState } from '../../base/types';
import { PlayerControl } from '../../../player/PlayerControl';

export class MinionChaseState implements IState<IMinionCtx> {
    enter(ctx: IMinionCtx): void {
        ctx.anim.play('run' as any);
    }

    update(ctx: IMinionCtx, dt: number): void {
        const player = PlayerControl.instance;
        if (!player || player.combat.isDead) return;

        const dist = ctx.movement.distTo(player.node);

        if (dist <= ctx.cfg.attackRange) {
            if (ctx.cfg.attackWindUp > 0) {
                ctx.fsm.changeState(EMobState.WindUp);
            } else {
                ctx.fsm.changeState(EMobState.Attack);
            }
            return;
        }
        if (dist > ctx.cfg.detectionRange * 1.5) {
            ctx.fsm.changeState(EMobState.Idle);
            return;
        }

        ctx.movement.moveToward(player.node.worldPosition, dt);
    }

    exit(_ctx: IMinionCtx): void {}
}
