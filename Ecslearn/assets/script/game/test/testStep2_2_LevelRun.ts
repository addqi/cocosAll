/**
 * Step 2.2 — LevelRun 本局状态容器
 *
 * 对应文档：assets/design/阶段2-关卡系统/05-关卡MVP-波次与升级.md §五
 *
 * 本测试只验证"数据袋"本身的行为：
 *   - 初值正确 / startNew 回到初值
 *   - setter 方法各自工作
 *   - tick(dt) 只在战斗阶段累计
 *   - reroll 边界（quota<=0 时 consume 返回 false）
 *
 * 不涉及 LevelManager 的 phase 转换逻辑（那是 Step 2.4 / 2.9）
 */
import { TestRegistry } from './TestRegistry';
import { LevelRun } from '../level/LevelRun';
import { LevelPhase } from '../level/LevelPhase';

function assert(cond: unknown, msg: string): asserts cond {
    if (!cond) throw new Error(msg);
}

function assertEq<T>(actual: T, expected: T, label: string): void {
    if (actual !== expected) {
        throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
    }
}

// ── 用例 1：新局初始化 ───────────────────────────────

TestRegistry.register('Step2.2 / 用例1 startNew 初值正确', () => {
    const run = LevelRun.startNew();

    assertEq(run.phase, LevelPhase.Idle, 'phase');
    assertEq(run.waveIndex, 0, 'waveIndex');
    assertEq(run.waveElapsed, 0, 'waveElapsed');
    assertEq(run.upgradeRerollQuota, 1, 'upgradeRerollQuota 默认 1');
    assertEq(run.appliedUpgradeIds.size, 0, 'appliedUpgradeIds 应为空 Set');
    assert(LevelRun.current === run, 'LevelRun.current 应指向新实例');
});

// ── 用例 2：连续开局不串数据 ─────────────────────────

TestRegistry.register('Step2.2 / 用例2 连续 startNew 不串数据', () => {
    const first = LevelRun.startNew();
    first.setWaveIndex(3);
    first.markUpgradeApplied('rapid-fire');

    assertEq(first.waveIndex, 3, '第一局 waveIndex=3');
    assertEq(first.appliedUpgradeIds.size, 1, '第一局 appliedUpgradeIds 有 1 个');

    const second = LevelRun.startNew();
    assertEq(second.waveIndex, 0, '第二局 waveIndex 应回到 0');
    assertEq(second.appliedUpgradeIds.size, 0, '第二局 appliedUpgradeIds 应空');
    assert(LevelRun.current === second, 'current 应指向第二局');
    assert(first !== second, '两局必须是不同实例');
});

// ── 用例 3：reroll quota 可增可减 ───────────────────

TestRegistry.register('Step2.2 / 用例3 reroll quota 增减序列', () => {
    const run = LevelRun.startNew(1);
    assertEq(run.upgradeRerollQuota, 1, '初值 1');

    run.addRerollQuota(2);
    assertEq(run.upgradeRerollQuota, 3, 'addRerollQuota(2) 后 = 3');

    assertEq(run.consumeReroll(), true,  'consume 应返回 true');
    assertEq(run.upgradeRerollQuota, 2,  'consume 后 = 2');

    assertEq(run.consumeReroll(), true,  'consume 应返回 true');
    assertEq(run.upgradeRerollQuota, 1,  'consume 后 = 1');
});

// ── 用例 4：consumeReroll 在 quota=0 时返回 false ────

TestRegistry.register('Step2.2 / 用例4 quota=0 时 consumeReroll 返回 false', () => {
    const run = LevelRun.startNew(0);
    assertEq(run.upgradeRerollQuota, 0, '初值 0');
    assertEq(run.consumeReroll(), false, 'quota=0 时 consume 应返回 false');
    assertEq(run.upgradeRerollQuota, 0,  'quota 保持 0');
});

// ── 用例 5：addRerollQuota 不会让 quota 变负 ─────────

