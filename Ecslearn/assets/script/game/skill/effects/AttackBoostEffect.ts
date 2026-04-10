import { BuffEffectBase } from '../../../baseSystem/buff/BuffEffectBase';
import { buffEffect } from '../../../baseSystem/buff/buffEffect';
import type { AttributeChange } from '../../../baseSystem/buff/types';
import { EChangeType } from '../../../baseSystem/buff/buffEnum';

@buffEffect
export class AttackBoostEffect extends BuffEffectBase {
    getChanges(): AttributeChange[] {
        return [{
            attrId: this.data.targetAttr,
            type: EChangeType.ADD,
            value: this.data.valuePerStack * this.runtime.stack,
        }];
    }

    onAdd() {
        console.log(`[Buff] ${this.data.name} 添加 (stack: ${this.runtime.stack}/${this.data.maxStack})`);
    }

    onRemove() {
        console.log(`[Buff] ${this.data.name} 移除`);
    }

    onStack(cur: number, max: number) {
        console.log(`[Buff] ${this.data.name} 叠加 → ${cur}/${max}`);
    }
}
