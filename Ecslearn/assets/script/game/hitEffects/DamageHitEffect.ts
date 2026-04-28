import { HitEffectBase } from '../../baseSystem/hitEffect';
import { hitEffect } from '../../baseSystem/hitEffect';
import { EPropertyId } from '../config/enum/propertyEnum';
import { EnemyControl } from '../enemy/EnemyControl';
import type { GameHitContext } from './types';

@hitEffect('DamageHitEffect')
export class DamageHitEffect extends HitEffectBase {
    onHit(ctx: GameHitContext): void {
        const atk = Math.round(ctx.attackerProp.getValue(EPropertyId.Attack));
        const critRate = ctx.attackerProp.getValue(EPropertyId.CritRate);
        const critDmg = ctx.attackerProp.getValue(EPropertyId.CritDmg);

        ctx.isCrit = Math.random() < critRate;
        ctx.critMultiplier = ctx.isCrit ? critDmg : 1;
        ctx.baseDamage = atk;
        ctx.rawDamage = Math.round(atk * ctx.critMultiplier * ctx.damageRatio);
        ctx.finalDamage = ctx.targetCombat.takeDamage(ctx.rawDamage);

        if (ctx.targetNode?.isValid) {
            const enemy = ctx.targetNode.getComponent(EnemyControl);
            enemy?.onHitVisual(ctx.finalDamage, ctx.isCrit);
        }
    }
}
