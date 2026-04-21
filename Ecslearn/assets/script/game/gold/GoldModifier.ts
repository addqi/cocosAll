import type { GoldGainContext } from './GoldTypes';

/**
 * 金币修饰器接口
 *
 * 所有"连杀加成 / 贪婪升级 / 精巧杀戮"都是独立 Modifier，
 * 通过 `GoldSystem.addModifier()` 挂入，互不感知。
 *
 * 优先级约定：
 *   0-99     加法类（baseAmount + 常数）
 *   100-199  独立乘法（例：首杀 × 2）
 *   200-299  叠加乘法（例：连杀、贪婪）
 *   300+     最终封顶/封底
 */
export interface GoldModifier {
    readonly id: string;
    readonly priority: number;
    apply(amount: number, ctx: GoldGainContext): number;
}
