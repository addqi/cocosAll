import type { IActiveSkill, SkillContext, SkillDef } from '../SkillTypes';
import { SkillFactory } from '../SkillFactory';

/**
 * 投射物技能原语 — 统一处理箭雨/火球/冰锥/飞刀等。
 *
 * 技能只负责 "决定释放参数"，实际生成投射物由攻击执行器完成。
 * 当前阶段先用回调桩代替执行器，保证测试链路通。
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
    readonly payloadRef: string;
    readonly tags: readonly string[];

    private _params: Record<string, unknown>;

    constructor(def: SkillDef) {
        this.id             = def.id;
        this.name           = def.name;
        this.maxCooldown    = def.cooldown;
        const p             = def.params as Record<string, any>;
        this.projectileCount = p.projectileCount ?? 1;
        this.speed          = p.speed ?? 400;
        this.scatter        = p.scatter ?? 0;
        this.payloadRef     = def.payloadRef ?? '';
        this.tags           = def.tags ?? [];
        this._params        = { ...p };
    }

    get params(): Readonly<Record<string, unknown>> { return this._params; }

    canUse(): boolean { return this.currentCd <= 0; }

    tick(dt: number): void {
        if (this.currentCd > 0) this.currentCd = Math.max(0, this.currentCd - dt);
    }

    execute(ctx: SkillContext): void {
        this.currentCd = this.maxCooldown;
        const spec = {
            attackType: 'projectile' as const,
            skillId: this.id,
            count: this.projectileCount * this.level,
            speed: this.speed,
            scatter: this.scatter,
            origin: ctx.playerNode.worldPosition.clone(),
            target: ctx.mouseWorldPos.clone(),
            payloadRef: this.payloadRef,
            params: this._params,
        };
        ctx.behavior.onBehaviorCommand('execute_attack', spec);
    }
}

SkillFactory.register('SpawnProjectileSkill', (def) => new SpawnProjectileSkill(def));
