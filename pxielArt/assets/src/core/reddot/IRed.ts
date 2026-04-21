import { Signal } from "./Signal";

export interface IRed {
    /** 当前红点的数量（0 = 不红；>0 = 红，具体多少由叶子决定） */
    calcCount(): number;
    /** 把"会导致我变脏"的所有信号 push 到 out 数组里 */
    getSignals(out: Signal<any>[]): void;
}