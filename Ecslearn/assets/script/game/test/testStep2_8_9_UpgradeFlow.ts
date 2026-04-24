/**
 * Step 2.8 / 2.9 — 升级 UI 事件流 + UpgradeOfferSystem 端到端
 *
 * 对应文档：§十一（升级 UI）+ §十二（LevelManager 粘合 + Victory）
 *
 * 本测试不涉及真实 Cocos 节点（Label/Sprite 在单测环境建不起来），
 * 只验证**纯数据流**：
 *   1. UpgradeOfferSystem.rollOffer / applyChoice / 配合 LevelRun 的 quota 语义
 *   2. GameEvt.UpgradeChosen / UpgradeReroll 事件常量 + payload 类型 + 名称约定
 *   3. 刷新次数消耗（quota=1 → consumeReroll → quota=0）
 *
 * 渲染行为（卡片可见、灰色按钮）由 UpgradeOfferPanel 运行时肉眼验证，不写断言。
 */
import { TestRegistry } from './TestRegistry';
import { emit, on, off } from '../../baseSystem/util';
import {
    GameEvt,
    type UpgradeChosenEvent,
    type UpgradeRerollEvent,
    type UpgradeOfferShowEvent,
} from '../events/GameEvents';
import { LevelRun } from '../level/LevelRun';
import { UpgradeOfferSystem } from '../level/upgrade/UpgradeOfferSystem';
import type { UpgradeConfig } from '../upgrade/types';
import type { UpgradeManager } from '../upgrade/UpgradeManager';

function assert(cond: unknown, msg: string): asserts cond {
    if (!cond) throw new Error(msg);
}
function assertEq<T>(actual: T, expected: T, label: string): void {
    if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
}

// ─── Mocks ────────────────────────────────────────

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
function mockMgr(): UpgradeManager {
    return new MockUpgradeManager() as unknown as UpgradeManager;
}
function mkCfg(id: string, tier = 1): UpgradeConfig {
    return {
        id, name: id, desc: '', tier,
        rarity: 'common', category: 'attr',
        effects: [],
    };
}

// ─── 用例 1：事件常量不可变 ──────────────────────────

TestRegistry.register('Step2.8 / 用例1 GameEvt.Upgrade* 事件名稳定', () => {
    assertEq(GameEvt.UpgradeOfferShow, 'upgrade:offer_show', 'OfferShow 名');
    assertEq(GameEvt.UpgradeChosen,    'upgrade:chosen',     'Chosen 名');
    assertEq(GameEvt.UpgradeReroll,    'upgrade:reroll',     'Reroll 名');
});

// ─── 用例 2：emit UpgradeOfferShow 监听端能收到 ─────

TestRegistry.register('Step2.8 / 用例2 emit OfferShow 回调能收到 payload', () => {
    let received: UpgradeOfferShowEvent | null = null;
    const cb = (e: UpgradeOfferShowEvent) => { received = e; };
    on(GameEvt.UpgradeOfferShow, cb);

    const offers = [mkCfg('a'), mkCfg('b'), mkCfg('c')];
    const payload: UpgradeOfferShowEvent = { offers, rerollQuota: 1 };
    emit(GameEvt.UpgradeOfferShow, payload);
    off(GameEvt.UpgradeOfferShow, cb);

    assert(received !== null, '应收到一次回调');
    assertEq(received!.offers.length, 3, 'offers.length');
    assertEq(received!.rerollQuota, 1, 'rerollQuota');
});

// ─── 用例 3：emit UpgradeChosen + applyChoice 等价 ────

TestRegistry.register('Step2.8 / 用例3 UpgradeChosen 事件 → LevelManager 应用流程数据正确', () => {
    const mgr = mockMgr();
    const sys = new UpgradeOfferSystem(mgr, [mkCfg('a'), mkCfg('b')]);

    // 模拟 UI 点卡片 emit
    let chosenId = '';
    const cb = (e: UpgradeChosenEvent) => { chosenId = e.id; };
    on(GameEvt.UpgradeChosen, cb);

    // LevelManager 收到后会调 applyChoice
    const payload: UpgradeChosenEvent = { id: 'a' };
    emit(GameEvt.UpgradeChosen, payload);
    assertEq(chosenId, 'a', '监听收到 id');
    off(GameEvt.UpgradeChosen, cb);

    // 验证 applyChoice 语义本身
    sys.applyChoice('a');
    assertEq(mgr.has('a'), true, 'UpgradeManager.applied 应包含 a');
});

