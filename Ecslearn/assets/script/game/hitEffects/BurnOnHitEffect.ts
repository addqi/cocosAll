import { HitEffectBase } from '../../baseSystem/hitEffect';
import { hitEffect } from '../../baseSystem/hitEffect';
import type { BuffData } from '../../baseSystem/buff';
import type { GameHitContext } from './types';

/**
 * 命中时给目标上灼烧 DOT buff
 *
 * 每次命中叠 1 层，每层每 tick 造成 baseDamage × burnRatio / ticksPerSec 纯伤害。
 * 配置项：burnRatio(伤害比例)、burnBuffId(buff唯一ID)、
 *         burnDuration(持续秒)、burnTickInterval(tick间隔秒)、burnMaxStack(最大层数)。
 */
@hitEffect
export class BurnOnHitEffect extends HitEffectBase {
    onHit(ctx: GameHitContext): void {
        const ratio = this.data.burnRatio ?? 0.2;
        const tickInterval = this.data.burnTickInterval ?? 0.1;
        const duration = this.data.burnDuration ?? 5;
        const ticksPerSec = 1 / tickInterval;
        const damagePerStack = Math.max(1, Math.round(ctx.baseDamage * ratio / ticksPerSec));

        const burnBuff: BuffData = {
            id: this.data.burnBuffId ?? 8001,
            name: `灼烧(${Math.round(ratio * 100)}%)`,
            duration,
            maxStack: this.data.burnMaxStack ?? 99,
            tickInterval,
            stackDecayOnTick: false,
            effectClass: 'BurnDotEffect',
            damagePerStack,
        };

        ctx.targetBuffMgr.addBuff(burnBuff, ctx.targetBuffOwner);
    }
}
