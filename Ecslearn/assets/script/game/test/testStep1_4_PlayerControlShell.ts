import { TestRegistry } from './TestRegistry';
import { PlayerBehaviorFactory } from '../../baseSystem/player';
import type { PlayerBehavior } from '../player/base';

/**
 * Step 1.4 测试：PlayerControl 通用外壳
 *
 * 追溯源: player/PlayerControl.ts
 */

TestRegistry.register('[Step1.4][PlayerControl.ts] behaviorId 默认创建 archer', () => {
    const b = PlayerBehaviorFactory.create<PlayerBehavior>('archer');
    if (b.typeId !== 'archer') throw new Error(`behaviorId 应为 archer, 实际: ${b.typeId}`);
});

TestRegistry.register('[Step1.4][PlayerControl.ts] behaviorId 可切换到 warrior', () => {
    const b = PlayerBehaviorFactory.create<PlayerBehavior>('warrior');
    if (b.typeId !== 'warrior') throw new Error(`behaviorId 应为 warrior, 实际: ${b.typeId}`);
});

TestRegistry.register('[Step1.4][PlayerControl.ts] behaviorId 可切换到 summoner', () => {
    const b = PlayerBehaviorFactory.create<PlayerBehavior>('summoner');
    if (b.typeId !== 'summoner') throw new Error(`behaviorId 应为 summoner, 实际: ${b.typeId}`);
});

TestRegistry.register('[Step1.4][upgrade/types.ts] UpgradeTarget.setShootPolicy 接受 unknown', () => {
    const target = {
        buffMgr: null!, buffOwner: null!, hitEffectMgr: null!,
        setShootPolicy: (_p: unknown) => {},
    };
    target.setShootPolicy('test_policy');
    target.setShootPolicy({ level: 1 });
});
