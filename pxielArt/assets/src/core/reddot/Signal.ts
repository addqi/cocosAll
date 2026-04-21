/** 信号回调函数类型 */
export type SignalHandler<T> = (payload: T) => void;

/** 信号订阅项类型 */
interface SignalSubscription<T> {
    handler: SignalHandler<T>;
    context: object | null;
}
/** 信号类 */
export class Signal<T = void> {
    private _subs: SignalSubscription<T>[] = [];
    /** 添加订阅 */
    add(handler: SignalHandler<T>, context: object | null = null): void {
        this._subs.push({ handler, context });
    }
    /** 移除订阅 */
    remove(handler: SignalHandler<T>, context: object | null = null): void {
        for (let i = this._subs.length - 1; i >= 0; i--) {
            const s = this._subs[i];
            if (s.handler === handler && s.context === context) {
                this._subs.splice(i, 1);
                return;
            }
        }
    }
    /** 派发信号 */
    dispatch(payload: T): void {
        const snapshot = this._subs.slice();
        for (const s of snapshot) {
            s.handler.call(s.context, payload);
        }
    }
    /** 清空所有订阅 */
    clear(): void {
        this._subs.length = 0;
    }
}