/**
 * 单局游戏会话管理
 *
 * 职责：
 * - 维护当前游戏阶段（Playing / Paused / GameOver）
 * - 预留复活接口：死亡时可选择花费代价复活或直接结算
 * - 提供 onGameOver / onRevive 回调，由 UI 层驱动
 */

export enum ESessionPhase {
    Playing,
    Paused,
    /** 玩家死亡，等待复活决策 */
    AwaitRevive,
    /** 已结算 */
    GameOver,
}

export type ReviveCallback = () => void;
export type GameOverCallback = (survived: boolean) => void;

export class GameSession {
    private static _inst: GameSession | null = null;
    static get inst(): GameSession {
        if (!this._inst) this._inst = new GameSession();
        return this._inst;
    }

    private _phase = ESessionPhase.Playing;
    private _reviveCount = 0;
    private _maxRevives = 1;

    private _onGameOver: GameOverCallback | null = null;
    private _onReviveRequest: (() => void) | null = null;

    get phase(): ESessionPhase { return this._phase; }
    get isPlaying(): boolean { return this._phase === ESessionPhase.Playing; }
    get canRevive(): boolean { return this._reviveCount < this._maxRevives; }
    get reviveCount(): number { return this._reviveCount; }

    set onGameOver(fn: GameOverCallback | null) { this._onGameOver = fn; }
    set onReviveRequest(fn: (() => void) | null) { this._onReviveRequest = fn; }

    reset(): void {
        this._phase = ESessionPhase.Playing;
        this._reviveCount = 0;
    }

    /**
     * 玩家死亡时调用：
     * - 有复活次数 → 进入 AwaitRevive，通知 UI 展示复活/放弃选择
     * - 无复活次数 → 直接 GameOver
     */
    onPlayerDeath(): void {
        if (this._phase !== ESessionPhase.Playing) return;

        if (this.canRevive) {
            this._phase = ESessionPhase.AwaitRevive;
            this._onReviveRequest?.();
        } else {
            this._endGame(false);
        }
    }

    /** UI 确认复活 */
    confirmRevive(): void {
        if (this._phase !== ESessionPhase.AwaitRevive) return;
        this._reviveCount++;
        this._phase = ESessionPhase.Playing;
    }

    /** UI 放弃复活 → 结算 */
    declineRevive(): void {
        if (this._phase !== ESessionPhase.AwaitRevive) return;
        this._endGame(false);
    }

    /** 正常通关结算 */
    onStageClear(): void {
        this._endGame(true);
    }

    private _endGame(survived: boolean): void {
        this._phase = ESessionPhase.GameOver;
        this._onGameOver?.(survived);
    }
}
