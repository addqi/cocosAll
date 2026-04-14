/**
 * 技能系统模块
 *
 * - effects/        Buff 效果实现
 * - primitives/     技能原语（SpawnProjectile / Area / SelfBuff / Dash / Summon）
 * - SkillSystem     主动技能管理器
 * - SkillFactory    注册表 + JSON 驱动工厂
 * - ArrowStormSkill / DashShotSkill  旧技能（保留兼容）
 */
import './effects';
import './primitives';
import './registerBuiltinSkills';

export { SkillSystem } from './SkillSystem';
export { SkillFactory } from './SkillFactory';
export type { IActiveSkill, SkillContext, SkillDef, IBehaviorCommandSink } from './SkillTypes';
export { ArrowStormSkill } from './ArrowStormSkill';
export { DashShotSkill } from './DashShotSkill';
export * from './primitives';
