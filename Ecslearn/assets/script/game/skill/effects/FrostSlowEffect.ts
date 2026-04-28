import { BuffEffectBase } from '../../../baseSystem/buff/BuffEffectBase';
import { buffEffect } from '../../../baseSystem/buff/buffEffect';
import type { AttributeChange } from '../../../baseSystem/buff/types';
import { EChangeType } from '../../../baseSystem/buff/buffEnum';

/**
 * 冻伤减速 Buff
 *
 * 每层对 MoveSpeed 施加 -slowPerStack 的乘法减速。
 * 3层 × 0.15 = MoveSpeed × (1 - 0.45) = 55% 速度。
 */
@buffEffect('FrostSlowEffect')
export class FrostSlowEffect extends BuffEffectBase {
    getChanges(): AttributeChange[] {
        const slow = (this.data.slowPerStack ?? 0.15) * this.runtime.stack;
        return [{
            attrId: 'MoveSpeed-Mul-Buff',
            type: EChangeType.ADD,
            value: -slow,
        }];
    }
}
