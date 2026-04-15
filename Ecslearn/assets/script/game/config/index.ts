/**
 * 游戏配置模块 — 统一入口
 *
 * 所有配置统一从此处 import，消灭 config/ 与 game/config/ 双根。
 * 新增配置只进 game/config/ 对应子目录。
 */

// ── 枚举 ──
export { EPropertyId, EPropertyConfigId } from './enum/propertyEnum';

// ── 属性结构 ──
export { SHARED_ATTRIBUTE_CONFIGS } from './propertyConfig/attributeConfigs';
export { PROP_CONFIG_MAP } from './propertyConfig/propConfigMap';

// ── 纯数据类型（原 config/sharedTypes） ──
export type { PropertyBaseConfig, EnemyOverrides } from '../../config/sharedTypes';

// ── 敌人配置 ──
export { getEnemyData, allEnemyData, allEnemyIds, type EnemyDataEntry } from './enemyConfig/EnemyConfigLoader';

// ── Buff / HitEffect ──
export { getBuffDef, getHitEffectDef, allBuffIds, allHitEffectIds } from './buffConfig/BuffConfigLoader';

// ── 技能 ──
export { getSkillDef, allSkillIds, getSkillsByTag, getSkillsByClass } from './skillConfig/SkillConfigLoader';

// ── 攻击载荷 ──
export { getPayloadDef, allPayloadIds } from './payloadConfig/PayloadConfigLoader';

// ── 层配置（关卡序列 / 难度曲线） ──
export {
    getEnemyCount, getFloorScaling, getUnlockedEnemyTypes, getFloorType, floorConfig,
    type FloorType, type FloorScaling, type EnemyUnlockEntry,
} from './floorConfig/FloorConfigLoader';

// ── 房间模板 ──
export {
    getRoomDef, allRoomIds, getRoomsByTag, getRandomRoom,
    type RoomDef, type SpawnPoint, type ObstacleInfo, type Vec2Like,
} from './roomConfig/RoomConfigLoader';

// ── 肉鸽参数 ──
export {
    expToNextLevel, goldKeepRatio, skillChoiceCount, rarityWeights,
    pityConfig, getSynergies, shopConfig, roguelikeConfig,
    type RarityWeights, type PityConfig,
} from './roguelikeConfig/RoguelikeConfigLoader';

// ── Meta（跨局永久升级） ──
export {
    getMetaUpgrade, allMetaUpgrades, getUpgradeCost, allSkillUnlocks, metaConfig,
    type MetaUpgradeDef, type MetaEffect, type MetaEffectType,
    type SkillUnlockEntry, type UnlockCondition, type UnlockConditionType,
} from './metaConfig/MetaConfigLoader';

// ── 升级 / 进化 ──
export { upgradeConfig, evolutionConfig } from './upgradeConfig/UpgradeConfigLoader';
