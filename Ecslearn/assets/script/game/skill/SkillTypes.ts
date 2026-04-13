import type { Node, Vec3 } from 'cc';
import type { IBuffOwner } from '../../baseSystem/buff';
import type { PlayerCombat } from '../player/combat/PlayerCombat';
import type { PlayerProperty } from '../player/property/playerProperty';
import type { EntityBuffMgr } from '../entity/EntityBuffMgr';
import type { HitEffectMgr } from '../entity/HitEffectMgr';
import type { IShootPolicy } from '../shoot/types';
/**
 * 技能上下文
 * 
 * - playerProp: 玩家属性
 * - playerCombat: 玩家战斗
 * - playerNode: 玩家节点
 * - hitEffectMgr: 命中效果管理器
 * - buffMgr: 属性管理器
 * - buffOwner: 属性所有者
 * - mouseWorldPos: 鼠标世界位置
 * - setShootPolicy: 设置射击策略
 */
export interface SkillContext {
    playerProp: PlayerProperty;
    playerCombat: PlayerCombat;
    playerNode: Node;
    hitEffectMgr: HitEffectMgr;
    buffMgr: EntityBuffMgr;
    buffOwner: IBuffOwner;
    mouseWorldPos: Vec3;
    setShootPolicy(policy: IShootPolicy): void;
}
/**
 * 主动技能接口
 * 
 * - id: 技能唯一标识
 * - name: 技能名称
 * - maxCooldown: 技能最大冷却时间
 * - currentCd: 技能当前冷却时间
 * - level: 技能等级
 */
export interface IActiveSkill {
    readonly id: string;
    readonly name: string;
    readonly maxCooldown: number;
    currentCd: number;
    level: number;
    canUse(): boolean;
    execute(ctx: SkillContext): void;
    tick(dt: number): void;
    dispose?(ctx: SkillContext): void;
}
