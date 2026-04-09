import { BuffEffectBase } from '../../../baseSystem/buff/BuffEffectBase';
import { buffEffect } from '../../../baseSystem/buff/buffEffect';
import type { BuffRuntimeInfo } from '../../../baseSystem/buff/BuffRuntimeInfo';
import type { AttributeChange } from '../../../baseSystem/buff/types';
import { EChangeType } from '../../../baseSystem/buff/buffEnum';

@buffEffect
export class AddHpBuffEffect extends BuffEffectBase {
    constructor(runtime: BuffRuntimeInfo) {
        super(runtime);
    }

    /**
     * 声明属性变化：当前层数 × 每层数值
     * stack=1 → +100；stack=3 → +300
     */
    getChanges(): AttributeChange[] {
        const value = this.data.addValuePerStack * this.runtime.stack;
        return [{
            attrId: this.data.targetAttr,
            type: EChangeType.ADD,
            value,
        }];
    }

    onAdd(): void {
        console.log('AddHpBuffEffect onAdd');
    }

    onRemove(): void {
        console.log('AddHpBuffEffect onRemove');
    }

    onTick(): void {
        console.log('AddHpBuffEffect onTick');
    }
}
