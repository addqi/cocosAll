import { BuffEffectBase } from '../../../baseSystem/buff/BuffEffectBase';
import type { AttributeChange } from '../../../baseSystem/buff/types';
import { EChangeType } from '../../../baseSystem/buff/buffEnum';
import { buffEffect } from '../../../baseSystem/buff/buffEffect';

/**
 * 简单属性修改 Buff 基类
 *
 * 适用于"往某个属性节点 ADD (valuePerStack × stack)"的通用场景。
 * JSON 配置需提供 targetAttr 和 valuePerStack 字段。
 * 子类只需继承 + @buffEffect 装饰器，无需重复任何逻辑。
 */
@buffEffect('SimpleAttrBuffEffect')
export class SimpleAttrBuffEffect extends BuffEffectBase {
    getChanges(): AttributeChange[] {
        return [{
            attrId: this.data.targetAttr,
            type: EChangeType.ADD,
            value: this.data.valuePerStack * this.runtime.stack,
        }];
    }
}