TestRegistry.register('Step2.2 / 用例5 addRerollQuota 负值裁剪到 0', () => {
    const run = LevelRun.startNew(1);
    run.addRerollQuota(-10);
    assertEq(run.upgradeRerollQuota, 0, '负 delta 不会让 quota 为负');
});

// ── 用例 6：tick 只在战斗阶段累计 waveElapsed ────────

TestRegistry.register('Step2.2 / 用例6 tick 阶段敏感', () => {
    const run = LevelRun.startNew();

    // Idle：不累计
    run.setPhase(LevelPhase.Idle);
    run.tick(0.5);
    assertEq(run.waveElapsed, 0, 'Idle 不应累计');

    // Spawning：累计
    run.setPhase(LevelPhase.Spawning);
    run.tick(0.5);
    assertEq(run.waveElapsed, 0.5, 'Spawning 应累计 0.5');

    // Upgrading：不累计（冻结）
    run.setPhase(LevelPhase.Upgrading);
    run.tick(1);
    assertEq(run.waveElapsed, 0.5, 'Upgrading 不应累计');

    // Clearing：累计
    run.setPhase(LevelPhase.Clearing);
    run.tick(0.3);
    assertEq(run.waveElapsed, 0.8, 'Clearing 应累计 +0.3');

    // Collecting：累计
    run.setPhase(LevelPhase.Collecting);
    run.tick(0.2);
    assertEq(Math.round(run.waveElapsed * 10) / 10, 1, 'Collecting 应累计到 1');

    // Victory / GameOver：不累计
    run.setPhase(LevelPhase.Victory);
    run.tick(5);
    assertEq(Math.round(run.waveElapsed * 10) / 10, 1, 'Victory 不应累计');

    run.setPhase(LevelPhase.GameOver);
    run.tick(5);
    assertEq(Math.round(run.waveElapsed * 10) / 10, 1, 'GameOver 不应累计');
});

// ── 用例 7：setWaveIndex 重置 waveElapsed ───────────

TestRegistry.register('Step2.2 / 用例7 setWaveIndex 重置 waveElapsed', () => {
    const run = LevelRun.startNew();
    run.setPhase(LevelPhase.Spawning);
    run.tick(5);
    assertEq(run.waveElapsed, 5, 'tick 后 waveElapsed=5');

    run.setWaveIndex(1);
    assertEq(run.waveIndex, 1, 'waveIndex=1');
    assertEq(run.waveElapsed, 0, '换波后 waveElapsed 应归零');
});

// ── 用例 8：setWaveIndex 负值被忽略 ─────────────────

TestRegistry.register('Step2.2 / 用例8 setWaveIndex 负值被拒且触发 warn', () => {
    const run = LevelRun.startNew();
    run.setWaveIndex(2);

    // 拦截 warn —— 这是预期行为，不让它污染测试日志
    const origWarn = console.warn;
    let warnCount = 0;
    console.warn = () => { warnCount++; };
    try {
        run.setWaveIndex(-1);
    } finally {
        console.warn = origWarn;
    }

    assertEq(run.waveIndex, 2, '负值应被忽略，保持 2');
    assertEq(warnCount, 1, '应恰好触发 1 次 warn');
});

// ── 用例 9：appliedUpgradeIds 去重 + 只读视图 ────────

TestRegistry.register('Step2.2 / 用例9 appliedUpgradeIds 去重且外部不可直接改', () => {
    const run = LevelRun.startNew();
    run.markUpgradeApplied('fire-arrow');
    run.markUpgradeApplied('fire-arrow');  // 重复
    run.markUpgradeApplied('multi-shot');
    assertEq(run.appliedUpgradeIds.size, 2, '去重后应为 2');
    assert(run.appliedUpgradeIds.has('fire-arrow'), '含 fire-arrow');
    assert(run.appliedUpgradeIds.has('multi-shot'), '含 multi-shot');

    // TS 编译期 readonly 阻止 .add；运行期 Set 仍可被强转后改，这里只做"类型约定"校验
    // 真正保护在"约定 + code review"，不在语言层
});
