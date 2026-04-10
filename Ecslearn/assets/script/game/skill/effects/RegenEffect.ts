import { BuffEffectBase } from '../../../baseSystem/buff/BuffEffectBase';
import { buffEffect } from '../../../baseSystem/buff/buffEffect';
import type { AttributeChange } from '../../../baseSystem/buff/types';
import { EPropertyId } from '../../config/enum/propertyEnum';

/**
 * 生命回复 Buff
 *
 * 不修改属性，靠 onTick 每秒治疗 maxHp × healPercent。
 * 配置 stackDecayOnTick=true → 每次 tick 消耗 1 层，层数归零自动移除。
 */
@buffEffect
export class RegenEffect extends BuffEffectBase {
    getChanges(): AttributeChange[] {
        return [];
    }

    onTick() {
        const owner = this.runtime.owner;
        const propMgr = owner.getPropertyManager();
        const maxHp = propMgr.getValue(EPropertyId.Hp);
        const healAmt = maxHp * (this.data.healPercent ?? 0.1);

        if (owner.heal) {
            owner.heal(healAmt);
        }
    }
}
