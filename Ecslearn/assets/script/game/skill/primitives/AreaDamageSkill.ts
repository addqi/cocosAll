import type { IActiveSkill, SkillContext, SkillDef } from '../SkillTypes';
import { SkillFactory } from '../SkillFactory';

/**
 * 范围伤害技能原语 — 冰环/雷暴/毒云/爆炸/地刺。
 */
export class AreaDamageSkill implements IActiveSkill {
    readonly id: string;
    readonly name: string;
    readonly maxCooldown: number;
    currentCd = 0;
    level = 1;

    readonly radius: number;
    readonly damageRatio: number;
    readonly centered: boolean;
    readonly payloadRef: string;

    constructor(def: SkillDef) {
        this.id          = def.id;
        this.name        = def.name;
        this.maxCooldown = def.cooldown;
        const p          = def.params as Record<string, any>;
        this.radius      = p.radius ?? 150;
        this.damageRatio = p.damageRatio ?? 1.0;
        this.centered    = p.centered ?? false;
        this.payloadRef  = def.payloadRef ?? '';
    }

    canUse(): boolean { return this.currentCd <= 0; }

    tick(dt: number): void {
        if (this.currentCd > 0) this.currentCd = Math.max(0, this.currentCd - dt);
    }

    execute(ctx: SkillContext): void {
        this.currentCd = this.maxCooldown;
        const center = this.centered
            ? ctx.playerNode.worldPosition.clone()
            : ctx.mouseWorldPos.clone();

        const spec = {
            attackType: 'area' as const,
            skillId: this.id,
            center,
            radius: this.radius,
            damageRatio: this.damageRatio * this.level,
            payloadRef: this.payloadRef,
        };
        ctx.behavior.onBehaviorCommand('execute_attack', spec);
    }
}

SkillFactory.register('AreaDamageSkill', (def) => new AreaDamageSkill(def));
