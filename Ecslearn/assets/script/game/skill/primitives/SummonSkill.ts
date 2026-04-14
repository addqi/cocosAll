import type { IActiveSkill, SkillContext, SkillDef } from '../SkillTypes';
import { SkillFactory } from '../SkillFactory';

/**
 * 召唤技能原语 — 召唤狼/炮台/骷髅/分身。
 */
export class SummonSkill implements IActiveSkill {
    readonly id: string;
    readonly name: string;
    readonly maxCooldown: number;
    currentCd = 0;
    level = 1;

    readonly summonId: string;
    readonly maxCount: number;
    readonly duration: number;
    readonly summonHp: number;
    readonly summonAtk: number;

    constructor(def: SkillDef) {
        this.id          = def.id;
        this.name        = def.name;
        this.maxCooldown = def.cooldown;
        const p          = def.params as Record<string, any>;
        this.summonId    = p.summonId ?? 'generic';
        this.maxCount    = p.maxCount ?? 1;
        this.duration    = p.duration ?? 30;
        this.summonHp    = p.summonHp ?? 100;
        this.summonAtk   = p.summonAtk ?? 10;
    }

    canUse(): boolean { return this.currentCd <= 0; }

    tick(dt: number): void {
        if (this.currentCd > 0) this.currentCd = Math.max(0, this.currentCd - dt);
    }

    execute(ctx: SkillContext): void {
        this.currentCd = this.maxCooldown;
        const spec = {
            attackType: 'summon' as const,
            skillId: this.id,
            summonId: this.summonId,
            maxCount: this.maxCount,
            duration: this.duration,
            hp: this.summonHp * this.level,
            atk: this.summonAtk * this.level,
            origin: ctx.playerNode.worldPosition.clone(),
        };
        ctx.behavior.onBehaviorCommand('execute_attack', spec);
    }
}

SkillFactory.register('SummonSkill', (def) => new SummonSkill(def));
