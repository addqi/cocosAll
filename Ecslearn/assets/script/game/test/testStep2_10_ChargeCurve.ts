/**
 * Step 2.10.4 — 蓄力伤害曲线 + chargeSec 累加逻辑
 *
 * 覆盖：
 *   A 组 computeChargeDamageRatio（纯函数）
 *     A1 chargeSec=0         → 1.0
 *     A2 chargeSec=maxCharge → maxRatio
 *     A3 chargeSec=2*max     → maxRatio（截断）
 *     A4 chargeSec=0.5*max   → 1 + 0.5 * (maxRatio - 1)
 *     A5 maxChargeSec=0 防御 → 1.0（防 NaN）
 *     A6 负 chargeSec → 1.0（clamp 下限）
 *
 *   B 组 ArcherBehavior.tickInput（蓄力累加）
 *     B1 非蓄力模式下 tickInput 什么都不做
 *     B2 按住 Attack 时 chargeSec 累加
 *     B3 justReleased 时 pendingChargeSec = chargeSec，chargeSec 归 0
 *     B4 未按 Attack 时 chargeSec 归 0
 *
 *   C 组 getMoveSpeedRatio
 *     C1 非蓄力模式恒返 1
 *     C2 蓄力模式未按 Attack 返 1
 *     C3 蓄力模式 chargeSec > 0 返 moveSpeedRatio
 */

import { TestRegistry } from './TestRegistry';
import {
    computeChargeDamageRatio,
} from '../player/archer/ArcherAttackState';
import { ArcherBehavior } from '../player/archer/ArcherBehavior';
import { ActionComp, EAction } from '../component';
import type { PlayerCtx } from '../player/states/PlayerContext';
import type { ShootModeCharge } from '../config/classConfig/ClassConfigLoader';

function assert(cond: unknown, msg: string): asserts cond {
    if (!cond) throw new Error(msg);
}
function assertNear(actual: number, expected: number, eps: number, label: string): void {
    if (Math.abs(actual - expected) > eps) {
        throw new Error(`${label}: expected ≈${expected} (±${eps}), got ${actual}`);
    }
}

// ─── A 组 曲线纯函数 ─────────────────────────────────

TestRegistry.register('Step2.10.4-A', '用例1', 'chargeSec=0 → 1.0x', () => {
    assertNear(computeChargeDamageRatio(0, 1.0, 2.0), 1.0, 1e-6, '零蓄力');
});
TestRegistry.register('Step2.10.4-A', '用例2', 'chargeSec=max → maxRatio', () => {
    assertNear(computeChargeDamageRatio(1.0, 1.0, 2.0), 2.0, 1e-6, '满蓄力');
});
TestRegistry.register('Step2.10.4-A', '用例3', 'chargeSec 超过 max 截断', () => {
    assertNear(computeChargeDamageRatio(5.0, 1.0, 2.0), 2.0, 1e-6, '超蓄应截断');
});
TestRegistry.register('Step2.10.4-A', '用例4', 'chargeSec=0.5*max 线性中点', () => {
    assertNear(computeChargeDamageRatio(0.5, 1.0, 2.0), 1.5, 1e-6, '线性中点');
});
TestRegistry.register('Step2.10.4-A', '用例5', 'maxChargeSec=0 防御', () => {
    assertNear(computeChargeDamageRatio(0.5, 0, 2.0), 1.0, 1e-6, 'max=0 应返 1');
});
TestRegistry.register('Step2.10.4-A', '用例6', '负 chargeSec clamp 到 0', () => {
    assertNear(computeChargeDamageRatio(-0.5, 1.0, 2.0), 1.0, 1e-6, '负值下限');
});

// ─── B 组 tickInput 累加 ─────────────────────────────

/** 最小 PlayerCtx mock：只要 chargeSec / pendingChargeSec 两个字段 */
function mkCtx(): PlayerCtx {
    return {
        chargeSec: 0,
        pendingChargeSec: 0,
    } as unknown as PlayerCtx;
}

