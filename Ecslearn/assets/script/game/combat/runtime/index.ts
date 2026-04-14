/**
 * combat/runtime — 战斗运行时服务层
 *
 * 实际实现仍在 game/entity/，此处仅做语义收口 re-export。
 * 后续物理迁移文件时，只需改这里的来源路径，外部 import 不变。
 */
export { EntityPropertyMgr } from '../../entity/EntityPropertyMgr';
export type { ModifierHandle, PropertyBaseConfig } from '../../entity/EntityPropertyMgr';
export { EntityBuffMgr } from '../../entity/EntityBuffMgr';
export { AttributeChangeResolver } from '../../entity/AttributeChangeResolver';
export { HitEffectMgr } from '../../entity/HitEffectMgr';
export type { IDamageable } from '../../entity/IDamageable';
export type { ITargetable } from '../../entity/ITargetable';
