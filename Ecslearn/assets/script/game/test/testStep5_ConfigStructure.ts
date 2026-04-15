import { TestRegistry } from './TestRegistry';
import {
    getEnemyCount, getFloorScaling, getUnlockedEnemyTypes, getFloorType, floorConfig,
    getRoomDef, allRoomIds, getRoomsByTag, getRandomRoom,
    expToNextLevel, goldKeepRatio, skillChoiceCount, rarityWeights, pityConfig,
    getSynergies, shopConfig, roguelikeConfig,
    getMetaUpgrade, allMetaUpgrades, getUpgradeCost, allSkillUnlocks,
    getPayloadDef, allPayloadIds,
    getEnemyData, allEnemyData, allEnemyIds,
    upgradeConfig, evolutionConfig,
    type FloorType, type RoomDef, type MetaUpgradeDef,
} from '../config';

// ══════════════════════════════════════
// Step 5: 全配置目录结构验证
// ══════════════════════════════════════

// ── floorConfig ──

TestRegistry.register('[Step5][floorConfig] getEnemyCount 第1层=3', () => {
    const c = getEnemyCount(1);
    if (c < 3) throw new Error(`第1层敌人数 ${c} < 3`);
});

TestRegistry.register('[Step5][floorConfig] getEnemyCount 不超过上限', () => {
    const c = getEnemyCount(999);
    const cfg = floorConfig();
    if (c > cfg.enemyCountMax) throw new Error(`${c} > max ${cfg.enemyCountMax}`);
});

TestRegistry.register('[Step5][floorConfig] getFloorScaling 返回乘数 > 1', () => {
    const s = getFloorScaling(5);
    if (s.hpMultiplier <= 1) throw new Error(`hp ${s.hpMultiplier}`);
    if (s.atkMultiplier <= 1) throw new Error(`atk ${s.atkMultiplier}`);
});

TestRegistry.register('[Step5][floorConfig] getUnlockedEnemyTypes 第1层至少有warrior', () => {
    const types = getUnlockedEnemyTypes(1);
    if (!types.includes('warrior')) throw new Error('第1层应包含 warrior');
});

TestRegistry.register('[Step5][floorConfig] getUnlockedEnemyTypes 第6层解锁bomber', () => {
    const types = getUnlockedEnemyTypes(6);
    if (!types.includes('bomber')) throw new Error('第6层应包含 bomber');
});

TestRegistry.register('[Step5][floorConfig] getFloorType 返回合法 FloorType', () => {
    const valid: FloorType[] = ['combat', 'elite', 'boss', 'shop', 'rest', 'treasure'];
    const t = getFloorType(1);
    if (!valid.includes(t)) throw new Error(`非法类型: ${t}`);
});

TestRegistry.register('[Step5][floorConfig] 第10层必为boss', () => {
    const t = getFloorType(10);
    if (t !== 'boss') throw new Error(`第10层应为 boss, got ${t}`);
});

// ── roomConfig ──

TestRegistry.register('[Step5][roomConfig] allRoomIds 至少4个房间', () => {
    const ids = allRoomIds();
    if (ids.length < 4) throw new Error(`房间数 ${ids.length} < 4`);
});

TestRegistry.register('[Step5][roomConfig] getRoomDef 可取 room_forest_01', () => {
    const r = getRoomDef('room_forest_01');
    if (!r) throw new Error('room_forest_01 不存在');
    if (r.width < 1 || r.height < 1) throw new Error('宽高异常');
    if (r.spawnPoints.length < 1) throw new Error('无出生点');
});

TestRegistry.register('[Step5][roomConfig] getRoomsByTag("boss") 至少1个', () => {
    const rooms = getRoomsByTag('boss');
    if (rooms.length < 1) throw new Error('无 boss 房间');
});

TestRegistry.register('[Step5][roomConfig] getRandomRoom 返回有效房间', () => {
    const r = getRandomRoom();
    if (!r) throw new Error('getRandomRoom 返回 null');
    if (!r.id) throw new Error('缺少 id');
});

TestRegistry.register('[Step5][roomConfig] 每个房间有 playerSpawn 和 warpGatePos', () => {
    for (const id of allRoomIds()) {
        const r = getRoomDef(id)!;
        if (r.playerSpawn == null) throw new Error(`${id} 缺 playerSpawn`);
        if (r.warpGatePos == null) throw new Error(`${id} 缺 warpGatePos`);
    }
});

// ── roguelikeConfig ──

TestRegistry.register('[Step5][roguelikeConfig] expToNextLevel(1) > 0', () => {
    const exp = expToNextLevel(1);
    if (exp <= 0) throw new Error(`exp ${exp}`);
});

TestRegistry.register('[Step5][roguelikeConfig] goldKeepRatio 在 0~1 之间', () => {
    const r = goldKeepRatio();
    if (r < 0 || r > 1) throw new Error(`ratio ${r}`);
});

TestRegistry.register('[Step5][roguelikeConfig] skillChoiceCount >= 3', () => {
    const c = skillChoiceCount();
    if (c < 3) throw new Error(`count ${c}`);
});

TestRegistry.register('[Step5][roguelikeConfig] rarityWeights 四档权重 > 0', () => {
    const w = rarityWeights();
    if (w.common <= 0) throw new Error('common <= 0');
    if (w.rare <= 0) throw new Error('rare <= 0');
    if (w.epic <= 0) throw new Error('epic <= 0');
    if (w.legendary <= 0) throw new Error('legendary <= 0');
});

