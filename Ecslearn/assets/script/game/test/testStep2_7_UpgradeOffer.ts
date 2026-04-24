/**
 * Step 2.7 — UpgradeOfferSystem 抽卡器
 *
 * 对应文档：assets/design/阶段2-关卡系统/05-关卡MVP-波次与升级.md §十
 *
 * 覆盖（文档 5 用例 + 必要边界）：
 *   - 用例1: rollOffer(3) 返 3 条且无重复
 *   - 用例2: applyChoice 后该 id 不再出现在新 roll 里
 *   - 用例3: 进化版在前置齐全前不入池、齐全后入池
 *   - 用例4: 权重分布 tier=1 频率 > tier=3（抽 1000 次）
 *   - 用例5: 候选池 < count 时返回实际数量
 *
 * 为避免依赖真实 UpgradeManager 的 buff/hitEffect target 装配，
 * 本测试用轻量 mock（只实现 has / apply），逻辑不打折扣。
 */
import { TestRegistry } from './TestRegistry';
import { UpgradeOfferSystem } from '../level/upgrade/UpgradeOfferSystem';
import type { UpgradeConfig } from '../upgrade/types';
import type { UpgradeManager } from '../upgrade/UpgradeManager';

function assert(cond: unknown, msg: string): asserts cond {
    if (!cond) throw new Error(msg);
}
function assertEq<T>(actual: T, expected: T, label: string): void {
    if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
}

// ─── Mock ──────────────────────────────────────────

/** 最小 UpgradeManager mock：仅实现 rollOffer / applyChoice 依赖的 API */
class MockUpgradeManager {
    private _applied = new Set<string>();
    apply(cfg: UpgradeConfig): boolean {
        if (this._applied.has(cfg.id)) return false;
        this._applied.add(cfg.id);
        return true;
    }
    has(id: string): boolean { return this._applied.has(id); }
    get appliedIds(): string[] { return [...this._applied]; }
}
function mockManager(): UpgradeManager {
    return new MockUpgradeManager() as unknown as UpgradeManager;
}

function mkCfg(id: string, tier = 1, evolvesFrom?: string[]): UpgradeConfig {
    return {
        id, name: id, desc: '', tier,
        rarity: 'common', category: 'attr',
        effects: [],
        evolvesFrom,
    };
}

// ─── 用例 1：抽满 3 张，无重复 ─────────────────────

TestRegistry.register('Step2.7 / 用例1 rollOffer(3) 返 3 条无重复', () => {
    const mgr = mockManager();
    const pool = [
        mkCfg('a', 1), mkCfg('b', 1), mkCfg('c', 2),
        mkCfg('d', 2), mkCfg('e', 3),
    ];
    const sys = new UpgradeOfferSystem(mgr, pool);

    for (let run = 0; run < 20; run++) {
        const offers = sys.rollOffer(3);
        assertEq(offers.length, 3, 'offers.length');
        const ids = new Set(offers.map(o => o.id));
        assertEq(ids.size, 3, '无重复');
    }
});

// ─── 用例 2：applyChoice 后永久剔除 ────────────────

TestRegistry.register('Step2.7 / 用例2 applyChoice 后 100 次 roll 不含该 id', () => {
    const mgr = mockManager();
    const pool = [mkCfg('a', 1), mkCfg('b', 1), mkCfg('c', 1), mkCfg('d', 1)];
    const sys = new UpgradeOfferSystem(mgr, pool);

    const ok = sys.applyChoice('a');
    assertEq(ok, true, 'applyChoice 返 true');

    for (let i = 0; i < 100; i++) {
        const offers = sys.rollOffer(3);
        for (const o of offers) {
            assert(o.id !== 'a', `第 ${i} 次 roll 不应出现 "a"`);
        }
    }
});

// ─── 用例 3：进化版前置门槛 ─────────────────────────

TestRegistry.register('Step2.7 / 用例3 进化版在前置齐全前不入池', () => {
    const mgr = mockManager();
    const base = mkCfg('multi-shot', 1);
    const evo  = mkCfg('barrage-shot', 2, ['multi-shot']);
    const sys = new UpgradeOfferSystem(mgr, [base, evo]);

    // 未 apply multi-shot 前，进化版不可入池
    assertEq(sys.isEligible(base), true,  'base 可入池');
    assertEq(sys.isEligible(evo),  false, 'evo 未齐前置不可入池');

    // apply multi-shot 后，evo 入池；base 自己已选被剔除
    sys.applyChoice('multi-shot');
    assertEq(sys.isEligible(base), false, 'base 已选后不可入池');
    assertEq(sys.isEligible(evo),  true,  'evo 前置齐全可入池');

    // roll 10 次应总能抽到 evo（因为池里就只剩它）
    for (let i = 0; i < 10; i++) {
        const offers = sys.rollOffer(3);
        assert(offers.some(o => o.id === 'barrage-shot'), `第 ${i} 次应抽到 evo`);
    }
});

