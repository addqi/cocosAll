import { TestRegistry } from './TestRegistry';
import { isHostile } from '../combat/interfaces/CombatInterfaces';
import type { IAttackSource, IAttackTarget, Faction } from '../combat/interfaces/CombatInterfaces';

// ── Step 3.8 中立战斗接口 ──

TestRegistry.register('[Step3.8][CombatInterfaces.ts] player vs enemy 敌对', () => {
    if (!isHostile('player', 'enemy')) throw new Error('应为敌对');
});

TestRegistry.register('[Step3.8][CombatInterfaces.ts] player vs player 不敌对', () => {
    if (isHostile('player', 'player')) throw new Error('不应敌对');
});

TestRegistry.register('[Step3.8][CombatInterfaces.ts] player vs ally 不敌对', () => {
    if (isHostile('player', 'ally')) throw new Error('不应敌对');
});

TestRegistry.register('[Step3.8][CombatInterfaces.ts] neutral vs enemy 不敌对', () => {
    if (isHostile('neutral', 'enemy')) throw new Error('neutral 不应敌对');
});

TestRegistry.register('[Step3.8][CombatInterfaces.ts] enemy vs ally 敌对', () => {
    if (!isHostile('enemy', 'ally')) throw new Error('应为敌对');
});

TestRegistry.register('[Step3.8][CombatInterfaces.ts] IAttackSource 接口可 mock', () => {
    const src: IAttackSource = {
        uid: 'player-1', faction: 'player',
        getAttackPower: () => 50, getCritRate: () => 0.1, getCritMultiplier: () => 2.0,
    };
    if (src.getAttackPower() !== 50) throw new Error('攻击力错误');
    if (src.faction !== 'player') throw new Error('faction 错误');
});

TestRegistry.register('[Step3.8][CombatInterfaces.ts] IAttackTarget 接口可 mock', () => {
    const tgt: IAttackTarget = {
        uid: 'enemy-1', faction: 'enemy', isDead: false,
        node: {} as any,
        applyDamage: (raw: number) => raw * 0.8,
        buffMgr: {} as any, buffOwner: {} as any,
    };
    if (tgt.applyDamage(100) !== 80) throw new Error('伤害计算错误');
});

TestRegistry.register('[Step3.8][CombatInterfaces.ts] 召唤物可接入攻击接口', () => {
    const summon: IAttackSource = {
        uid: 'summon-wolf-1', faction: 'ally',
        getAttackPower: () => 15, getCritRate: () => 0, getCritMultiplier: () => 1,
    };
    if (isHostile(summon.faction, 'player')) throw new Error('召唤物不应与玩家敌对');
    if (!isHostile(summon.faction, 'enemy')) throw new Error('召唤物应与敌人敌对');
});