function mkInput(active: EAction[] = [], released: EAction[] = []): ActionComp {
    const act = new ActionComp();
    for (const a of active) act.active.add(a);
    for (const r of released) act.justReleased.add(r);
    return act;
}

function mkBehaviorWithMode(mode: 'hold' | 'click' | 'charge'): ArcherBehavior {
    const b = new ArcherBehavior();
    // 通过 behavior_command 设置 shoot mode，和运行时路径一致
    if (mode === 'charge') {
        const cm: ShootModeCharge = {
            type: 'charge', maxChargeSec: 1.0, maxDamageRatio: 2.0, moveSpeedRatio: 0.5,
        };
        b.onBehaviorCommand('set_shoot_mode', cm);
    } else {
        b.onBehaviorCommand('set_shoot_mode', { type: mode });
    }
    return b;
}

TestRegistry.register('Step2.10.4-B', '用例1', '非蓄力模式 tickInput 不累加', () => {
    const b = mkBehaviorWithMode('hold');
    const ctx = mkCtx();
    const input = mkInput([EAction.Attack]);
    b.tickInput(ctx, input, 0.5);
    assert(ctx.chargeSec === 0, `非蓄力 chargeSec 应为 0，实际 ${ctx.chargeSec}`);
});

TestRegistry.register('Step2.10.4-B', '用例2', '蓄力模式按住累加', () => {
    const b = mkBehaviorWithMode('charge');
    const ctx = mkCtx();
    const input = mkInput([EAction.Attack]);
    b.tickInput(ctx, input, 0.3);
    assertNear(ctx.chargeSec, 0.3, 1e-6, '一帧累加 0.3s');
    b.tickInput(ctx, input, 0.2);
    assertNear(ctx.chargeSec, 0.5, 1e-6, '两帧累加到 0.5s');
});

TestRegistry.register('Step2.10.4-B', '用例3', '松开瞬间冻结到 pendingChargeSec', () => {
    const b = mkBehaviorWithMode('charge');
    const ctx = mkCtx();
    // 先按住累一点
    b.tickInput(ctx, mkInput([EAction.Attack]), 0.7);
    // 松开那一帧
    b.tickInput(ctx, mkInput([], [EAction.Attack]), 0.016);
    assertNear(ctx.pendingChargeSec, 0.7, 1e-6, 'pendingChargeSec 应冻结前一帧值');
    assert(ctx.chargeSec === 0, `chargeSec 应归 0，实际 ${ctx.chargeSec}`);
});

TestRegistry.register('Step2.10.4-B', '用例4', '未按 Attack 时 chargeSec 归 0', () => {
    const b = mkBehaviorWithMode('charge');
    const ctx = mkCtx();
    ctx.chargeSec = 0.5;
    b.tickInput(ctx, mkInput([]), 0.016);
    assert(ctx.chargeSec === 0, `松开等帧 chargeSec 应归 0，实际 ${ctx.chargeSec}`);
});

// ─── C 组 getMoveSpeedRatio ─────────────────────────

TestRegistry.register('Step2.10.4-C', '用例1', '非蓄力模式移速 = 1', () => {
    const b = mkBehaviorWithMode('hold');
    const ctx = mkCtx();
    ctx.chargeSec = 0.5;
    assertNear(b.getMoveSpeedRatio(ctx), 1.0, 1e-6, '非蓄力恒 1');
});

TestRegistry.register('Step2.10.4-C', '用例2', '蓄力模式未蓄力时移速 = 1', () => {
    const b = mkBehaviorWithMode('charge');
    const ctx = mkCtx();
    ctx.chargeSec = 0;
    assertNear(b.getMoveSpeedRatio(ctx), 1.0, 1e-6, '蓄力中未按 Attack 恒 1');
});

TestRegistry.register('Step2.10.4-C', '用例3', '蓄力模式蓄力中移速 = moveSpeedRatio', () => {
    const b = mkBehaviorWithMode('charge');
    const ctx = mkCtx();
    ctx.chargeSec = 0.3;
    assertNear(b.getMoveSpeedRatio(ctx), 0.5, 1e-6, '蓄力中应 × 0.5');
});
