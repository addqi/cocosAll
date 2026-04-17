import type { IState } from '../../../../baseSystem/fsm';
import type { IMinionCtx } from '../MinionContext';

/**
 * 受击硬直状态
 *
 * 纯标记状态：进入时播 idle，退出由 MinionControl 根据 staggerTimer 统一驱动。
 * 被再次命中时 staggerTimer 在 EnemyBase._requestStagger() 内重置，
 * 无需状态内部计时。
 */
export class MinionStaggerState implements IState<IMinionCtx> {
    enter(ctx: IMinionCtx): void {
        ctx.behavior.destroyIndicator(ctx);
        ctx.anim.play('idle' as any);
    }

    update(_ctx: IMinionCtx, _dt: number): void {}

    exit(_ctx: IMinionCtx): void {}
}
