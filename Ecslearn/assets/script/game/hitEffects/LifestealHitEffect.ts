import { HitEffectBase } from '../../baseSystem/hitEffect';
import { hitEffect } from '../../baseSystem/hitEffect';
import { EPropertyId } from '../config/enum/propertyEnum';
import type { GameHitContext } from './types';

@hitEffect('LifestealHitEffect')
export class LifestealHitEffect extends HitEffectBase {
    onHit(ctx: GameHitContext): void {
        const rate = ctx.attackerProp.getValue(EPropertyId.LifestealRate);
        if (rate <= 0 || ctx.finalDamage <= 0) return;
        const healed = ctx.attackerCombat.heal(ctx.finalDamage * rate);
        ctx.totalHealed += healed;
    }
}
