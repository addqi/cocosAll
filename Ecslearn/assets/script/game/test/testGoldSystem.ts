import { TestRegistry } from './TestRegistry';
import { EPropertyId } from '../config/enum/propertyEnum';
import { PROP_CONFIG_MAP } from '../config/propertyConfig/propConfigMap';
import { SHARED_ATTRIBUTE_CONFIGS } from '../config/propertyConfig/attributeConfigs';
import { getEnemyData, allEnemyIds } from '../config/enemyConfig/EnemyConfigLoader';
import { enemyConfig } from '../enemy/config/enemyConfig';
import { PlayerProperty } from '../player/property/playerProperty';
import { GoldSystem } from '../gold/GoldSystem';
import { GoldSource } from '../gold/GoldTypes';
import { ComboKillModifier } from '../gold/modifiers/ComboKillModifier';
import { CoinEntity, CoinTier } from '../gold/CoinEntity';
import { GameEvt } from '../events/GameEvents';

// ══════════════════════════════════════════════════════════════
//  阶段 2 / 04: 敌人死亡与金币系统 - 单元测试
//  覆盖 04 文档 §12 完成判定中的纯逻辑部分
//  场景行为（金币飞向玩家、出生跳跃等）由 GoldDebugLogger 在场景里观测
// ══════════════════════════════════════════════════════════════

// ── A. PickupRange 属性接入 ─────────────────────────────────────

TestRegistry.register('[Gold][Prop] PickupRange 已加入 EPropertyId 枚举', () => {
    if (EPropertyId.PickupRange !== 'PickupRange') {
        throw new Error(`枚举值不对: ${EPropertyId.PickupRange}`);
    }
});

TestRegistry.register('[Gold][Prop] PROP_CONFIG_MAP 含 PickupRange 5 节点映射', () => {
    const m = PROP_CONFIG_MAP[EPropertyId.PickupRange];
    if (!m) throw new Error('propConfigMap 缺 PickupRange');
    const keys = Object.keys(m);
    if (keys.length !== 5) throw new Error(`节点数 ${keys.length} != 5`);
});

TestRegistry.register('[Gold][Prop] SHARED_ATTRIBUTE_CONFIGS 含 PickupRange', () => {
    const found = SHARED_ATTRIBUTE_CONFIGS.find(c => c.attribute === 'PickupRange');
    if (!found) throw new Error('SHARED_ATTRIBUTE_CONFIGS 缺 PickupRange');
    if (!found.computeNodes.find(n => n.id === 'PickupRange')) {
        throw new Error('PickupRange 缺最终 computeNode');
    }
});

TestRegistry.register('[Gold][Prop] PlayerProperty.getValue(PickupRange) === 80', () => {
    const prop = new PlayerProperty();
    const v = prop.getValue(EPropertyId.PickupRange);
    if (v !== 80) throw new Error(`PickupRange ${v} != 80`);
});

// ── B. 敌人 goldDrop 字段 ──────────────────────────────────────

TestRegistry.register('[Gold][Enemy] enemyConfig 默认有 goldDrop', () => {
    if (typeof enemyConfig.goldDrop !== 'number') {
        throw new Error(`goldDrop 类型 ${typeof enemyConfig.goldDrop}`);
    }
    if (enemyConfig.goldDrop <= 0) throw new Error(`goldDrop ${enemyConfig.goldDrop} <= 0`);
});

TestRegistry.register('[Gold][Enemy] bomber/ranger 在 enemies.json 设置了 goldDrop', () => {
    const ids = allEnemyIds();
    for (const id of ['bomber', 'ranger']) {
        if (!ids.includes(id)) continue; // 配置缺失就跳过，不是金币系统问题
        const data = getEnemyData(id);
        const v = data.overrides.goldDrop;
        if (v === undefined || v <= 0) {
            throw new Error(`${id} goldDrop ${v}`);
        }
    }
});

// ── C. CoinTier 分档 ──────────────────────────────────────────

