import type { IState } from './types';

/**
 * 通用有限状态机（纯逻辑，零引擎依赖）
 *
 * @typeParam K    状态枚举 key
 * @typeParam TCtx 上下文类型，状态通过它操作宿主
 *
 * 使用方式：
 *   const fsm = new StateMachine<EPlayerState, PlayerCtx>(ctx);
 *   fsm.addState(EPlayerState.Idle, new PlayerIdleState());
 *   fsm.changeState(EPlayerState.Idle);
 *   // 每帧调用
 *   fsm.tick(dt);
 */
export class StateMachine<K extends string, TCtx = any> {
    private _states = new Map<K, IState<TCtx>>();
    private _current: K | null = null;
    private _ctx: TCtx;

    constructor(ctx: TCtx) {
        this._ctx = ctx;
    }

    get current(): K | null { return this._current; }

    addState(key: K, state: IState<TCtx>) {
        this._states.set(key, state);
    }

    changeState(key: K) {
        if (this._current === key) return;
        if (this._current !== null) {
            this._states.get(this._current)?.exit(this._ctx);
        }
        this._current = key;
        this._states.get(key)?.enter(this._ctx);
    }

    tick(dt: number) {
        if (this._current === null) return;
        this._states.get(this._current)?.update(this._ctx, dt);
    }
}
