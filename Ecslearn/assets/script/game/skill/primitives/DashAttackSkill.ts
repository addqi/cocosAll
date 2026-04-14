import type { IActiveSkill, SkillContext, SkillDef } from '../SkillTypes';
import { SkillFactory } from '../SkillFactory';

/**
 * 冲锋攻击技能原语 — 冲锋斩/闪现斩/骑射。
 */
export class DashAttackSkill implements IActiveSkill {
    readonly id: string;
    readonly name: string;
    readonly maxCooldown: number;
    currentCd = 0;
    level = 1;

    readonly dashDistance: number;
    readonly dashDuration: number;
    readonly damageRatio: number;
    readonly payloadRef: string;

    constructor(def: SkillDef) {
        this.id          = def.id;
        this.name        = def.name;
        this.maxCooldown = def.cooldown;
        const p          = def.params as Record<string, any>;
        this.dashDistance = p.dashDistance ?? 300;
        this.dashDuration = p.dashDuration ?? 0.3;
        this.damageRatio = p.damageRatio ?? 1.5;
        this.payloadRef  = def.payloadRef ?? '';
    }

    canUse(): boolean { return this.currentCd <= 0; }

    tick(dt: number): void {
        if (this.currentCd > 0) this.currentCd = Math.max(0, this.currentCd - dt);
    }

    execute(ctx: SkillContext): void {
        this.currentCd = this.maxCooldown;
        const spec = {
            attackType: 'melee' as const,
            skillId: this.id,
            dashDistance: this.dashDistance,
            dashDuration: this.dashDuration,
            damageRatio: this.damageRatio * this.level,
            origin: ctx.playerNode.worldPosition.clone(),
            target: ctx.mouseWorldPos.clone(),
            payloadRef: this.payloadRef,
        };
        ctx.behavior.onBehaviorCommand('execute_attack', spec);
    }
}

SkillFactory.register('DashAttackSkill', (def) => new DashAttackSkill(def));
