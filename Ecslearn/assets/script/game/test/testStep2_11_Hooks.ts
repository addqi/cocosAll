/**
 * Step 2.11 — 升级钩子体系基础设施
 *
 * 覆盖：
 *   A 组 ProbabilityCooldown
 *     A1 chance=1 首次 tick 不触发（首次只记录 now 基准）
 *     A2 chance=1 第二次 tick 触发
 *     A3 chance=0 永不触发
 *     A4 冷却期间即使 chance=1 也不触发
 *     A5 ramp 模式：多次 tick 未触发时 chance 增长
 *     A6 ramp 触发后 chance 归 0
 *     A7 ramp chance 上限 maxChance
 *
 *   B 组 ComboCounter
 *     B1 add 递增返回计数
 *     B2 不同 key 互不影响
 *     B3 total() 聚合
 *     B4 clear 单 key / 全部
 *     B5 expire 按时间过滤
 *
 *   C 组 钩子链路（HitEffectMgr.executeOnShoot / onTakenDamage）
 *     C1 onShoot 钩子会被调用到 effect
 *     C2 onTakenDamage 钩子可修改 ctx.rawDamage
 *     C3 未实现 onShoot 的 effect 被安全跳过（? 可选链）
 */

import { TestRegistry } from './TestRegistry';
import { ProbabilityCooldown } from '../hitEffects/ProbabilityCooldown';
import { ComboCounter } from '../hitEffects/ComboCounter';
import { HitEffectMgr } from '../entity/HitEffectMgr';
import {
    createShootEventContext,
    createTakenDamageContext,
    type ShootExtraSpec,
} from '../hitEffects/types';
import { HitEffectBase, HitEffectFactory } from '../../baseSystem/hitEffect';

function assert(cond: unknown, msg: string): asserts cond {
    if (!cond) throw new Error(msg);
}
function assertEq<T>(a: T, b: T, label: string): void {
    if (a !== b) throw new Error(`${label}: expected ${String(b)}, got ${String(a)}`);
}

// ─── A 组 ProbabilityCooldown ────────────────────────

TestRegistry.register('Step2.11-A', '用例1', 'chance=1 首次 tick 不触发（基准帧）', () => {
    const p = new ProbabilityCooldown({ chance: 1 });
    assert(!p.tryTrigger(0), '首次调用应返 false（只记基准）');
});

TestRegistry.register('Step2.11-A', '用例2', 'chance=1 第二次 tick 必触发', () => {
    const p = new ProbabilityCooldown({ chance: 1 });
    p.tryTrigger(0);
    assert(p.tryTrigger(0.1), '第二次 tick chance=1 必触发');
});

TestRegistry.register('Step2.11-A', '用例3', 'chance=0 永不触发', () => {
    const p = new ProbabilityCooldown({ chance: 0 });
    p.tryTrigger(0);
    for (let i = 1; i <= 100; i++) {
        assert(!p.tryTrigger(i * 0.1), `第 ${i} 次 chance=0 不应触发`);
    }
});

TestRegistry.register('Step2.11-A', '用例4', '触发后冷却期内 chance=1 也不触发', () => {
    const p = new ProbabilityCooldown({ chance: 1, cooldownSec: 1 });
    p.tryTrigger(0);
    assert(p.tryTrigger(0.1), '第一次必触发');
    // 冷却中
    assert(!p.tryTrigger(0.5), '冷却期内应返 false');
    assert(!p.tryTrigger(0.9), '冷却期内应返 false');
    // 冷却结束
    assert(p.tryTrigger(1.2),  '冷却结束后应可再次触发');
});

TestRegistry.register('Step2.11-A', '用例5', 'ramp 模式未触发时 chance 累积', () => {
    // 初始 chance=0，每秒 +0.5，最多 1
    const p = new ProbabilityCooldown({
        chance: 0, rampRate: 0.5, maxChance: 1,
    });
    p.tryTrigger(0);
    // 1 秒后 chance 应为 0.5
    p.tryTrigger(1);
    const c1 = p.currentChance;
    assert(Math.abs(c1 - 0.5) < 0.001, `1 秒后 chance 应 ≈ 0.5，实际 ${c1}`);
    // 再 1 秒（chance=0.5 仍可能触发；我们看最坏情况 chance 应升高）
});

TestRegistry.register('Step2.11-A', '用例6', 'ramp 触发后 chance 归 0', () => {
    // 用 chance=1 保证必触发，rampRate>0 启用 ramp 模式
    const p = new ProbabilityCooldown({
        chance: 1, rampRate: 0.5, maxChance: 1,
    });
    p.tryTrigger(0);
    assert(p.tryTrigger(0.1), '第二 tick 必触发');
    assertEq(p.currentChance, 0, '触发后 chance 应归 0');
});

TestRegistry.register('Step2.11-A', '用例7', 'ramp chance 不超过 maxChance', () => {
    const p = new ProbabilityCooldown({
        chance: 0, rampRate: 10, maxChance: 0.5,
    });
    p.tryTrigger(0);
    p.tryTrigger(10);  // 10 秒累积本应 +100，但受 max 限
    assert(p.currentChance <= 0.5 + 1e-9, `chance 应 ≤ 0.5，实际 ${p.currentChance}`);
});