// ─── 用例 4：UpgradeReroll 消耗 quota ───────────────

TestRegistry.register('Step2.9 / 用例4 reroll 消耗 LevelRun.quota', () => {
    const run = LevelRun.startNew(2);  // 初始 quota=2
    assertEq(run.upgradeRerollQuota, 2, '初始 quota=2');

    let remaining: number | null = null;
    const cb = (e: UpgradeRerollEvent) => { remaining = e.remainingQuota; };
    on(GameEvt.UpgradeReroll, cb);

    // 模拟 UI 两次刷新：每次消耗 1
    const ok1 = run.consumeReroll();
    assertEq(ok1, true, '第一次 consume 成功');
    emit(GameEvt.UpgradeReroll, { remainingQuota: run.upgradeRerollQuota } as UpgradeRerollEvent);
    assertEq(remaining, 1, '剩余 quota=1');

    const ok2 = run.consumeReroll();
    assertEq(ok2, true, '第二次 consume 成功');
    emit(GameEvt.UpgradeReroll, { remainingQuota: run.upgradeRerollQuota } as UpgradeRerollEvent);
    assertEq(remaining, 0, '剩余 quota=0');

    // 第三次不应成功
    const ok3 = run.consumeReroll();
    assertEq(ok3, false, '第三次 consume 失败');
    assertEq(run.upgradeRerollQuota, 0, 'quota 仍为 0');

    off(GameEvt.UpgradeReroll, cb);
});

// ─── 用例 5：整局事件链（完整 Offer → Chosen → apply）──

TestRegistry.register('Step2.9 / 用例5 完整事件链 OfferShow→Chosen→applyChoice', () => {
    const mgr = mockMgr();
    const sys = new UpgradeOfferSystem(mgr, [
        mkCfg('fire-arrow', 2),
        mkCfg('multi-shot', 1),
        mkCfg('crit-up', 1),
    ]);

    // 1. LevelManager 要弹 UI：rollOffer → emit OfferShow
    const offers = sys.rollOffer(3);
    assertEq(offers.length, 3, 'rollOffer 返 3 条');

    const showPayload: UpgradeOfferShowEvent = { offers, rerollQuota: 1 };
    let uiGotOffers: readonly UpgradeConfig[] = [];
    const cbShow = (e: UpgradeOfferShowEvent) => { uiGotOffers = e.offers; };
    on(GameEvt.UpgradeOfferShow, cbShow);
    emit(GameEvt.UpgradeOfferShow, showPayload);
    off(GameEvt.UpgradeOfferShow, cbShow);

    assertEq(uiGotOffers.length, 3, 'UI 监听收到 3 条');

    // 2. 模拟 UI 玩家点中第一张 → emit Chosen
    const picked = uiGotOffers[0];
    let chosenCaught: UpgradeChosenEvent | null = null;
    const cbChosen = (e: UpgradeChosenEvent) => { chosenCaught = e; };
    on(GameEvt.UpgradeChosen, cbChosen);
    emit(GameEvt.UpgradeChosen, { id: picked.id } as UpgradeChosenEvent);
    off(GameEvt.UpgradeChosen, cbChosen);
    assertEq(chosenCaught?.id, picked.id, 'Chosen payload.id 正确');

    // 3. LevelManager 收到后调 applyChoice → UpgradeManager.has=true
    const applied = sys.applyChoice(picked.id);
    assertEq(applied, true, 'applyChoice 成功');
    assertEq(mgr.has(picked.id), true, 'UpgradeManager 已登记');

    // 4. 下一次 rollOffer 不应出现 picked.id
    const next = sys.rollOffer(3);
    assert(!next.some(c => c.id === picked.id), '下一 roll 不应含已选 id');
});
