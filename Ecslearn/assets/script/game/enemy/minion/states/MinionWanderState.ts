import type { IState } from '../../../../baseSystem/fsm';
import type { IMinionCtx } from '../MinionContext';
import { EMobState } from '../../base/types';
import { EPropertyId } from '../../../config/enum/propertyEnum';
import { PlayerControl } from '../../../player/PlayerControl';

export class MinionWanderState implements IState<IMinionCtx> {
    private _timer = 0;
    private _duration = 1.5;
    private _dx = 0;
    private _dy = 0;

    enter(ctx: IMinionCtx): void {
        this._timer = 0;
        const cfg = ctx.cfg;
        this._duration = cfg.wanderTimeMin + Math.random() * (cfg.wanderTimeMax - cfg.wanderTimeMin);

        const angle = Math.random() * Math.PI * 2;
        this._dx = Math.cos(angle);
        this._dy = Math.sin(angle);

        ctx.anim.play('run' as any);
        if (this._dx !== 0) {
            ctx.body.setScale(this._dx < 0 ? -1 : 1, 1, 1);
        }
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
            ctx.fsm.changeState(EMobState.Idle);
            return;
        }

        const speed = ctx.prop.getValue(EPropertyId.MoveSpeed) * ctx.cfg.wanderSpeedRatio;
        const lPos = ctx.node.position;
        ctx.node.setPosition(
            lPos.x + this._dx * speed * dt,
            lPos.y + this._dy * speed * dt,
            lPos.z,
        );
    }

    exit(_ctx: IMinionCtx): void {}
}
