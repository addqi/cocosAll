import { TestRegistry } from './TestRegistry';
import { PlayerBehaviorFactory } from '../../baseSystem/player';
import { PlayerBehavior } from '../player/base';
import { warriorConfig } from '../player/warrior/warriorConfig';
import { summonerConfig } from '../player/summoner/summonerConfig';

/**
 * Step 1.6 测试：战士/召唤师骨架
 *
 * 追溯源: player/warrior/WarriorBehavior.ts, player/summoner/SummonerBehavior.ts
 */

TestRegistry.register('[Step1.6][WarriorBehavior.ts] 工厂创建战士实例', () => {
    const b = PlayerBehaviorFactory.create<PlayerBehavior>('warrior');
    if (!(b instanceof PlayerBehavior)) throw new Error('应为 PlayerBehavior 子类');
    if (b.typeId !== 'warrior') throw new Error(`typeId 应为 warrior, 实际: ${b.typeId}`);
});

TestRegistry.register('[Step1.6][WarriorBehavior.ts] createAttackState 返回占位状态', () => {
    const b = PlayerBehaviorFactory.create<PlayerBehavior>('warrior');
    const s = b.createAttackState();
    if (typeof s.enter !== 'function') throw new Error('缺少 enter');
    if (typeof s.update !== 'function') throw new Error('缺少 update');
});

TestRegistry.register('[Step1.6][warriorConfig.ts] 战士配置完整', () => {
    if (typeof warriorConfig.meleeRange !== 'number') throw new Error('缺少 meleeRange');
    if (typeof warriorConfig.cleaveAngle !== 'number') throw new Error('缺少 cleaveAngle');
});

TestRegistry.register('[Step1.6][SummonerBehavior.ts] 工厂创建召唤师实例', () => {
    const b = PlayerBehaviorFactory.create<PlayerBehavior>('summoner');
    if (!(b instanceof PlayerBehavior)) throw new Error('应为 PlayerBehavior 子类');
    if (b.typeId !== 'summoner') throw new Error(`typeId 应为 summoner, 实际: ${b.typeId}`);
});

TestRegistry.register('[Step1.6][SummonerBehavior.ts] createAttackState 返回占位状态', () => {
    const b = PlayerBehaviorFactory.create<PlayerBehavior>('summoner');
    const s = b.createAttackState();
    if (typeof s.enter !== 'function') throw new Error('缺少 enter');
    if (typeof s.update !== 'function') throw new Error('缺少 update');
});

TestRegistry.register('[Step1.6][summonerConfig.ts] 召唤师配置完整', () => {
    if (typeof summonerConfig.maxSummons !== 'number') throw new Error('缺少 maxSummons');
    if (typeof summonerConfig.summonRange !== 'number') throw new Error('缺少 summonRange');
});

TestRegistry.register('[Step1.6][behaviors.ts] 三个职业全部注册', () => {
    const ids = PlayerBehaviorFactory.registeredIds();
    if (ids.indexOf('archer') < 0) throw new Error('缺少 archer');
    if (ids.indexOf('warrior') < 0) throw new Error('缺少 warrior');
    if (ids.indexOf('summoner') < 0) throw new Error('缺少 summoner');
});