TestRegistry.register('[Gold][Coin] CoinTier 阈值 1/10/50/250', () => {
    if (CoinEntity.pickTier(1) !== CoinTier.Bronze)  throw new Error('1 应为 Bronze');
    if (CoinEntity.pickTier(9) !== CoinTier.Bronze)  throw new Error('9 应为 Bronze');
    if (CoinEntity.pickTier(10) !== CoinTier.Silver) throw new Error('10 应为 Silver');
    if (CoinEntity.pickTier(49) !== CoinTier.Silver) throw new Error('49 应为 Silver');
    if (CoinEntity.pickTier(50) !== CoinTier.Gold)   throw new Error('50 应为 Gold');
    if (CoinEntity.pickTier(249) !== CoinTier.Gold)  throw new Error('249 应为 Gold');
    if (CoinEntity.pickTier(250) !== CoinTier.Ruby)  throw new Error('250 应为 Ruby');
    if (CoinEntity.pickTier(9999) !== CoinTier.Ruby) throw new Error('9999 应为 Ruby');
});

// ── D. GoldSystem.gainGold（不走 Coin 物件，直接入账分支）──────

TestRegistry.register('[Gold][System] gainGold(Pickup) 直接入账', () => {
    const sys = new GoldSystem();
    const got = sys.gainGold({ source: GoldSource.Quest, baseAmount: 50 });
    if (got !== 50) throw new Error(`got ${got}`);
    if (sys.gold !== 50) throw new Error(`sys.gold ${sys.gold}`);
});

TestRegistry.register('[Gold][System] gainGold 0/负数无效，返回 0', () => {
    const sys = new GoldSystem();
    if (sys.gainGold({ source: GoldSource.Quest, baseAmount: 0 }) !== 0) throw new Error('0 应返回 0');
    if (sys.gainGold({ source: GoldSource.Quest, baseAmount: -10 }) !== 0) throw new Error('负数应返回 0');
    if (sys.gold !== 0) throw new Error(`sys.gold ${sys.gold}`);
});

TestRegistry.register('[Gold][System] gainGold 取整（floor）', () => {
    const sys = new GoldSystem();
    sys.gainGold({ source: GoldSource.Quest, baseAmount: 7.9 });
    if (sys.gold !== 7) throw new Error(`floor 失败 ${sys.gold}`);
});

// ── E. GoldSystem.spendGold ───────────────────────────────────

TestRegistry.register('[Gold][System] spendGold 余额不足返回 false', () => {
    const sys = new GoldSystem();
    sys.gainGold({ source: GoldSource.Quest, baseAmount: 30 });
    if (sys.spendGold(50, 'shop') !== false) throw new Error('应失败');
    if (sys.gold !== 30) throw new Error(`gold 不应变 ${sys.gold}`);
});

TestRegistry.register('[Gold][System] spendGold 成功扣减', () => {
    const sys = new GoldSystem();
    sys.gainGold({ source: GoldSource.Quest, baseAmount: 100 });
    if (sys.spendGold(40, 'shop') !== true) throw new Error('应成功');
    if (sys.gold !== 60) throw new Error(`gold ${sys.gold} != 60`);
});

// ── F. ComboKillModifier 与 Modifier 链 ───────────────────────

// Kill 来源但不传 worldPos → 走 _commit 分支，不动场景 CoinPool

TestRegistry.register('[Gold][Mod] Combo<3 不加成', () => {
    const sys = new GoldSystem();
    let combo = 2;
    sys.addModifier(new ComboKillModifier(() => combo));
    const got = sys.gainGold({ source: GoldSource.Kill, baseAmount: 10 });
    if (got !== 10) throw new Error(`combo=2 got ${got} != 10`);
});

TestRegistry.register('[Gold][Mod] Combo>=3 ×1.2', () => {
    const sys = new GoldSystem();
    const combo = 3;
    sys.addModifier(new ComboKillModifier(() => combo));
    const got = sys.gainGold({ source: GoldSource.Kill, baseAmount: 10 });
    if (got !== 12) throw new Error(`combo=3 got ${got} != 12`);
});

TestRegistry.register('[Gold][Mod] Combo>=5 ×1.3', () => {
    const sys = new GoldSystem();
    const combo = 5;
    sys.addModifier(new ComboKillModifier(() => combo));
    const got = sys.gainGold({ source: GoldSource.Kill, baseAmount: 10 });
    if (got !== 13) throw new Error(`combo=5 got ${got} != 13`);
});

