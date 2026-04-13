/**
 * 技能系统模块
 *
 * - effects/        Buff 效果实现（SimpleAttrBuff、BurnDot …）
 * - SkillSystem     主动技能管理器：装备 / 卸下 / CD tick / 释放
 * - ArrowStormSkill 箭雨倾泻
 * - DashShotSkill   闪身射击
 */
import './effects';
export { SkillSystem } from './SkillSystem';
export type { IActiveSkill, SkillContext } from './SkillTypes';
export { ArrowStormSkill } from './ArrowStormSkill';
export { DashShotSkill } from './DashShotSkill';
