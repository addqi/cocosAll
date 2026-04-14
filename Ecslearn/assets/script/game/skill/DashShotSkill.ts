import type { IActiveSkill, SkillContext } from './SkillTypes';
import type { BuffData } from '../../baseSystem/buff';

const BUFF_ID = 9001;

export class DashShotSkill implements IActiveSkill {
    readonly id = 'dash-shot';
    readonly name = '闪身射击';
    readonly maxCooldown: number;
    currentCd = 0;
    level = 1;

    private _duration: number;
    private _atkSpeedBoost: number;
    private _effectTimer = 0;
    private _ctx: SkillContext | null = null;

    constructor(cfg?: Partial<{
        cooldown: number;
        duration: number;
        atkSpeedBoost: number;
    }>) {
        this.maxCooldown    = cfg?.cooldown ?? 10;
        this._duration      = cfg?.duration ?? 5;
        this._atkSpeedBoost = cfg?.atkSpeedBoost ?? 1.0;
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

        const buff: BuffData = {
            id: BUFF_ID,
            name: '闪身射击',
            duration: this._duration,
            effectClass: 'SimpleAttrBuffEffect',
            targetAttr: 'AttackSpeed-Mul-Buff',
            valuePerStack: this._atkSpeedBoost,
        };
        ctx.buffMgr.addBuff(buff, ctx.buffOwner);
        ctx.behavior.onBehaviorCommand('set_shoot_policy_class', 'AutoShoot', 3);
    }

    dispose(_ctx: SkillContext): void {
        this._endEffect();
    }

    private _endEffect(): void {
        this._effectTimer = 0;
        if (!this._ctx) return;
        this._ctx.buffMgr.removeBuff(BUFF_ID);
        this._ctx.behavior.onBehaviorCommand('set_shoot_policy_class', 'HoldToShoot');
        this._ctx = null;
    }
}
