/**
 * Step 2.1 — 波次配置 schema 与 loader
 *
 * 对应文档：assets/design/阶段2-关卡系统/05-关卡MVP-波次与升级.md §四
 *
 * 本步骤只验证配置层：schema 正确 + 非法输入被拦截 + enemyId 反查 EMinionType。
 * 不涉及刷怪逻辑本身（那是 Step 2.3）。
 */
import { TestRegistry } from './TestRegistry';
import {
    loadAllWaves,
    _resetWaveCache,
    _validateWaveRawForTest,
} from '../config/waveConfig';

function assert(cond: unknown, msg: string): asserts cond {
    if (!cond) throw new Error(msg);
}

function assertEq<T>(actual: T, expected: T, label: string): void {
    if (actual !== expected) {
        throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
    }
}

function assertThrows(fn: () => unknown, expectMsgIncludes: string, label: string): void {
    try {
        fn();
    } catch (e: any) {
        const msg = e?.message ?? String(e);
        if (!msg.includes(expectMsgIncludes)) {
            throw new Error(`${label}: 错误信息不包含 "${expectMsgIncludes}"，实际: ${msg}`);
        }
        return;
    }
    throw new Error(`${label}: 预期抛错但未抛`);
}

// ── 用例 1：配置可读取 + 按 index 升序 ────────────

TestRegistry.register('Step2.1 / 用例1 loadAllWaves 返回 5 条波次且 index 升序', () => {
    _resetWaveCache();
    const waves = loadAllWaves();

    assertEq(waves.length, 5, 'waves.length');
    for (let i = 0; i < waves.length; i++) {
        assertEq(waves[i].index, i + 1, `waves[${i}].index`);
        assert(waves[i].duration > 0, `waves[${i}].duration must > 0`);
        assert(waves[i].spawners.length > 0, `waves[${i}].spawners must be non-empty`);
    }
});

// ── 用例 2：非法 enemyId 被拦截 ───────────────────

TestRegistry.register('Step2.1 / 用例2 非法 enemyId 立即抛错', () => {
    assertThrows(
        () => _validateWaveRawForTest(
            {
                index: 1,
                duration: 30,
                spawners: [
                    { enemyId: 'dragon', count: 3, timing: 'burst', pattern: 'ring', ringRadius: 100 },
                ],
            },
            0,
        ),
        'enemyId "dragon"',
        '非法 enemyId',
    );
});

// ── 用例 3：缺必填字段被拦截 ──────────────────────

TestRegistry.register('Step2.1 / 用例3 缺 count 字段立即抛错', () => {
    assertThrows(
        () => _validateWaveRawForTest(
            {
                index: 1,
                duration: 30,
                spawners: [
                    { enemyId: 'warrior', timing: 'burst', pattern: 'ring', ringRadius: 100 },
                ],
            },
            0,
        ),
        'missing required field: count',
        '缺 count',
    );
});

// ── 用例 4：pattern=ring 时缺 ringRadius 被拦截 ───

TestRegistry.register('Step2.1 / 用例4 pattern=ring 时 ringRadius 必填', () => {
    assertThrows(
        () => _validateWaveRawForTest(
            {
                index: 1,
                duration: 30,
                spawners: [
                    { enemyId: 'warrior', count: 3, timing: 'burst', pattern: 'ring' },
                ],
            },
            0,
        ),
        'ringRadius',
        '缺 ringRadius',
    );
});

// ── 用例 5：非法 timing / pattern 被拦截 ──────────

TestRegistry.register('Step2.1 / 用例5 非法 timing 值被拦截', () => {
    assertThrows(
        () => _validateWaveRawForTest(
            {
                index: 1,
                duration: 30,
                spawners: [
                    { enemyId: 'warrior', count: 3, timing: 'instant', pattern: 'random' },
                ],
            },
            0,
        ),
        'timing "instant"',
        '非法 timing',
    );
});

TestRegistry.register('Step2.1 / 用例6 非法 pattern 值被拦截', () => {
    assertThrows(
        () => _validateWaveRawForTest(
            {
                index: 1,
                duration: 30,
                spawners: [
                    { enemyId: 'warrior', count: 3, timing: 'burst', pattern: 'line' },
                ],
            },
            0,
        ),
        'pattern "line"',
        '非法 pattern',
    );
});

// ── 用例 7：enemyBuffs 可选、空数组合法 ───────────

TestRegistry.register('Step2.1 / 用例7 enemyBuffs 缺省与空数组都合法', () => {
    const cfg1 = _validateWaveRawForTest(
        {
            index: 1,
            duration: 10,
            spawners: [
                { enemyId: 'warrior', count: 1, timing: 'burst', pattern: 'random' },
            ],
        },
        0,
    );
    assertEq(cfg1.enemyBuffs, undefined, 'enemyBuffs 缺省应为 undefined');

    const cfg2 = _validateWaveRawForTest(
        {
            index: 1,
            duration: 10,
            spawners: [
                { enemyId: 'warrior', count: 1, timing: 'burst', pattern: 'random' },
            ],
            enemyBuffs: [],
        },
        0,
    );
    assert(Array.isArray(cfg2.enemyBuffs) && cfg2.enemyBuffs!.length === 0, 'enemyBuffs 空数组应被接受');
});

// ── 用例 8：loadAllWaves 二次调用走缓存 ────────────

TestRegistry.register('Step2.1 / 用例8 loadAllWaves 二次调用返回同一引用', () => {
    _resetWaveCache();
    const a = loadAllWaves();
    const b = loadAllWaves();
    assert(a === b, '缓存未命中，两次返回不同引用');
});

// ── 用例 9：示例 waves.json 统计值体检 ─────────────
// 不强断言具体数字，只防"配置表被无意清空"这类低级问题。

TestRegistry.register('Step2.1 / 用例9 示例配置统计体检', () => {
    _resetWaveCache();
    const waves = loadAllWaves();

    let totalEnemies = 0;
    const enemyIds = new Set<string>();
    for (const w of waves) {
        for (const s of w.spawners) {
            totalEnemies += s.count;
            enemyIds.add(s.enemyId);
        }
    }

    assert(totalEnemies >= 30, `示例配置总怪数应 ≥ 30，当前 ${totalEnemies}`);
    assert(enemyIds.size >= 2, `示例配置至少覆盖 2 种敌人，当前 ${enemyIds.size}`);
    console.log(
        `[Step2.1][用例9] 示例波次体检：${waves.length} 波 / 总怪数 ${totalEnemies} / 类型数 ${enemyIds.size}`,
    );
});
