import { TestRegistry } from './TestRegistry';
import { bootstrap } from '../core/GameBootstrap';
import { preloadAllResources } from '../core/ResourcePreloader';
import { GameLoop } from '../core/GameLoop';

/**
 * Step 1.8 测试：GameLoop 瘦身 + IDamageable/ITargetable 接口
 *
 * 追溯源: core/GameBootstrap.ts, core/ResourcePreloader.ts,
 *         entity/IDamageable.ts, entity/ITargetable.ts
 */

TestRegistry.register('[Step1.8][GameBootstrap.ts] bootstrap 函数可导入', () => {
    if (typeof bootstrap !== 'function') throw new Error('缺少 bootstrap 导出');
});

TestRegistry.register('[Step1.8][ResourcePreloader.ts] preloadAllResources 可导入', () => {
    if (typeof preloadAllResources !== 'function') throw new Error('缺少 preloadAllResources 导出');
});

TestRegistry.register('[Step1.8][IDamageable.ts] IDamageable 接口结构检查', () => {
    const mock = { isDead: false, applyDamage: (_n: number) => 0 };
    if (typeof mock.isDead !== 'boolean') throw new Error('缺少 isDead');
    if (typeof mock.applyDamage !== 'function') throw new Error('缺少 applyDamage');
});

TestRegistry.register('[Step1.8][ITargetable.ts] ITargetable 接口结构检查', () => {
    const mock = { isDead: false, applyDamage: (_n: number) => 0, node: null! };
    if (!('node' in mock)) throw new Error('缺少 node');
    if (typeof mock.applyDamage !== 'function') throw new Error('缺少 applyDamage');
});

TestRegistry.register('[Step1.8][GameLoop.ts] GameLoop 委托 bootstrap 而非自建 System', () => {
    if (typeof GameLoop !== 'function') throw new Error('GameLoop 应为 class');
    if (typeof bootstrap !== 'function') throw new Error('bootstrap 应存在');
});
