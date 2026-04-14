import { BuffEffectBase } from '../../../baseSystem/buff/BuffEffectBase';
import type { AttributeChange } from '../../../baseSystem/buff/types';
import { buffEffect } from '../../../baseSystem/buff/buffEffect';

/**
 * 周期伤害原语（DOT）
 *
 * 覆盖：灼烧 / 中毒 / 流血 / 感电持续伤害。
 *
 * JSON 配置:
 *   { "effectClass": "PeriodicDamageEffect", "damagePerStack": 5, "tickInterval": 1 }
 */
@buffEffect
export class PeriodicDamageEffect extends BuffEffectBase {

    getChanges(): AttributeChange[] { return []; }

    onTick() {
        const dmg = (this.data.damagePerStack ?? 1) * this.runtime.stack;
        if (dmg > 0) {
            this.runtime.owner.damage?.(dmg);
        }
    }
}
