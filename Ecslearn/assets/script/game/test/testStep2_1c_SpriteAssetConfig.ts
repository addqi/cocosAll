/**
 * Step 2.1c — 图片资源 JSON 配置校验
 *
 * 对应文件：
 *   - assets/script/game/config/spriteAssetConfig/spriteAssets.json
 *   - assets/script/game/config/spriteAssetConfig/SpriteAssetLoader.ts
 *
 * 本测试只验证配置层：
 *   - Loader 能读出配置
 *   - 必填字段校验有效（错误立即抛 + 定位到 id）
 *   - 非法 onOverflow 被拦截
 *
 * 不测 SpriteNodeFactory 运行时 —— 那需要 Cocos 场景上下文，留作手工回归
 */
import { TestRegistry } from './TestRegistry';
import {
    allSpriteAssetDefs,
    allSpriteAssetIds,
    getSpriteAssetDef,
    _validateSpriteAssetRawForTest,
} from '../config/spriteAssetConfig/SpriteAssetLoader';

function assert(cond: unknown, msg: string): asserts cond {
    if (!cond) throw new Error(msg);
}

function assertEq<T>(actual: T, expected: T, label: string): void {
    if (actual !== expected) {
        throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
    }
}

function assertThrows(fn: () => unknown, expectMsgIncludes: string, label: string): void {
    try { fn(); }
    catch (e: any) {
        const msg = e?.message ?? String(e);
        if (!msg.includes(expectMsgIncludes)) {
            throw new Error(`${label}: 错误信息不含 "${expectMsgIncludes}"，实际: ${msg}`);
        }
        return;
    }
    throw new Error(`${label}: 预期抛错但未抛`);
}

// ── 用例 1：spriteAssets.json 至少包含 coin ───────────

TestRegistry.register('Step2.1c / 用例1 spriteAssets.json 至少含 coin', () => {
    const ids = allSpriteAssetIds();
    assert(ids.includes('coin'), 'spriteAssets.json 必须包含 "coin" 条目');

    const coin = getSpriteAssetDef('coin')!;
    assert(coin !== null, 'getSpriteAssetDef("coin") 不应为 null');
    assertEq(coin.id, 'coin', 'coin.id');
    assert(coin.texturePath.includes('coin'), 'coin.texturePath 应包含 "coin"');
    assert(coin.displayWidth > 0, 'coin.displayWidth > 0');
    assert(coin.displayHeight > 0, 'coin.displayHeight > 0');
});

// ── 用例 2：allSpriteAssetDefs 返回与 allSpriteAssetIds 一致 ───

TestRegistry.register('Step2.1c / 用例2 defs 与 ids 数量一致', () => {
    const defs = allSpriteAssetDefs();
    const ids = allSpriteAssetIds();
    assertEq(defs.length, ids.length, 'defs.length === ids.length');
});

// ── 用例 3：缺 texturePath 抛错 ─────────────────────

TestRegistry.register('Step2.1c / 用例3 缺 texturePath 立即抛错', () => {
    assertThrows(
        () => _validateSpriteAssetRawForTest('test-id', {
            name: '测试',
            displayWidth: 32,
            displayHeight: 32,
        }),
        'texturePath',
        '缺 texturePath',
    );
});

// ── 用例 4：displayWidth <= 0 抛错 ────────────────

TestRegistry.register('Step2.1c / 用例4 displayWidth 必须 > 0', () => {
    assertThrows(
        () => _validateSpriteAssetRawForTest('test-id', {
            name: '测试',
            texturePath: 'test/texture',
            displayWidth: 0,
            displayHeight: 32,
        }),
        'displayWidth',
        'displayWidth=0',
    );
});

// ── 用例 5：非法 onOverflow 抛错 ────────────────

TestRegistry.register('Step2.1c / 用例5 非法 onOverflow 被拦截', () => {
    assertThrows(
        () => _validateSpriteAssetRawForTest('test-id', {
            name: '测试',
            texturePath: 'test/texture',
            displayWidth: 32,
            displayHeight: 32,
            onOverflow: 'explode',
        }),
        'onOverflow "explode"',
        '非法 onOverflow',
    );
});

// ── 用例 6：getSpriteAssetDef 未知 id 返回 null ────

TestRegistry.register('Step2.1c / 用例6 未知 id 返回 null', () => {
    assertEq(getSpriteAssetDef('no-such-asset'), null, 'unknown id');
});

// ── 用例 7：可选 maxActive 合法 ─────────────────

TestRegistry.register('Step2.1c / 用例7 maxActive 可选，无值合法', () => {
    const def = _validateSpriteAssetRawForTest('test-id', {
        name: '测试',
        texturePath: 'test/texture',
        displayWidth: 32,
        displayHeight: 32,
    });
    assertEq(def.maxActive, undefined, 'maxActive 未填应为 undefined');
});
