import { BuffEffectBase } from '../../../baseSystem/buff/BuffEffectBase';
import { buffEffect } from '../../../baseSystem/buff/buffEffect';
import type { AttributeChange } from '../../../baseSystem/buff/types';

/**
 * 灼烧 DOT Buff
 *
 * 每 tick 对 owner 造成 damagePerStack × stack 纯伤害。
 * 配合 tickInterval=0.1, duration=5, stackDecayOnTick=false 使用。
 */
@buffEffect
export class BurnDotEffect extends BuffEffectBase {
    getChanges(): AttributeChange[] {
        return [];
    }

    onTick() {
        const dmg = (this.data.damagePerStack ?? 1) * this.runtime.stack;
        if (dmg > 0) {
            this.runtime.owner.damage?.(dmg);
        }
    }
}
