/**
 * Step 2.10 — 流派配置 + classIds 过滤 + ClassChosen 事件
 *
 * 覆盖：
 *   A 组 ClassConfigLoader
 *     A1 rapid 流派可读取，shoot.type='hold'
 *     A2 charge 流派可读取，shoot.type='charge' + 蓄力参数合法
 *     A3 allPlayerClassDefs() ≥ 2 条
 *     A4 未知 id 返 null
 *     A5 allPlayerClassIds 至少含 rapid/charge
 *
 *   B 组 UpgradeOfferSystem.classIds 过滤
 *     B1 通用升级（无 classIds）对 rapid 可抽
 *     B2 通用升级对 charge 可抽
 *     B3 rapid 独有对 charge 不可抽
 *     B4 rapid 独有对 rapid 可抽
 *     B5 classId=null 时独有不可抽，通用仍可抽
 *     B6 rollOffer 不泄露他派独有
 *     B7 classIds 多值对两派都通
 *
 *   C 组 ClassChosen 事件
 *     C1 emit ClassChosen payload 能被 on 收到
 *     C2 GameEvt.ClassChosen 常量稳定（字符串不变）
 */

import { TestRegistry } from './TestRegistry';
import {
    getPlayerClassDef,
    allPlayerClassDefs,
    allPlayerClassIds,
} from '../config/classConfig/ClassConfigLoader';
import { UpgradeOfferSystem } from '../level/upgrade/UpgradeOfferSystem';
import type { UpgradeConfig } from '../upgrade/types';
import type { UpgradeManager } from '../upgrade/UpgradeManager';
import { emit, on, off } from '../../baseSystem/util';
import { GameEvt, type ClassChosenEvent } from '../events/GameEvents';

function assert(cond: unknown, msg: string): asserts cond {
    if (!cond) throw new Error(msg);
}

// ─── A 组 Loader ─────────────────────────────────────

TestRegistry.register('Step2.10-A', '用例1', 'rapid 可读取且 shoot.type=hold', () => {
    const def = getPlayerClassDef('rapid');
    assert(def !== null, 'rapid 不应为 null');
    assert(def!.shoot.type === 'hold', `shoot.type 应为 hold，实际 ${def!.shoot.type}`);
});

TestRegistry.register('Step2.10-A', '用例2', 'charge 可读取且蓄力参数合法', () => {
    const def = getPlayerClassDef('charge');
    assert(def !== null, 'charge 不应为 null');
    assert(def!.shoot.type === 'charge', 'shoot.type 应为 charge');
    if (def!.shoot.type === 'charge') {
        assert(def!.shoot.maxChargeSec > 0,    'maxChargeSec > 0');
        assert(def!.shoot.maxDamageRatio >= 1, 'maxDamageRatio ≥ 1');
        assert(
            def!.shoot.moveSpeedRatio > 0 && def!.shoot.moveSpeedRatio <= 1,
            'moveSpeedRatio ∈ (0,1]',
        );
    }
});

TestRegistry.register('Step2.10-A', '用例3', 'allPlayerClassDefs ≥ 2', () => {
    const defs = allPlayerClassDefs();
    assert(defs.length >= 2, `至少 2 个流派，实际 ${defs.length}`);
});

TestRegistry.register('Step2.10-A', '用例4', '未知流派返 null', () => {
    assert(getPlayerClassDef('no-such-class') === null, '未知 id 应返 null');
});

TestRegistry.register('Step2.10-A', '用例5', 'allPlayerClassIds 含 rapid/charge', () => {
    const ids = allPlayerClassIds();
    assert(ids.includes('rapid'),  'ids 应含 rapid');
    assert(ids.includes('charge'), 'ids 应含 charge');
});

// ─── B 组 UpgradeOfferSystem 过滤 ────────────────────

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
function mkCfg(
    id: string,
    opts: { tier?: number; classIds?: readonly string[] } = {},
): UpgradeConfig {
    return {
        id, name: id, desc: '', tier: opts.tier ?? 1,
        rarity: 'common', category: 'attr',
        effects: [],
        classIds: opts.classIds,
    };
}

