/**
 * Step 2.3 — WaveScheduler 刷怪调度（纯逻辑层）
 *
 * 对应文档：assets/design/阶段2-关卡系统/05-关卡MVP-波次与升级.md §六
 *
 * 策略：
 *   Step 2.3 拆成两层（Linus 式"纯逻辑 vs Cocos 胶水"）：
 *     - WaveScheduler：输入 rule → 输出 SpawnEvent 时间序列 / 位置计算（纯函数，可测）
 *     - WaveDirector： 把 SpawnEvent 翻译成 new Node + addComponent（依赖 Cocos）
 *   测试只覆盖 Scheduler，Director 的节点生成靠运行时验证
 *
 * 覆盖：
 *   - 用例 1: burst 一帧全出
 *   - 用例 2: over-time 平摊（按 dt 推进分批到期）
 *   - 用例 3: ring 位置半径正确
 *   - 边界：count=1 / count=0 / 多 rule 并行 / isDone
 */
import { Vec3 } from 'cc';
import { TestRegistry } from './TestRegistry';
import { WaveScheduler } from '../level/WaveScheduler';
import type { WaveConfig, SpawnerRule } from '../config/waveConfig';

function assert(cond: unknown, msg: string): asserts cond {
    if (!cond) throw new Error(msg);
}

function assertEq<T>(actual: T, expected: T, label: string): void {
    if (actual !== expected) {
        throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
    }
}

function assertClose(actual: number, expected: number, tolerance: number, label: string): void {
    if (Math.abs(actual - expected) > tolerance) {
        throw new Error(`${label}: expected ≈ ${expected} (±${tolerance}), got ${actual}`);
    }
}

function makeRule(overrides: Partial<SpawnerRule> = {}): SpawnerRule {
    return {
        enemyId: 'warrior',
        count: 5,
        timing: 'burst',
        pattern: 'ring',
        ringRadius: 300,
        ...overrides,
    };
}

function makeWave(spawners: SpawnerRule[], duration = 30): WaveConfig {
    return {
        index: 1,
        duration,
        spawners,
    };
}

const ORIGIN = new Vec3(0, 0, 0);

// ── 用例 1：burst 一帧全出 ────────────────────────

TestRegistry.register('Step2.3 / 用例1 burst 一帧全出', () => {
    const sch = new WaveScheduler();
    sch.startWave(makeWave([makeRule({ count: 5, timing: 'burst' })]), ORIGIN);

    const events = sch.tick(0.016);  // 一帧 dt
    assertEq(events.length, 5, 'burst 首 tick 应一次吐 5 只');
    assert(sch.isDone(), 'burst 后 Scheduler 应已完成');

    const nextFrame = sch.tick(0.016);
    assertEq(nextFrame.length, 0, '后续 tick 不应再吐事件');
});

// ── 用例 2：over-time 平摊 ────────────────────────

TestRegistry.register('Step2.3 / 用例2 over-time 按时间分批到期', () => {
    // count=6, duration=3s → step=0.5s
    // 时间点：0 / 0.5 / 1.0 / 1.5 / 2.0 / 2.5
    const sch = new WaveScheduler();
    sch.startWave(
        makeWave([makeRule({ count: 6, timing: 'over-time' })], 3),
        ORIGIN,
    );

    // 0s（startWave 后立即 tick 一点点 dt）：只有 timing=0 的那只
    const at0 = sch.tick(0.001);
    assertEq(at0.length, 1, '0s 应 1 只');

    // 再推进 1.0s → 累计 1.001s，应覆盖 0.5 / 1.0 两个时间点
    const at1 = sch.tick(1.0);
    assertEq(at1.length, 2, '+1.0s 应再吐 2 只（累计 3 只）');

    // 再推进 2.0s → 累计 3.001s，剩下 3 只全到期
    const at3 = sch.tick(2.0);
    assertEq(at3.length, 3, '+2.0s 应再吐 3 只');
    assert(sch.isDone(), '3s 后应完成');
});

// ── 用例 3：ring 位置半径正确（±1px 容差） ────────

