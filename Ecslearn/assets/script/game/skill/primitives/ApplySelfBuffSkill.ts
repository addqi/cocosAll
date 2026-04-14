import type { IActiveSkill, SkillContext, SkillDef } from '../SkillTypes';
import type { BuffData } from '../../../baseSystem/buff';
import { SkillFactory } from '../SkillFactory';

/**
 * 自 Buff 技能原语 — 狂暴/护盾/加速/自动射击模式。
 * 可附带 behaviorCmd 用于非属性效果（如切射击模式）。
 */
export class ApplySelfBuffSkill implements IActiveSkill {
    readonly id: string;
    readonly name: string;
    readonly maxCooldown: number;
    currentCd = 0;
    level = 1;

    private _duration: number;
    private _buffId: number;
    private _buffName: string;
    private _effectClass: string;
    private _targetAttr: string;
    private _valuePerStack: number;
    private _behaviorCmd: string;
    private _behaviorArgs: unknown[];
    private _endBehaviorCmd: string;
    private _endBehaviorArgs: unknown[];
    private _effectTimer = 0;
    private _ctx: SkillContext | null = null;

    constructor(def: SkillDef) {
        this.id          = def.id;
        this.name        = def.name;
        this.maxCooldown = def.cooldown;
        const p          = def.params as Record<string, any>;
        this._duration      = p.duration ?? 5;
        this._buffId        = p.buffId ?? 9999;
        this._buffName      = p.buffName ?? def.name;
        this._effectClass   = p.effectClass ?? 'AttrModifierEffect';
        this._targetAttr    = p.targetAttr ?? '';
        this._valuePerStack = p.valuePerStack ?? 0;
        this._behaviorCmd    = p.behaviorCmd ?? '';
        this._behaviorArgs   = p.behaviorArgs ?? [];
        this._endBehaviorCmd  = p.endBehaviorCmd ?? '';
        this._endBehaviorArgs = p.endBehaviorArgs ?? [];
    }

    get isActive(): boolean { return this._effectTimer > 0; }
    get effectRemain(): number { return this._effectTimer; }

    canUse(): boolean { return this.currentCd <= 0 && this._effectTimer <= 0; }

    tick(dt: number): void {
        if (this.currentCd > 0) this.currentCd = Math.max(0, this.currentCd - dt);
        if (this._effectTimer > 0) {
            this._effectTimer -= dt;
            if (this._effectTimer <= 0) this._endEffect();
        }
    }

    execute(ctx: SkillContext): void {
        this.currentCd = this.maxCooldown;
        this._effectTimer = this._duration;
        this._ctx = ctx;

        if (this._targetAttr) {
            const buff: BuffData = {
                id: this._buffId,
                name: this._buffName,
                duration: this._duration,
                effectClass: this._effectClass,
                targetAttr: this._targetAttr,
                valuePerStack: this._valuePerStack * this.level,
            };
            ctx.buffMgr.addBuff(buff, ctx.buffOwner);
        }

        if (this._behaviorCmd) {
            ctx.behavior.onBehaviorCommand(this._behaviorCmd, ...this._behaviorArgs);
        }
    }

    dispose(_ctx: SkillContext): void {
        this._endEffect();
    }

    private _endEffect(): void {
        this._effectTimer = 0;
        if (!this._ctx) return;
        if (this._targetAttr) {
            this._ctx.buffMgr.removeBuff(this._buffId);
        }
        if (this._endBehaviorCmd) {
            this._ctx.behavior.onBehaviorCommand(this._endBehaviorCmd, ...this._endBehaviorArgs);
        }
        this._ctx = null;
    }
}

SkillFactory.register('ApplySelfBuffSkill', (def) => new ApplySelfBuffSkill(def));