TestRegistry.register('[Step5][roguelikeConfig] pityConfig 有保底阈值', () => {
    const p = pityConfig();
    if (p.epicAfter <= 0) throw new Error('epicAfter <= 0');
    if (p.legendaryAfter <= 0) throw new Error('legendaryAfter <= 0');
});

TestRegistry.register('[Step5][roguelikeConfig] getSynergies 可查询', () => {
    const cfg = roguelikeConfig();
    const firstKey = Object.keys(cfg.synergies)[0];
    if (!firstKey) throw new Error('synergies 为空');
    const s = getSynergies(firstKey);
    if (s.length === 0) throw new Error(`${firstKey} 无协同`);
});

TestRegistry.register('[Step5][roguelikeConfig] shopConfig 有 healRatio', () => {
    const s = shopConfig();
    if (s.healRatio <= 0 || s.healRatio > 1) throw new Error(`healRatio ${s.healRatio}`);
});

// ── metaConfig ──

TestRegistry.register('[Step5][metaConfig] allMetaUpgrades 至少 5 个', () => {
    const all = allMetaUpgrades();
    if (all.length < 5) throw new Error(`Meta 升级数 ${all.length} < 5`);
});

TestRegistry.register('[Step5][metaConfig] getMetaUpgrade("meta_hp") 存在', () => {
    const u = getMetaUpgrade('meta_hp');
    if (!u) throw new Error('meta_hp 不存在');
    if (u.maxLevel < 1) throw new Error('maxLevel < 1');
    if (u.costs.length !== u.maxLevel) throw new Error('costs 长度 != maxLevel');
});

TestRegistry.register('[Step5][metaConfig] getUpgradeCost 返回正确费用', () => {
    const cost = getUpgradeCost('meta_hp', 0);
    if (cost == null || cost <= 0) throw new Error(`cost ${cost}`);
});

TestRegistry.register('[Step5][metaConfig] getUpgradeCost 满级返回 null', () => {
    const u = getMetaUpgrade('meta_hp')!;
    const cost = getUpgradeCost('meta_hp', u.maxLevel);
    if (cost !== null) throw new Error('满级应返回 null');
});

TestRegistry.register('[Step5][metaConfig] allSkillUnlocks 有条目', () => {
    const unlocks = allSkillUnlocks();
    if (unlocks.length < 1) throw new Error('无技能解锁条目');
    if (!unlocks[0].skillId) throw new Error('缺 skillId');
    if (unlocks[0].conditions.length < 1) throw new Error('缺 conditions');
});

// ── payloadConfig ──

TestRegistry.register('[Step5][payloadConfig] allPayloadIds 至少 5 个', () => {
    const ids = allPayloadIds();
    if (ids.length < 5) throw new Error(`payload 数 ${ids.length} < 5`);
});

TestRegistry.register('[Step5][payloadConfig] getPayloadDef 可取 payload.normal_arrow', () => {
    const p = getPayloadDef('payload.normal_arrow');
    if (!p) throw new Error('payload.normal_arrow 不存在');
    if (p.damageRatio <= 0) throw new Error('damageRatio <= 0');
});

TestRegistry.register('[Step5][payloadConfig] 从 game/config 统一入口导出', () => {
    if (typeof getPayloadDef !== 'function') throw new Error('getPayloadDef 未从 config 导出');
    if (typeof allPayloadIds !== 'function') throw new Error('allPayloadIds 未从 config 导出');
});

// ── enemyConfig 迁移验证 ──

TestRegistry.register('[Step5][enemyConfig] allEnemyIds 至少 3 个', () => {
    const ids = allEnemyIds();
    if (ids.length < 3) throw new Error(`enemy 数 ${ids.length} < 3`);
});

TestRegistry.register('[Step5][enemyConfig] getEnemyData 从新位置加载', () => {
    const e = getEnemyData('bomber');
    if (e.id !== 'bomber') throw new Error('id 不匹配');
    if (e.name !== '自爆兵') throw new Error('name 不匹配');
});

TestRegistry.register('[Step5][enemyConfig] allEnemyData 内容与 allEnemyIds 一致', () => {
    const all = allEnemyData();
    const ids = allEnemyIds();
    if (all.length !== ids.length) throw new Error(`${all.length} != ${ids.length}`);
});

// ── upgradeConfig ──

TestRegistry.register('[Step5][upgradeConfig] upgradeConfig 返回升级列表', () => {
    const cfg = upgradeConfig();
    if (cfg.upgrades.length < 10) throw new Error(`升级数 ${cfg.upgrades.length} < 10`);
});

TestRegistry.register('[Step5][upgradeConfig] evolutionConfig 返回数组', () => {
    const evos = evolutionConfig();
    if (!Array.isArray(evos)) throw new Error('evolutionConfig 应返回数组');
});

// ── 统一入口完整性 ──

TestRegistry.register('[Step5][index.ts] game/config/index 导出所有子模块', () => {
    const fns = [
        getEnemyCount, getFloorScaling, getUnlockedEnemyTypes, getFloorType,
        getRoomDef, allRoomIds, getRoomsByTag, getRandomRoom,
        expToNextLevel, goldKeepRatio, skillChoiceCount, rarityWeights,
        pityConfig, getSynergies, shopConfig,
        getMetaUpgrade, allMetaUpgrades, getUpgradeCost, allSkillUnlocks,
        getPayloadDef, allPayloadIds,
        getEnemyData, allEnemyData, allEnemyIds,
        upgradeConfig, evolutionConfig,
    ];
    for (const fn of fns) {
        if (typeof fn !== 'function') throw new Error(`缺少导出: ${fn}`);
    }
});
