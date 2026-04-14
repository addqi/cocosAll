import { TestRegistry } from './TestRegistry';
import { EPlayerState } from '../player/states/PlayerContext';
import { playerConfig } from '../player/config/playerConfig';
import { archerConfig } from '../player/archer/archerConfig';

/**
 * Step 1.5 测试：Shoot→Attack 重命名 + 配置拆分
 *
 * 追溯源: player/states/PlayerContext.ts, player/config/playerConfig.ts,
 *         player/archer/archerConfig.ts
 */

TestRegistry.register('[Step1.5][PlayerContext.ts] EPlayerState.Attack 存在', () => {
    if (EPlayerState.Attack !== 'attack') throw new Error(`Attack 值应为 "attack", 实际: ${EPlayerState.Attack}`);
});

TestRegistry.register('[Step1.5][PlayerContext.ts] EPlayerState 不含 Shoot', () => {
    const keys = Object.keys(EPlayerState);
    if (keys.indexOf('Shoot') >= 0) throw new Error('EPlayerState 不应包含 Shoot');
});

TestRegistry.register('[Step1.5][playerConfig.ts] 共有配置不含弓箭手字段', () => {
    const cfg = playerConfig as any;
    if ('arrowSpeed' in cfg) throw new Error('playerConfig 不应包含 arrowSpeed');
    if ('arrowTexture' in cfg) throw new Error('playerConfig 不应包含 arrowTexture');
    if ('arrowWidth' in cfg) throw new Error('playerConfig 不应包含 arrowWidth');
    if ('arrowArcRatio' in cfg) throw new Error('playerConfig 不应包含 arrowArcRatio');
});

TestRegistry.register('[Step1.5][playerConfig.ts] 共有配置保留公共字段', () => {
    if (typeof playerConfig.attackRange !== 'number') throw new Error('缺少 attackRange');
    if (typeof playerConfig.rangeTexture !== 'string') throw new Error('缺少 rangeTexture');
    if (typeof playerConfig.xpBase !== 'number') throw new Error('缺少 xpBase');
    if (typeof playerConfig.maxSkillSlots !== 'number') throw new Error('缺少 maxSkillSlots');
});

TestRegistry.register('[Step1.5][archerConfig.ts] 弓箭手配置包含迁出字段', () => {
    if (typeof archerConfig.arrowSpeed !== 'number') throw new Error('缺少 arrowSpeed');
    if (typeof archerConfig.arrowTexture !== 'string') throw new Error('缺少 arrowTexture');
    if (typeof archerConfig.arrowWidth !== 'number') throw new Error('缺少 arrowWidth');
    if (typeof archerConfig.arrowHeight !== 'number') throw new Error('缺少 arrowHeight');
    if (typeof archerConfig.arrowArcRatio !== 'number') throw new Error('缺少 arrowArcRatio');
    if (typeof archerConfig.arrowNoTargetRange !== 'number') throw new Error('缺少 arrowNoTargetRange');
});
