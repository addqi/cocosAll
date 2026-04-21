import { IRed } from './IRed';
import { Signal } from './Signal';
/**
 * 聚合策略：决定父 Group 如何合并子的数量
 */
export enum GroupAggregation {
    /** 求和：子的 count 累加起来（典型场景：关卡组要显示"3 个新关卡"） */
    SUM = 0,
    /** 存在计数：统计"有几个子是红的"（典型场景：首页要显示"3 个入口有事"） */
    COUNT = 1,
}
export abstract class RedGroup implements IRed {
    protected abstract children: IRed[];

     /** 聚合策略，子类可覆盖；默认 SUM（最常见） */
     protected aggregation: GroupAggregation = GroupAggregation.SUM;

    /**判断是否 */
    calcCount(): number {
        let total = 0;
        for (let i = this.children.length - 1; i >= 0; --i) {
            const c = this.children[i].calcCount();
            if (this.aggregation === GroupAggregation.SUM) {
                total += c;
            } else {
                total += c > 0 ? 1 : 0;
            }
        }
        return total;
    }
    getSignals(out: Signal<any>[]): void {
        for (let i = this.children.length - 1; i >= 0; --i) {
            this.children[i].getSignals(out);
        }
    }
}