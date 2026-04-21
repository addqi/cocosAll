import { Signal } from "./Signal";

export interface IRed {
    /** 当前是否应该显示红点 */
    calcRed(): boolean;
    /** 把"会导致我变脏"的所有信号 push 到 out 数组里 */
    getSignals(out: Signal<any>[]): void;
}