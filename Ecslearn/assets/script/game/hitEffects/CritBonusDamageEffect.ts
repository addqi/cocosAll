import { HitEffectBase } from '../../baseSystem/hitEffect';
import { hitEffect } from '../../baseSystem/hitEffect';
import type { GameHitContext } from './types';

/** 暴击时附加固定额外伤害 */
@hitEffect('CritBonusDamageEffect')
export class CritBonusDamageEffect extends HitEffectBase {
    onHit(ctx: GameHitContext): void {
        if (!ctx.isCrit) return;
        const bonus = this.data.bonusDamage ?? 50;
        const actual = ctx.targetCombat.takeDamage(bonus);
        ctx.finalDamage += actual;
    }
}
