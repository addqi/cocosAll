import type { IState } from '../../../baseSystem/fsm';
import type { PlayerCtx } from './PlayerContext';
import { DissolveAnimator } from '../../vfx/DissolveAnimator';
import { GameSession } from '../../core/GameSession';

const DISSOLVE_DURATION = 0.8;

/**
 * 玩家死亡状态：
 *   1. enter 时启动 dissolve 溶解动画
 *   2. update 每帧 tick 推进溶解
 *   3. 溶解完成 → 通知 GameSession.onPlayerDeath（触发 GameOver UI 流程）
 *
 * 玩家身体不销毁（节点保留供复活复用）；只是被 dissolve material 覆盖。
 * 复活时 PlayerControl.revive 会还原 sprite.customMaterial = null。
 */
export class PlayerDeadState implements IState<PlayerCtx> {
    private _dissolve: DissolveAnimator | null = null;
    private _notified = false;

    enter(ctx: PlayerCtx) {
        this._dissolve = new DissolveAnimator(DISSOLVE_DURATION);
        const ok = this._dissolve.start(ctx.body);
        this._notified = false;
        if (!ok) {
            // 资源缺失：fallback 直接通知，避免卡死
            this._notify();
        }
    }

    update(_ctx: PlayerCtx, dt: number) {
        if (!this._dissolve) return;
        if (this._dissolve.tick(dt) && !this._notified) {
            this._notify();
        }
    }

    exit(_ctx: PlayerCtx) {
        this._dissolve = null;
    }

    private _notify(): void {
        this._notified = true;
        GameSession.inst.onPlayerDeath();
    }
}
