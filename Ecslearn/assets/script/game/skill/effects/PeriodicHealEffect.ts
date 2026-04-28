import { BuffEffectBase } from '../../../baseSystem/buff/BuffEffectBase';
import type { AttributeChange } from '../../../baseSystem/buff/types';
import { buffEffect } from '../../../baseSystem/buff/buffEffect';
import { EPropertyId } from '../../config/enum/propertyEnum';

/**
 * 周期回复原语（HOT）
 *
 * 覆盖：再生 / 固定值回血 / 最大生命百分比回血。
 *
 * JSON 配置:
 *   百分比: { "effectClass": "PeriodicHealEffect", "healPercent": 0.05 }
 *   固定值: { "effectClass": "PeriodicHealEffect", "healPerStack": 10 }
 */
@buffEffect('PeriodicHealEffect')
export class PeriodicHealEffect extends BuffEffectBase {

    getChanges(): AttributeChange[] { return []; }

    onTick() {
        const owner = this.runtime.owner;
        const stack = this.runtime.stack;
        let heal = 0;

        if (this.data.healPercent) {
            const maxHp = owner.getPropertyManager().getValue(EPropertyId.Hp);
            heal = maxHp * this.data.healPercent * stack;
        } else if (this.data.healPerStack) {
            heal = this.data.healPerStack * stack;
        }

        if (heal > 0) {
            owner.heal?.(heal);
        }
    }
}
