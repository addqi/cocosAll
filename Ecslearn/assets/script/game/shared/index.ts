/**
 * 游戏公共模块 - 统一导出
 *
 * 包含所有实体（玩家、敌人等）共用的：
 * - 业务枚举（EPropertyId / EPropertyConfigId）
 * - 共享属性结构配置（SHARED_ATTRIBUTE_CONFIGS / PROP_CONFIG_MAP）
 * - 公共属性管理器（EntityPropertyMgr）
 * - Buff 管理器（EntityBuffMgr）
 * - Buff 与属性的桥接（AttributeChangeResolver）
 */

// 触发所有 BuffEffect 注册（由 sync:buff-effects 自动生成）
import './buff/index';

// 业务枚举
export { EPropertyId, EPropertyConfigId } from './enum/propertyEnum';

// 共享配置
export { SHARED_ATTRIBUTE_CONFIGS } from './config/propertyConfig/attributeConfigs';
export { PROP_CONFIG_MAP } from './config/propertyConfig/propConfigMap';

// 公共管理器
export { EntityPropertyMgr } from './EntityPropertyMgr';
export type { ModifierHandle, PropertyBaseConfig } from './EntityPropertyMgr';
export { EntityBuffMgr } from './EntityBuffMgr';

// Buff 与属性桥接
export { AttributeChangeResolver } from './AttributeChangeResolver';