TestRegistry.register('Step2.3 / 用例3 ring 半径正确且均匀分布', () => {
    const R = 300;
    const sch = new WaveScheduler();
    sch.startWave(
        makeWave([makeRule({ count: 8, timing: 'burst', pattern: 'ring', ringRadius: R })]),
        ORIGIN,
    );

    const events = sch.drainAll();
    assertEq(events.length, 8, 'drainAll 应拿到 8 个事件');

    for (const e of events) {
        const dx = e.worldPos.x;
        const dy = e.worldPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        assertClose(dist, R, 1, `ring 第 ${e.indexInRule} 只到原点距离`);
    }

    // 等分角度：任意两相邻的 indexInRule 角度差 = 2π/8 = 45°
    const angles = events
        .sort((a, b) => a.indexInRule - b.indexInRule)
        .map(e => Math.atan2(e.worldPos.y, e.worldPos.x));
    for (let i = 1; i < angles.length; i++) {
        let diff = angles[i] - angles[i - 1];
        // atan2 在 π/-π 跳变处要做归一
        if (diff < 0) diff += Math.PI * 2;
        assertClose(diff, Math.PI / 4, 0.01, `相邻角度差 i=${i}`);
    }
});

// ── 用例 4：count=1 over-time 立即吐 ──────────────

TestRegistry.register('Step2.3 / 用例4 over-time count=1 立即吐', () => {
    const sch = new WaveScheduler();
    sch.startWave(
        makeWave([makeRule({ count: 1, timing: 'over-time' })], 10),
        ORIGIN,
    );
    const events = sch.tick(0.001);
    assertEq(events.length, 1, 'count=1 应立即吐');
    assert(sch.isDone(), '完成');
});

// ── 用例 5：多 rule 并行 ─────────────────────────

TestRegistry.register('Step2.3 / 用例5 多 rule 并行计数正确', () => {
    const sch = new WaveScheduler();
    sch.startWave(
        makeWave([
            makeRule({ enemyId: 'warrior', count: 3, timing: 'burst', pattern: 'ring', ringRadius: 200 }),
            makeRule({ enemyId: 'ranger',  count: 2, timing: 'burst', pattern: 'random' }),
        ]),
        ORIGIN,
    );

    const events = sch.drainAll();
    assertEq(events.length, 5, '两条 rule 共 5 只');

    const warriors = events.filter(e => e.enemyId === 'warrior');
    const rangers  = events.filter(e => e.enemyId === 'ranger');
    assertEq(warriors.length, 3, 'warrior 3 只');
    assertEq(rangers.length, 2, 'ranger 2 只');
    // rule index 正确
    assert(warriors.every(e => e.ruleIndex === 0), 'warrior 都来自 rule 0');
    assert(rangers.every(e => e.ruleIndex === 1), 'ranger 都来自 rule 1');
});

// ── 用例 6：abort 中止 ───────────────────────────

TestRegistry.register('Step2.3 / 用例6 abort 后 tick 无输出', () => {
    const sch = new WaveScheduler();
    sch.startWave(
        makeWave([makeRule({ count: 10, timing: 'over-time' })], 10),
        ORIGIN,
    );
    sch.tick(0.001);  // 吐 1 只
    sch.abort();

    const after = sch.tick(100);  // 推很久
    assertEq(after.length, 0, 'abort 后应无输出');
});

// ── 用例 7：startWave 之前 tick 不崩 ─────────────

TestRegistry.register('Step2.3 / 用例7 未 startWave 时 tick 安全', () => {
    const sch = new WaveScheduler();
    const events = sch.tick(1);
    assertEq(events.length, 0, '空 tick 应返回空数组');
    assertEq(sch.isStarted, false, 'isStarted=false');
});

// ── 用例 8：center 偏移 —— ring 位置跟随玩家 ──────

TestRegistry.register('Step2.3 / 用例8 ring 以 center 为原点', () => {
    const sch = new WaveScheduler();
    const center = new Vec3(100, 200, 0);
    sch.startWave(
        makeWave([makeRule({ count: 4, timing: 'burst', pattern: 'ring', ringRadius: 50 })]),
        center,
    );

    const events = sch.drainAll();
    for (const e of events) {
        const dx = e.worldPos.x - 100;
        const dy = e.worldPos.y - 200;
        const dist = Math.sqrt(dx * dx + dy * dy);
        assertClose(dist, 50, 1, `到 center 距离`);
    }
});
