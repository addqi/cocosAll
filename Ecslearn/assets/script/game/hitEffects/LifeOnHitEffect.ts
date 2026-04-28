import { HitEffectBase } from '../../baseSystem/hitEffect';
import { hitEffect } from '../../baseSystem/hitEffect';
import type { GameHitContext } from './types';

/** 每次命中固定回血（不依赖伤害） */
@hitEffect('LifeOnHitEffect')
export class LifeOnHitEffect extends HitEffectBase {
    onHit(ctx: GameHitContext): void {
        const amount = this.data.healAmount ?? 10;
        const healed = ctx.attackerCombat.heal(amount);
        ctx.totalHealed += healed;
    }
}
