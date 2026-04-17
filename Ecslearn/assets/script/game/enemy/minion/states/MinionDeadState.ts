import type { IState } from '../../../../baseSystem/fsm';
import type { IMinionCtx } from '../MinionContext';
import { PlayerControl } from '../../../player/PlayerControl';
import { EEnemyAnim } from '../../anim/EnemyAnimation';

export class MinionDeadState implements IState<IMinionCtx> {
    private _timer = 0;

    enter(ctx: IMinionCtx): void {
        this._timer = 0;
        ctx.behavior.destroyIndicator(ctx);
        ctx.visual.hideIndicator();
        ctx.uiAnchor.active = false;
        ctx.groundFX.active = false;

        if (ctx.anim.hasAnim(EEnemyAnim.Die)) {
            ctx.anim.playOnce(EEnemyAnim.Die, () => {
                ctx.visual.startDissolve(ctx.body);
            });
        } else {
            ctx.anim.stop();
            ctx.visual.dissolveDelay = 0.1;
        }

        if (!ctx.xpGranted) {
            ctx.xpGranted = true;
            PlayerControl.instance?.grantXp(ctx.cfg.xpReward);
        }
    }

    update(ctx: IMinionCtx, dt: number): void {
        this._timer += dt;

        if (!ctx.visual.dissolving) {
            if (this._timer >= ctx.visual.dissolveDelay) {
                if (!ctx.visual.startDissolve(ctx.body)) {
                    ctx.node.destroy();
                }
            }
            return;
        }

        if (ctx.visual.tickDissolve(dt)) {
            ctx.node.destroy();
        }
    }

    exit(_ctx: IMinionCtx): void {}
}
