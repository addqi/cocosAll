/**
 * Step 2.4 — 清场判定（纯函数 nextPhase）
 *
 * 对应文档：assets/design/阶段2-关卡系统/05-关卡MVP-波次与升级.md §七
 *
 * 测试覆盖 nextPhase 所有分支：
 *   - Spawning: 全灭 / 超时 / 正常持续
 *   - Clearing: 等敌人清完 / 卡住
 *   - Collecting: 等金币收完 / 卡住
 *   - 其他 phase: 不自动转（由外部指令驱动）
 *   - 边界：超时优先级高于全灭
 *
 * 不覆盖 LevelManager 自身（要 Cocos 场景），只保 pure 逻辑层正确
 */
import { TestRegistry } from './TestRegistry';
import { LevelPhase } from '../level/LevelPhase';
import { nextPhase, type PhaseSignals } from '../level/LevelPhaseTransition';

function assert(cond: unknown, msg: string): asserts cond {
    if (!cond) throw new Error(msg);
}

function assertEq<T>(actual: T, expected: T, label: string): void {
    if (actual !== expected) {
        throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
    }
}

/** 默认信号：一波刚开始、场上有敌人、调度器还在派 —— 应保持 Spawning */
function mkSignals(overrides: Partial<PhaseSignals> = {}): PhaseSignals {
    return {
        waveElapsed:   1.0,
        waveDuration:  30,
        aliveCount:    3,
        schedulerDone: false,
        coinOnField:   0,
        ...overrides,
    };
}

// ── 用例 1：Spawning 正常推进，不转换 ───────────────

TestRegistry.register('Step2.4 / 用例1 Spawning 正常推进保持不变', () => {
    const { next, action } = nextPhase(LevelPhase.Spawning, mkSignals());
    assertEq(next, null, 'next 应为 null');
    assertEq(action.emitWaveClear, undefined, '无 emitWaveClear');
    assertEq(action.despawnStragglers, undefined, '无 despawnStragglers');
});

// ── 用例 2：全灭 —— 调度器派完 + 无敌人 ─────────────

TestRegistry.register('Step2.4 / 用例2 全灭 → Clearing (killall)', () => {
    const { next, action } = nextPhase(LevelPhase.Spawning, mkSignals({
        waveElapsed:   5,
        schedulerDone: true,
        aliveCount:    0,
    }));
    assertEq(next, LevelPhase.Clearing, '进 Clearing');
    assertEq(action.emitWaveClear, 'killall', 'reason=killall');
    assertEq(action.despawnStragglers, undefined, '全灭不需要清场');
});

// ── 用例 3：调度器未派完时场上临时无敌人，不应触发全灭 ───

TestRegistry.register('Step2.4 / 用例3 调度器派怪中 aliveCount=0 不误触发', () => {
    // 典型场景：over-time 刷怪，玩家秒了第一只，下一只还没生成
    const { next } = nextPhase(LevelPhase.Spawning, mkSignals({
        waveElapsed:   2,
        schedulerDone: false,   // 还在派
        aliveCount:    0,
    }));
    assertEq(next, null, '不应切换');
});

// ── 用例 4：超时 → Clearing (timeout) ──────────────

TestRegistry.register('Step2.4 / 用例4 超时 → Clearing (timeout)', () => {
    const { next, action } = nextPhase(LevelPhase.Spawning, mkSignals({
        waveElapsed:   30,
        waveDuration:  30,
        aliveCount:    5,     // 残怪
        schedulerDone: false,
    }));
    assertEq(next, LevelPhase.Clearing, '进 Clearing');
    assertEq(action.emitWaveClear, 'timeout', 'reason=timeout');
    assertEq(action.despawnStragglers, true, '需要静默清场');
});

// ── 用例 5：超时优先级高于全灭 ─────────────────────

TestRegistry.register('Step2.4 / 用例5 同一帧超时 + 全灭 走 timeout', () => {
    // 边界：duration 到点那一帧刚好最后一只死
    const { next, action } = nextPhase(LevelPhase.Spawning, mkSignals({
        waveElapsed:   30,
        waveDuration:  30,
        aliveCount:    0,
        schedulerDone: true,
    }));
    // 按文档：超时检查在前，所以走 timeout
    assertEq(next, LevelPhase.Clearing, '进 Clearing');
    assertEq(action.emitWaveClear, 'timeout', '优先 timeout');
});

// ── 用例 6：Clearing 等敌人清完 ────────────────────

TestRegistry.register('Step2.4 / 用例6 Clearing aliveCount>0 保持', () => {
    const { next } = nextPhase(LevelPhase.Clearing, mkSignals({
        aliveCount: 2,
    }));
    assertEq(next, null, '还有敌人应保持 Clearing');
});

TestRegistry.register('Step2.4 / 用例7 Clearing aliveCount=0 → Collecting', () => {
    const { next, action } = nextPhase(LevelPhase.Clearing, mkSignals({
        aliveCount: 0,
    }));
    assertEq(next, LevelPhase.Collecting, '进 Collecting');
    assertEq(action.enterUpgrading, undefined, '此处不 enterUpgrading');
});

// ── 用例 8：Collecting 等金币收完 ─────────────────

TestRegistry.register('Step2.4 / 用例8 Collecting coinOnField>0 保持', () => {
    const { next } = nextPhase(LevelPhase.Collecting, mkSignals({
        aliveCount:  0,
        coinOnField: 3,
    }));
    assertEq(next, null, '金币未收完应保持 Collecting');
});

TestRegistry.register('Step2.4 / 用例9 Collecting coinOnField=0 → Upgrading', () => {
    const { next, action } = nextPhase(LevelPhase.Collecting, mkSignals({
        aliveCount:  0,
        coinOnField: 0,
    }));
    assertEq(next, LevelPhase.Upgrading, '进 Upgrading');
    assertEq(action.enterUpgrading, true, '触发 enterUpgrading');
});

// ── 用例 10：其他 phase 都不自动转 ────────────────

TestRegistry.register('Step2.4 / 用例10 非驱动 phase 保持不变', () => {
    const silent = [LevelPhase.Idle, LevelPhase.Upgrading, LevelPhase.Victory, LevelPhase.GameOver];
    for (const p of silent) {
        const { next, action } = nextPhase(p, mkSignals({
            aliveCount: 0, coinOnField: 0, schedulerDone: true, waveElapsed: 999,
        }));
        assertEq(next, null, `phase=${LevelPhase[p]} 不应自动转`);
        // action 应是空对象
        assert(Object.keys(action).length === 0, `phase=${LevelPhase[p]} action 应空`);
    }
});

// ── 用例 11：Spawning 只有超时信号时（aliveCount>0 schedulerDone=false）────

TestRegistry.register('Step2.4 / 用例11 仅超时、调度未完成也能触发', () => {
    const { next, action } = nextPhase(LevelPhase.Spawning, mkSignals({
        waveElapsed:   31,
        waveDuration:  30,
        aliveCount:    10,
        schedulerDone: false,  // 还没派完也没关系
    }));
    assertEq(next, LevelPhase.Clearing, 'timeout 触发');
    assertEq(action.despawnStragglers, true, '需要清场');
});
