import { HitEffectBase, hitEffect } from '../../baseSystem/hitEffect';
import type { BuffData } from '../../baseSystem/buff';
import type { GameHitContext } from './types';

/**
 * 通用"命中挂 Buff"原语
 *
 * 覆盖：灼烧 / 冻伤 / 中毒 / 流血 / 破甲 / 易伤 等一切"命中后给目标上 Buff"的模式。
 *
 * JSON 配置:
 *   {
 *     "id": "burn-on-hit",
 *     "effectClass": "ApplyBuffOnHitEffect",
 *     "scaleWithBaseDamage": 0.2,   // 可选：damagePerStack = baseDamage × ratio
 *     "buff": {
 *       "id": 8001, "name": "灼烧", "duration": 5,
 *       "maxStack": 99, "tickInterval": 0.1,
 *       "effectClass": "PeriodicDamageEffect",
 *       "damagePerStack": 5
 *     }
 *   }
 */
@hitEffect('ApplyBuffOnHitEffect')
export class ApplyBuffOnHitEffect extends HitEffectBase {

    onHit(ctx: GameHitContext): void {
        const template = this.data.buff as BuffData | undefined;
        if (!template) return;

        const buffData: BuffData = { ...template };

        const scaleRatio = this.data.scaleWithBaseDamage as number | undefined;
        if (scaleRatio && ctx.baseDamage > 0) {
            const tickInterval = buffData.tickInterval ?? 1;
            const ticksPerSec = 1 / tickInterval;
            buffData.damagePerStack = Math.max(1, Math.round(ctx.baseDamage * scaleRatio / ticksPerSec));
        }

        ctx.targetBuffMgr.addBuff(buffData, ctx.targetBuffOwner);
    }
}