// ─── B 组 ComboCounter ───────────────────────────────

TestRegistry.register('Step2.11-B', '用例1', 'add 递增', () => {
    const c = new ComboCounter<string>();
    assertEq(c.add('a', 0), 1, '第一次 add 返 1');
    assertEq(c.add('a', 1), 2, '第二次 add 返 2');
    assertEq(c.get('a'), 2, 'get 应为 2');
});

TestRegistry.register('Step2.11-B', '用例2', '不同 key 互不影响', () => {
    const c = new ComboCounter<string>();
    c.add('a', 0);
    c.add('b', 0);
    c.add('a', 0);
    assertEq(c.get('a'), 2, 'a=2');
    assertEq(c.get('b'), 1, 'b=1');
});

TestRegistry.register('Step2.11-B', '用例3', 'total 聚合', () => {
    const c = new ComboCounter<string>();
    c.add('a', 0);
    c.add('b', 0);
    c.add('c', 0);
    c.add('a', 0);
    assertEq(c.total(), 4, 'total 应为 4');
});

TestRegistry.register('Step2.11-B', '用例4', 'clear 单 key / 全部', () => {
    const c = new ComboCounter<string>();
    c.add('a', 0); c.add('b', 0);
    c.clear('a');
    assertEq(c.get('a'), 0, 'clear 后 a=0');
    assertEq(c.get('b'), 1, 'b 不受影响');
    c.clear();
    assertEq(c.total(), 0, 'clear 全部后 total=0');
});

TestRegistry.register('Step2.11-B', '用例5', 'expire 按时间过滤', () => {
    const c = new ComboCounter<string>();
    c.add('old', 0);
    c.add('fresh', 5);
    const removed = c.expire(6, 3);  // now=6，3 秒外过期
    assertEq(removed, 1, '应移除 1 条');
    assertEq(c.get('old'), 0, 'old 应被清');
    assertEq(c.get('fresh'), 1, 'fresh 仍在');
});

// ─── C 组 钩子链路 ─────────────────────────────────────

/** mock effect：用类静态计数器记录本类实例 onShoot 被触发次数，便于测试验证 */
class RecordingShootEffect extends HitEffectBase {
    static shotCallsTotal = 0;
    onHit(_ctx: any): void { /* no-op */ }
    onShoot(_ctx: any): void { RecordingShootEffect.shotCallsTotal++; }
}
class HalfDamageEffect extends HitEffectBase {
    onHit(_ctx: any): void {}
    onTakenDamage(ctx: any): void { ctx.rawDamage *= 0.5; }
}
class NoHooksEffect extends HitEffectBase {
    onHit(_ctx: any): void {}
    // 不实现 onShoot / onTakenDamage，证明 ?.() 安全
}

// HitEffectFactory.register 的第二参数是 class constructor（不是工厂函数）
HitEffectFactory.register('__test-RecordingShoot', RecordingShootEffect);
HitEffectFactory.register('__test-HalfDamage',     HalfDamageEffect);
HitEffectFactory.register('__test-NoHooks',        NoHooksEffect);

TestRegistry.register('Step2.11-C', '用例1', 'executeOnShoot 真的调到 effect', () => {
    RecordingShootEffect.shotCallsTotal = 0;
    const mgr = new HitEffectMgr();
    mgr.add({ id: 'test-rec-1', effectClass: '__test-RecordingShoot' });

    const stubExtra = (_s: ShootExtraSpec) => {};
    const fakePos: any = { x: 0, y: 0, z: 0, clone: () => fakePos };
    const ctx = createShootEventContext(
        {} as any, {} as any, 1, fakePos, null, stubExtra,
    );
    mgr.executeOnShoot(ctx);
    mgr.executeOnShoot(ctx);
    mgr.executeOnShoot(ctx);
    assertEq(RecordingShootEffect.shotCallsTotal, 3, 'onShoot 应被调 3 次');
});

TestRegistry.register('Step2.11-C', '用例2', 'onTakenDamage 可修改 rawDamage', () => {
    const mgr = new HitEffectMgr();
    mgr.add({ id: 'test-half-1', effectClass: '__test-HalfDamage' });

    const ctx = createTakenDamageContext({} as any, {} as any, 100);
    mgr.executeOnTakenDamage(ctx);
    assertEq(ctx.rawDamage, 50, 'HalfDamageEffect 应把 100 改为 50');
});

TestRegistry.register('Step2.11-C', '用例3', '未实现的可选钩子不抛错', () => {
    const mgr = new HitEffectMgr();
    mgr.add({ id: 'test-nohooks-1', effectClass: '__test-NoHooks' });

    const stubExtra = (_s: ShootExtraSpec) => {};
    const fakePos: any = { x: 0, y: 0, z: 0, clone: () => fakePos };
    const sCtx = createShootEventContext(
        {} as any, {} as any, 1, fakePos, null, stubExtra,
    );
    const dCtx = createTakenDamageContext({} as any, {} as any, 100);

    // 不应该抛错
    mgr.executeOnShoot(sCtx);
    mgr.executeOnTakenDamage(dCtx);
    assertEq(dCtx.rawDamage, 100, 'NoHooksEffect 不改 rawDamage');
});
