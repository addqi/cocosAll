import type { GoldModifier } from '../GoldModifier';
import { GoldSource, type GoldGainContext } from '../GoldTypes';

/**
 * 连杀加成
 *
 * 连杀计数由 GoldSystem 内部维护（击杀后 +1，timeoutSec 无击杀后清零）。
 * 档位：3 → ×1.2 / 5 → ×1.3 / 10 → ×1.5
 *
 * 注意：Modifier 本身只消费 `combo` 参数，不直接读 GoldSystem；
 * 这样后续迁移到 RunSessionState 时只需换参数来源，Modifier 不改。
 */
export class ComboKillModifier implements GoldModifier {
    readonly id = 'combo_kill';
    readonly priority = 200;

    private _comboProvider: () => number;

    constructor(comboProvider: () => number) {
        this._comboProvider = comboProvider;
    }

    apply(amount: number, ctx: GoldGainContext): number {
        if (ctx.source !== GoldSource.Kill) return amount;
        const combo = this._comboProvider();
        if (combo >= 10) return amount * 1.5;
        if (combo >= 5)  return amount * 1.3;
        if (combo >= 3)  return amount * 1.2;
        return amount;
    }
}
