import { HitEffectBase } from '../../baseSystem/hitEffect';
import { hitEffect } from '../../baseSystem/hitEffect';
import { ProbabilityCooldown } from './ProbabilityCooldown';
import type { ShootEventContext, GameHitContext } from './types';

/**
 * 扳机狂热 —— 速射流"概率双发"样板效果。
 *
 * 每次玩家发射一箭，按 `chance` 概率追加一发第二箭：
 *   - 延迟 `delaySec` 秒（默认 80ms，营造"先后错位"的听感视觉感）
 *   - 位置偏移 `offsetFactor` × 玩家面向（默认 -40，即"落后一点"）
 *   - 伤害倍率 `damageRatio`（默认 1.0）
 *   - 可选 `cooldownSec` 触发后进入冷却（默认 0，无冷却）
 *
 * 为什么第二箭要"延后"：
 *   - 区分于 multi-shot（同帧多箭扇形）
 *   - 玩家能清楚听到"哒-哒"两声，视觉上看到两支前后
 *
 * 这是"onShoot 钩子 + ProbabilityCooldown 工具"组合使用的**样板**。
 * 其他"每次发射类效果"（如 split-arrow）都按这个模式写。
 */
@hitEffect('TriggerHappyEffect')
export class TriggerHappyEffect extends HitEffectBase {
    private readonly _prob: ProbabilityCooldown;
    private readonly _delaySec: number;
    private readonly _offsetFactor: number;
    private readonly _damageRatio: number;

    constructor(data: any) {
        super(data);
        this._prob = new ProbabilityCooldown({
            chance:      data.chance      ?? 0.3,
            cooldownSec: data.cooldownSec ?? 0,
        });
        this._delaySec     = data.delaySec     ?? 0.08;
        this._offsetFactor = data.offsetFactor ?? -40;
        this._damageRatio  = data.damageRatio  ?? 1.0;
    }

    /** 样板 effect 不关心命中敌人本身 */
    onHit(_ctx: GameHitContext): void { /* no-op */ }

    onShoot(ctx: ShootEventContext): void {
        const now = performance.now() / 1000;
        if (!this._prob.tryTrigger(now)) return;

        // 偏移方向：玩家面向 × offsetFactor（body.scaleX 未在 ctx，保守用目标方向）
        // 若有 targetEnemyNode，x 方向朝目标反向"落后"；无则沿默认 x 负向
        const targetX = ctx.targetEnemyNode?.worldPosition.x ?? ctx.originWorldPos.x + 1;
        const facing = targetX >= ctx.originWorldPos.x ? 1 : -1;

        ctx.fireExtra({
            delaySec:    this._delaySec,
            offsetX:     -this._offsetFactor * facing,  // 负号 = 落后一点
            offsetY:     0,
            damageRatio: this._damageRatio,
        });
    }
}
