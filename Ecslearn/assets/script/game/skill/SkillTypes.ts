import type { Node, Vec3 } from 'cc';
import type { IBuffOwner } from '../../baseSystem/buff';
import type { PlayerCombat } from '../player/combat/PlayerCombat';
import type { PlayerProperty } from '../player/property/playerProperty';
import type { EntityBuffMgr } from '../entity/EntityBuffMgr';
import type { HitEffectMgr } from '../entity/HitEffectMgr';
import type { PlayerServices } from '../player/runtime/PlayerServices';

/** 行为层命令接口 — 技能不直接依赖具体职业 */
export interface IBehaviorCommandSink {
    onBehaviorCommand(cmd: string, ...args: unknown[]): void;
}

/**
 * 通用技能上下文 — 不含任何职业私货。
 * 职业私有能力（射击策略等）通过 behavior 命令暴露。
 */
export interface SkillContext {
    playerProp: PlayerProperty;
    playerCombat: PlayerCombat;
    playerNode: Node;
    hitEffectMgr: HitEffectMgr;
    buffMgr: EntityBuffMgr;
    buffOwner: IBuffOwner;
    mouseWorldPos: Vec3;
    behavior: IBehaviorCommandSink;
    services: PlayerServices;
}

/**
 * JSON 驱动的技能定义
 */
export interface SkillDef {
    id: string;
    name: string;
    skillClass: string;
    cooldown: number;
    params: Record<string, unknown>;
    payloadRef?: string;
    tags?: string[];
}

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
