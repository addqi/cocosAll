import { BuffEffectBase } from '../../../baseSystem/buff/BuffEffectBase';
import type { AttributeChange } from '../../../baseSystem/buff/types';
import { EChangeType } from '../../../baseSystem/buff/buffEnum';
import { buffEffect } from '../../../baseSystem/buff/buffEffect';

/**
 * 通用属性修改原语
 *
 * 覆盖：攻击 / 攻速 / 暴击 / 移速 / 防御 / 吸血 / 任何属性加减乘。
 *
 * 支持两种 JSON 配置格式：
 *
 * 单属性:
 *   { "effectClass": "AttrModifierEffect", "targetAttr": "Attack-Mul-Buff", "valuePerStack": 0.2 }
 *
 * 多属性:
 *   { "effectClass": "AttrModifierEffect", "changes": [
 *       { "attrId": "Attack-Mul-Buff",    "type": "ADD", "valuePerStack": 0.2 },
 *       { "attrId": "CritRate-Value-Buff", "type": "ADD", "valuePerStack": 0.1 }
 *   ]}
 */
@buffEffect
export class AttrModifierEffect extends BuffEffectBase {

    getChanges(): AttributeChange[] {
        const stack = this.runtime.stack;

        if (this.data.changes) {
            return (this.data.changes as ChangeEntry[]).map(c => ({
                attrId: c.attrId,
                type: parseChangeType(c.type),
                value: c.valuePerStack * stack,
            }));
        }

        return [{
            attrId: this.data.targetAttr,
            type: parseChangeType(this.data.changeType),
            value: (this.data.valuePerStack ?? 0) * stack,
        }];
    }
}

interface ChangeEntry {
    attrId: string;
    type?: string;
    valuePerStack: number;
}

function parseChangeType(raw?: string): EChangeType {
    if (!raw) return EChangeType.ADD;
    const upper = raw.toUpperCase();
    if (upper === 'MUL') return EChangeType.MUL;
    if (upper === 'OVERRIDE') return EChangeType.OVERRIDE;
    if (upper === 'CLAMP') return EChangeType.CLAMP;
    return EChangeType.ADD;
}
