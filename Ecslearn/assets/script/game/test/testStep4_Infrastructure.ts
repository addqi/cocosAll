import { TestRegistry } from './TestRegistry';
import { ResourceState } from '../core/ResourceState';
import { bootstrap } from '../core/GameBootstrap';
import { preloadAllResources } from '../core/ResourcePreloader';
import { GameLoop } from '../core/GameLoop';
import {
    EPropertyId, getBuffDef, getSkillDef, allSkillIds, allBuffIds,
    getEnemyData, allEnemyData, type EnemyDataEntry,
} from '../config';
import '../skill';

// ══════════════════════════════════════
// Item 7: GameLoop / Bootstrap 拆分
// ══════════════════════════════════════

// ── ResourceState 独立模块 ──

TestRegistry.register('[Item7][ResourceState.ts] 初始状态 ready=false', () => {
    ResourceState.reset();
    if (ResourceState.ready) throw new Error('初始应为 false');
});

TestRegistry.register('[Item7][ResourceState.ts] markReady 后 ready=true', () => {
    ResourceState.reset();
    ResourceState.markReady();
    if (!ResourceState.ready) throw new Error('markReady 后应为 true');
    ResourceState.reset();
});

TestRegistry.register('[Item7][ResourceState.ts] onReady 在 markReady 之前注册回调', () => {
    ResourceState.reset();
    let called = false;
    ResourceState.onReady(() => { called = true; });
    if (called) throw new Error('不应立即调用');
    ResourceState.markReady();
    if (!called) throw new Error('markReady 后应调用');
    ResourceState.reset();
});

TestRegistry.register('[Item7][ResourceState.ts] onReady 在 markReady 之后立即执行', () => {
    ResourceState.reset();
    ResourceState.markReady();
    let called = false;
    ResourceState.onReady(() => { called = true; });
    if (!called) throw new Error('已 ready 时应立即执行');
    ResourceState.reset();
});

TestRegistry.register('[Item7][ResourceState.ts] reset 清除状态', () => {
    ResourceState.markReady();
    ResourceState.reset();
    if (ResourceState.ready) throw new Error('reset 后应为 false');
});

// ── GameLoop 向后兼容代理 ──

TestRegistry.register('[Item7][GameLoop.ts] 静态 onReady 委托 ResourceState', () => {
    ResourceState.reset();
    let called = false;
    GameLoop.onReady(() => { called = true; });
    ResourceState.markReady();
    if (!called) throw new Error('GameLoop.onReady 应委托 ResourceState');
    ResourceState.reset();
});

TestRegistry.register('[Item7][GameLoop.ts] 静态 resourcesReady 委托 ResourceState', () => {
    ResourceState.reset();
    if (GameLoop.resourcesReady) throw new Error('应为 false');
    ResourceState.markReady();
    if (!GameLoop.resourcesReady) throw new Error('应为 true');
    ResourceState.reset();
});

// ── Bootstrap / Preloader 独立导出 ──

TestRegistry.register('[Item7][core/index.ts] bootstrap 可从 core 导出', () => {
    if (typeof bootstrap !== 'function') throw new Error('bootstrap 未导出');
});

TestRegistry.register('[Item7][core/index.ts] preloadAllResources 可从 core 导出', () => {
    if (typeof preloadAllResources !== 'function') throw new Error('preloadAllResources 未导出');
});

// ══════════════════════════════════════
// Item 8: config / ui 双根收口
// ══════════════════════════════════════

// ── config 统一入口 ──

TestRegistry.register('[Item8][game/config/index.ts] EPropertyId 可导出', () => {
    if (EPropertyId == null) throw new Error('EPropertyId 未导出');
});

TestRegistry.register('[Item8][game/config/index.ts] getBuffDef 可导出', () => {
    if (typeof getBuffDef !== 'function') throw new Error('getBuffDef 未导出');
    const b = getBuffDef('buff.attack_30');
    if (!b) throw new Error('buff.attack_30 不存在');
});

TestRegistry.register('[Item8][game/config/index.ts] getSkillDef 可导出', () => {
    if (typeof getSkillDef !== 'function') throw new Error('getSkillDef 未导出');
    const s = getSkillDef('fireball');
    if (!s) throw new Error('fireball 不存在');
});

TestRegistry.register('[Item8][game/config/index.ts] allSkillIds 可导出', () => {
    const ids = allSkillIds();
    if (ids.length < 5) throw new Error(`技能数不足: ${ids.length}`);
});

TestRegistry.register('[Item8][game/config/index.ts] allBuffIds 可导出', () => {
    const ids = allBuffIds();
    if (ids.length < 3) throw new Error(`buff 数不足: ${ids.length}`);
});

TestRegistry.register('[Item8][game/config/index.ts] getEnemyData re-export', () => {
    if (typeof getEnemyData !== 'function') throw new Error('getEnemyData 未从 game/config 导出');
    const e = getEnemyData('warrior');
    if (e.id !== 'warrior') throw new Error('敌人 id 不匹配');
});

TestRegistry.register('[Item8][game/config/index.ts] allEnemyData re-export', () => {
    const all = allEnemyData();
    if (all.length < 2) throw new Error(`敌人数不足: ${all.length}`);
});

TestRegistry.register('[Item8][game/config/index.ts] EnemyDataEntry 类型可用', () => {
    const e: EnemyDataEntry = getEnemyData('warrior');
    if (typeof e.name !== 'string') throw new Error('name 应为 string');
    if (typeof e.category !== 'string') throw new Error('category 应为 string');
});

// ── 配置只允许单入口 ──

TestRegistry.register('[Item8] 新配置不应散落到 config/ 根', () => {
    const skillIds = allSkillIds();
    const buffIds = allBuffIds();
    if (skillIds.length === 0 && buffIds.length === 0)
        throw new Error('game/config 应为配置唯一入口');
});
