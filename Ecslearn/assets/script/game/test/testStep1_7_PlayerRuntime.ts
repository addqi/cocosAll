import { TestRegistry } from './TestRegistry';
import { PlayerRuntime } from '../player/runtime';
import type { PlayerServices } from '../player/runtime/PlayerServices';

/**
 * Step 1.7 测试：PlayerRuntime / PlayerServices
 *
 * 追溯源: player/runtime/PlayerRuntime.ts, player/runtime/PlayerServices.ts
 */

TestRegistry.register('[Step1.7][PlayerServices.ts] 接口字段完整性(编译期)', () => {
    const mock: PlayerServices = {
        buffMgr: null!,
        hitEffectMgr: null!,
        upgradeMgr: null!,
        skillSystem: null!,
    };
    if (!('buffMgr' in mock)) throw new Error('缺少 buffMgr');
    if (!('hitEffectMgr' in mock)) throw new Error('缺少 hitEffectMgr');
    if (!('upgradeMgr' in mock)) throw new Error('缺少 upgradeMgr');
    if (!('skillSystem' in mock)) throw new Error('缺少 skillSystem');
});

TestRegistry.register('[Step1.7][PlayerRuntime.ts] PlayerRuntime 是 class', () => {
    if (typeof PlayerRuntime !== 'function') throw new Error('PlayerRuntime 应为 class');
});
