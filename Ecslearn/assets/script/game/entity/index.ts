/**
 * 实体服务模块
 *
 * 提供所有游戏实体（玩家、敌人、NPC 等）共用的：
 * - EntityPropertyMgr：属性管理（基础值 + 修饰器链）
 * - EntityBuffMgr：Buff 生命周期管理
 * - AttributeChangeResolver：Buff 与属性系统的桥接
 */
export { EntityPropertyMgr } from './EntityPropertyMgr';
export type { ModifierHandle, PropertyBaseConfig } from './EntityPropertyMgr';
export { EntityBuffMgr } from './EntityBuffMgr';
export { AttributeChangeResolver } from './AttributeChangeResolver';