// ─── 用例 4：权重分布 tier=1 频率 > tier=3 ─────────

TestRegistry.register('Step2.7 / 用例4 权重分布 tier 越高抽到越少', () => {
    const mgr = mockManager();
    const pool = [
        mkCfg('t1a', 1), mkCfg('t1b', 1), mkCfg('t1c', 1),
        mkCfg('t3a', 3), mkCfg('t3b', 3), mkCfg('t3c', 3),
    ];
    const sys = new UpgradeOfferSystem(mgr, pool);

    const counts: Record<string, number> = {};
    for (let i = 0; i < 2000; i++) {
        // 每次抽 1 个，不 apply，池不变
        const offers = sys.rollOffer(1);
        if (offers.length > 0) {
            counts[offers[0].id] = (counts[offers[0].id] ?? 0) + 1;
        }
    }

    const t1 = (counts['t1a'] ?? 0) + (counts['t1b'] ?? 0) + (counts['t1c'] ?? 0);
    const t3 = (counts['t3a'] ?? 0) + (counts['t3b'] ?? 0) + (counts['t3c'] ?? 0);
    // 线性权重下：t1 每条权重 1，t3 每条权重 1/3
    // 总权重 = 3*1 + 3*(1/3) = 4；t1 占 3/4=75%，t3 占 1/4=25%
    // 允许 ±5% 抖动
    const t1Ratio = t1 / 2000;
    const t3Ratio = t3 / 2000;
    assert(t1Ratio > 0.68 && t1Ratio < 0.82, `t1 比例 ≈ 0.75，实际 ${t1Ratio.toFixed(3)}`);
    assert(t3Ratio > 0.18 && t3Ratio < 0.32, `t3 比例 ≈ 0.25，实际 ${t3Ratio.toFixed(3)}`);
    assert(t1 > t3, `tier=1 总次数(${t1}) 应 > tier=3 总次数(${t3})`);
});

// ─── 用例 5：候选池 < count 返实际数量 ─────────────

TestRegistry.register('Step2.7 / 用例5 候选池不足不补位', () => {
    const mgr = mockManager();
    // 池里只有 2 条
    const pool = [mkCfg('a', 1), mkCfg('b', 2)];
    const sys = new UpgradeOfferSystem(mgr, pool);

    const offers = sys.rollOffer(3);
    assertEq(offers.length, 2, '池 2 条 roll(3) 应返 2');
});

// ─── 用例 6（边界）：空池 ───────────────────────────

TestRegistry.register('Step2.7 / 用例6 空池 rollOffer 返空数组', () => {
    const mgr = mockManager();
    const sys = new UpgradeOfferSystem(mgr, []);
    const offers = sys.rollOffer(3);
    assertEq(offers.length, 0, '空池返 0 条');
});

// ─── 用例 7（边界）：applyChoice 未知 id 返 false ────

TestRegistry.register('Step2.7 / 用例7 applyChoice 未知 id 返 false', () => {
    const mgr = mockManager();
    const sys = new UpgradeOfferSystem(mgr, [mkCfg('a', 1)]);

    // 拦 warn 让测试日志干净
    const orig = console.warn;
    console.warn = () => {};
    try {
        assertEq(sys.applyChoice('no-such-id'), false, 'unknown id');
    } finally {
        console.warn = orig;
    }
});

// ─── 用例 8（边界）：同一 id 连续 applyChoice 第二次返 false ──

TestRegistry.register('Step2.7 / 用例8 applyChoice 重复调 第二次返 false', () => {
    const mgr = mockManager();
    const sys = new UpgradeOfferSystem(mgr, [mkCfg('a', 1)]);

    assertEq(sys.applyChoice('a'), true, '第一次返 true');

    const orig = console.warn;
    console.warn = () => {};
    try {
        assertEq(sys.applyChoice('a'), false, '第二次返 false');
    } finally {
        console.warn = orig;
    }
});
