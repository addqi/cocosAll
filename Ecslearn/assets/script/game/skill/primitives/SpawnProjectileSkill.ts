import { Color, Vec3 } from 'cc';
import type { IActiveSkill, SkillContext, SkillDef } from '../SkillTypes';
import { SkillFactory } from '../SkillFactory';
import { getPayloadDef } from '../../combat/attack/AttackPayload';
import { createHitContext } from '../../hitEffects/types';
import type { EnemyBase } from '../../enemy/base/EnemyBase';

/**
 * 投射物技能原语 — 统一处理箭雨/火球/冰锥/飞刀等。
 *
 * 技能只负责 "决定释放参数"，实际生成投射物由攻击执行器完成。
 */
export class SpawnProjectileSkill implements IActiveSkill {
    readonly id: string;
    readonly name: string;
    readonly maxCooldown: number;
    currentCd = 0;
    level = 1;

    readonly projectileCount: number;
    readonly speed: number;
    readonly scatter: number;
    readonly homingStrength: number;
    readonly maxRange: number;
    readonly hitRadius: number;
    readonly payloadRef: string;
    readonly tags: readonly string[];
    readonly color: Color;

    private _params: Record<string, unknown>;

    constructor(def: SkillDef) {
        this.id              = def.id;
        this.name            = def.name;
        this.maxCooldown     = def.cooldown;
        const p              = def.params as Record<string, any>;
        this.projectileCount = p.projectileCount ?? 1;
        this.speed           = p.speed ?? 600;
        this.scatter         = p.scatter ?? 0;
        this.homingStrength  = p.homingStrength ?? 0;
        this.maxRange        = p.maxRange ?? 1200;
        this.hitRadius       = p.hitRadius ?? 18;
        this.payloadRef      = def.payloadRef ?? '';
        this.tags            = def.tags ?? [];
        this.color           = _parseColor(p.color, new Color(255, 140, 40, 255));
        this._params         = { ...p };
    }

    get params(): Readonly<Record<string, unknown>> { return this._params; }

    canUse(): boolean { return this.currentCd <= 0; }

    tick(dt: number): void {
        if (this.currentCd > 0) this.currentCd = Math.max(0, this.currentCd - dt);
    }

    execute(ctx: SkillContext): void {
        this.currentCd = this.maxCooldown;

        const origin = ctx.playerNode.worldPosition.clone();
        const payload = getPayloadDef(this.payloadRef);
        const payloadRatio = payload?.damageRatio ?? 1;
        const damageRatio = payloadRatio * this.level;

        const dir = new Vec3();
        Vec3.subtract(dir, ctx.mouseWorldPos, origin);
        if (Vec3.len(dir) < 0.001) dir.set(1, 0, 0);

        const onHit = _makeOnHit(ctx, origin);

        const spec = {
            attackType: 'projectile' as const,
            skillId: this.id,
            payloadRef: this.payloadRef,
            count: this.projectileCount * this.level,
            scatter: this.scatter,
            origin,
            dir,
            speed: this.speed,
            homingStrength: this.homingStrength,
            maxRange: this.maxRange,
            hitRadius: this.hitRadius,
            color: this.color,
            damageRatio,
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

function _makeOnHit(ctx: SkillContext, origin: Vec3) {
    return (target: EnemyBase, damageRatio: number) => {
        if (!target.node.isValid || target.combat.isDead) return;
        const hitCtx = createHitContext(
            ctx.playerProp, ctx.playerCombat,
            target.combat, target.buffMgr, target.buffOwner,
        );
        hitCtx.damageRatio = damageRatio;
        hitCtx.targetNode = target.node;
        hitCtx.hitOriginPos = origin.clone();
        ctx.hitEffectMgr.execute(hitCtx);
    };
}

SkillFactory.register('SpawnProjectileSkill', (def) => new SpawnProjectileSkill(def));