TestRegistry.register('[Gold][Mod] Combo>=10 ×1.5', () => {
    const sys = new GoldSystem();
    const combo = 10;
    sys.addModifier(new ComboKillModifier(() => combo));
    const got = sys.gainGold({ source: GoldSource.Kill, baseAmount: 10 });
    if (got !== 15) throw new Error(`combo=10 got ${got} != 15`);
});

TestRegistry.register('[Gold][Mod] ComboKill 不影响非 Kill 来源', () => {
    const sys = new GoldSystem();
    let combo = 10;
    sys.addModifier(new ComboKillModifier(() => combo));
    const got = sys.gainGold({ source: GoldSource.Quest, baseAmount: 10 });
    if (got !== 10) throw new Error(`Quest 不应被 ComboKill 加成 ${got}`);
});

TestRegistry.register('[Gold][Mod] addModifier 按 priority 排序', () => {
    const sys = new GoldSystem();
    const order: string[] = [];
    sys.addModifier({
        id: 'b', priority: 200,
        apply(a) { order.push('b'); return a; },
    });
    sys.addModifier({
        id: 'a', priority: 100,
        apply(a) { order.push('a'); return a; },
    });
    sys.addModifier({
        id: 'c', priority: 300,
        apply(a) { order.push('c'); return a; },
    });
    sys.gainGold({ source: GoldSource.Quest, baseAmount: 1 });
    if (order.join(',') !== 'a,b,c') throw new Error(`order = ${order.join(',')}`);
});

TestRegistry.register('[Gold][Mod] removeModifier 移除指定 id', () => {
    const sys = new GoldSystem();
    sys.addModifier({
        id: 'temp', priority: 100,
        apply: (a) => a + 100,
    });
    if (sys.gainGold({ source: GoldSource.Quest, baseAmount: 0 }) !== 100) {
        throw new Error('Modifier 未生效');
    }
    sys.removeModifier('temp');
    sys.spendGold(sys.gold, 'reset'); // 清零方便观察
    if (sys.gainGold({ source: GoldSource.Quest, baseAmount: 0 }) !== 0) {
        throw new Error('removeModifier 未生效');
    }
});

TestRegistry.register('[Gold][Mod] findModifier 查找已注册 id', () => {
    const sys = new GoldSystem();
    sys.addModifier(new ComboKillModifier(() => 0));
    const found = sys.findModifier<ComboKillModifier>('combo_kill');
    if (!found) throw new Error('findModifier 没找到 combo_kill');
    if (sys.findModifier('nope') !== null) throw new Error('未注册的应返回 null');
});

// ── G. tick 连杀超时清零 ──────────────────────────────────────

TestRegistry.register('[Gold][System] tick 5 秒后 combo 不清零（未 init 不维护 combo）', () => {
    // 独立实例不调 init，combo 永远 0；这里验证 tick 不抛异常即可
    const sys = new GoldSystem();
    sys.tick(0.5);
    sys.tick(10);
    if (sys.combo !== 0) throw new Error(`combo ${sys.combo}`);
});

// ── H. 单例存在性 ────────────────────────────────────────────

TestRegistry.register('[Gold][System] 单例 GoldSystem.inst 可用', () => {
    const a = GoldSystem.inst;
    const b = GoldSystem.inst;
    if (a !== b) throw new Error('单例不一致');
});

// ── I. GameEvt 命名常量 ───────────────────────────────────────

TestRegistry.register('[Gold][Event] GameEvt 5 个金币事件名都已定义', () => {
    const must = ['EnemyDeath', 'GoldDrop', 'GoldPickupBegin', 'GoldPickupEnd', 'GoldGained', 'GoldSpent'];
    for (const k of must) {
        if (!(k in GameEvt)) throw new Error(`GameEvt 缺 ${k}`);
        const v = (GameEvt as Record<string, string>)[k];
        if (typeof v !== 'string' || v.length === 0) throw new Error(`GameEvt.${k} 值无效`);
    }
});
