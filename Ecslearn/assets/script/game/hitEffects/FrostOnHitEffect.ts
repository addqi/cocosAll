import { HitEffectBase } from '../../baseSystem/hitEffect';
import { hitEffect } from '../../baseSystem/hitEffect';
import type { BuffData } from '../../baseSystem/buff';
import type { GameHitContext } from './types';

/**
 * 命中时给目标施加冻伤减速 Buff
 *
 * 配置项：frostBuffId、frostDuration、frostMaxStack、frostSlowPerStack（每层减速值）。
 * FrostSlowEffect 会对目标 MoveSpeed-Mul-Buff 做负数乘法修饰（减速）。
 */
@hitEffect('FrostOnHitEffect')
export class FrostOnHitEffect extends HitEffectBase {
    onHit(ctx: GameHitContext): void {
        const slowPerStack = this.data.frostSlowPerStack ?? 0.15;
        const duration     = this.data.frostDuration ?? 3;
        const maxStack     = this.data.frostMaxStack ?? 5;

        const frostBuff: BuffData = {
            id:          this.data.frostBuffId ?? 8101,
            name:        `冻伤(-${Math.round(slowPerStack * 100)}%速)`,
            duration,
            maxStack,
            effectClass: 'FrostSlowEffect',
            slowPerStack,
        };

        ctx.targetBuffMgr.addBuff(frostBuff, ctx.targetBuffOwner);
    }
}