TestRegistry.register('Step2.10-B', '用例1', '通用升级对 rapid 可抽', () => {
    const pool = [mkCfg('common-1')];
    const sys = new UpgradeOfferSystem(mockManager(), pool, 'rapid');
    assert(sys.isEligible(pool[0]), '通用升级应对 rapid 可抽');
});

TestRegistry.register('Step2.10-B', '用例2', '通用升级对 charge 可抽', () => {
    const pool = [mkCfg('common-1')];
    const sys = new UpgradeOfferSystem(mockManager(), pool, 'charge');
    assert(sys.isEligible(pool[0]), '通用升级应对 charge 可抽');
});

TestRegistry.register('Step2.10-B', '用例3', 'rapid 独有对 charge 不可抽', () => {
    const cfg = mkCfg('rapid-only', { classIds: ['rapid'] });
    const sys = new UpgradeOfferSystem(mockManager(), [cfg], 'charge');
    assert(!sys.isEligible(cfg), 'rapid 独有不应对 charge 可抽');
});

TestRegistry.register('Step2.10-B', '用例4', 'rapid 独有对 rapid 可抽', () => {
    const cfg = mkCfg('rapid-only', { classIds: ['rapid'] });
    const sys = new UpgradeOfferSystem(mockManager(), [cfg], 'rapid');
    assert(sys.isEligible(cfg), 'rapid 独有应对 rapid 可抽');
});

TestRegistry.register('Step2.10-B', '用例5', 'classId=null 独有不可抽，通用仍可抽', () => {
    const common = mkCfg('common-1');
    const rapidOnly = mkCfg('rapid-only', { classIds: ['rapid'] });
    const sys = new UpgradeOfferSystem(mockManager(), [common, rapidOnly], null);
    assert(sys.isEligible(common),     'classId=null 时通用应可抽');
    assert(!sys.isEligible(rapidOnly), 'classId=null 时独有不应可抽');
});

TestRegistry.register('Step2.10-B', '用例6', 'rollOffer 不泄露他派独有', () => {
    const pool: UpgradeConfig[] = [
        mkCfg('common-1'),
        mkCfg('common-2'),
        mkCfg('common-3'),
        mkCfg('rapid-a', { classIds: ['rapid'] }),
        mkCfg('rapid-b', { classIds: ['rapid'] }),
        mkCfg('charge-a', { classIds: ['charge'] }),
        mkCfg('charge-b', { classIds: ['charge'] }),
    ];
    const sys = new UpgradeOfferSystem(mockManager(), pool, 'rapid');
    for (let i = 0; i < 100; i++) {
        const rolled = sys.rollOffer(3);
        for (const c of rolled) {
            assert(
                !(c.classIds?.includes('charge')),
                `第 ${i} 次抽到 charge 独有: ${c.id}`,
            );
        }
    }
});

TestRegistry.register('Step2.10-B', '用例7', 'classIds 多值两派都通', () => {
    const cfg = mkCfg('shared', { classIds: ['rapid', 'charge'] });
    const sys1 = new UpgradeOfferSystem(mockManager(), [cfg], 'rapid');
    const sys2 = new UpgradeOfferSystem(mockManager(), [cfg], 'charge');
    assert(sys1.isEligible(cfg), 'shared 应对 rapid 可抽');
    assert(sys2.isEligible(cfg), 'shared 应对 charge 可抽');
});

// ─── C 组 ClassChosen 事件 ───────────────────────────

TestRegistry.register('Step2.10-C', '用例1', 'ClassChosen payload 能被接收', () => {
    let received: ClassChosenEvent | null = null;
    const handler = (e: ClassChosenEvent) => { received = e; };
    on(GameEvt.ClassChosen, handler);
    try {
        emit(GameEvt.ClassChosen, { id: 'rapid' } as ClassChosenEvent);
        assert(received !== null, 'handler 应被调用');
        assert(received!.id === 'rapid', `payload.id 应为 rapid，实际 ${received!.id}`);
    } finally {
        off(GameEvt.ClassChosen, handler);
    }
});

TestRegistry.register('Step2.10-C', '用例2', 'GameEvt.ClassChosen 常量稳定', () => {
    assert(
        GameEvt.ClassChosen === 'class:chosen',
        `事件名应为 'class:chosen'，实际 '${GameEvt.ClassChosen}'`,
    );
});
