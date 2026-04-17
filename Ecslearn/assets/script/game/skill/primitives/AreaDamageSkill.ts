import { Color, Vec3 } from 'cc';
import type { IActiveSkill, SkillContext, SkillDef } from '../SkillTypes';
import { SkillFactory } from '../SkillFactory';
import { getPayloadDef } from '../../combat/attack/AttackPayload';
import { createHitContext } from '../../hitEffects/types';
import type { EnemyBase } from '../../enemy/base/EnemyBase';

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
    readonly color: Color;

    constructor(def: SkillDef) {
        this.id          = def.id;
        this.name        = def.name;
        this.maxCooldown = def.cooldown;
        const p          = def.params as Record<string, any>;
        this.radius      = p.radius ?? 150;
        this.damageRatio = p.damageRatio ?? 1.0;
        this.centered    = p.centered ?? false;
        this.payloadRef  = def.payloadRef ?? '';
        this.color       = _parseColor(p.color, new Color(120, 200, 255, 255));
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

        const payload = getPayloadDef(this.payloadRef);
        const payloadRatio = payload?.damageRatio ?? 1;
        const damageRatio  = this.damageRatio * payloadRatio * this.level;

        const onHit = _makeOnHit(ctx, center);

        const spec = {
            attackType: 'area' as const,
            skillId: this.id,
            center,
            radius: this.radius,
            damageRatio,
            payloadRef: this.payloadRef,
            color: this.color,
            onHit,
        };
        ctx.behavior.onBehaviorCommand('execute_attack', spec);
    }
}

function _parseColor(raw: unknown, fallback: Color): Color {
    if (Array.isArray(raw) && raw.length >= 3) {
        return new Color(raw[0] ?? 255, raw[1] ?? 255, raw[2] ?? 255, raw[3] ?? 255);
    }
    return fallback;
}

function _makeOnHit(ctx: SkillContext, center: Vec3) {
    return (target: EnemyBase, damageRatio: number) => {
        if (!target.node.isValid || target.combat.isDead) return;
        const hitCtx = createHitContext(
            ctx.playerProp, ctx.playerCombat,
            target.combat, target.buffMgr, target.buffOwner,
        );
        hitCtx.damageRatio = damageRatio;
        hitCtx.targetNode = target.node;
        hitCtx.hitOriginPos = center.clone();
        ctx.hitEffectMgr.execute(hitCtx);
    };
}

SkillFactory.register('AreaDamageSkill', (def) => new AreaDamageSkill(def));
