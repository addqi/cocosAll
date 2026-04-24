import { playerBehavior } from '../../../baseSystem/player';
import { PlayerBehavior } from '../base';
import type { IAttackDecision, ISkillContextSource } from '../base';
import type { IState } from '../../../baseSystem/fsm';
import type { PlayerCtx } from '../states/PlayerContext';
import type { SkillContext } from '../../skill/SkillTypes';
import type { PlayerServices } from '../runtime/PlayerServices';
import type { IShootPolicy } from '../../shoot/types';
import { HoldToShoot, ClickToShoot, AutoShoot, ChargeShoot } from '../../shoot/ShootPolicies';
import { AttackExecutor } from '../../combat/attack/AttackExecutor';
import type { AttackSpec } from '../../combat/attack/AttackPayload';
import { ArcherAttackState } from './ArcherAttackState';
import type { ShootModeDef } from '../../config/classConfig/ClassConfigLoader';
import type { ActionComp } from '../../component';
import { EAction } from '../../component';

/**
 * 把"策略类名 + 可选 level"映射到 IShootPolicy 实例。
 * 未知名字返 null，由调用方决定回退（默认 HoldToShoot）。
 */
function createPolicyByClass(policyClass: string, level?: number): IShootPolicy | null {
    switch (policyClass) {
        case 'HoldToShoot':  return new HoldToShoot();
        case 'ClickToShoot': return new ClickToShoot();
        case 'AutoShoot':    return new AutoShoot(typeof level === 'number' ? level : 1);
        // 'ChargeShoot' 等未来类在这里扩展
        default: return null;
    }
}

/** 把"流派 ShootModeDef"映射到 IShootPolicy 实例 */
function createPolicyByMode(mode: ShootModeDef): IShootPolicy {
    switch (mode.type) {
        case 'hold':   return new HoldToShoot();
        case 'click':  return new ClickToShoot();
        case 'charge': return new ChargeShoot();
    }
}

@playerBehavior
export class ArcherBehavior extends PlayerBehavior {
    readonly typeId = 'archer';

    private _shootPolicy: IShootPolicy = new HoldToShoot();
    private _shootMode: ShootModeDef = { type: 'hold' };
    private _services: PlayerServices | null = null;

    get shootPolicy(): IShootPolicy { return this._shootPolicy; }
    get shootMode(): ShootModeDef { return this._shootMode; }

    setServices(s: PlayerServices): void { this._services = s; }

    wantAttack(d: IAttackDecision): boolean {
        return this._shootPolicy.wantShoot(d.input, d.hasTarget, d.isMoving);
    }

    createAttackState(): IState<PlayerCtx> {
        return new ArcherAttackState();
    }

    /**
     * 每帧输入 tick —— 由 PlayerControl.lateUpdate 显式调用。
     * 只有蓄力流才真正做事；其他模式直接 return。
     *
     * Linus 式数据流：
     *   - 按住 Attack 期间，chargeSec += dt（单调累加，无上限，超过 max 由 AttackState 截断）
     *   - 刚抬起那一帧（justReleased）：冻结 chargeSec → pendingChargeSec，chargeSec 归 0
     *   - 未按、非本次会话的其他情况：chargeSec 归 0
     */
    tickInput(ctx: PlayerCtx, input: ActionComp, dt: number): void {
        if (this._shootMode.type !== 'charge') return;

        const pressing = input.active.has(EAction.Attack);
        const released = input.justReleased.has(EAction.Attack);

        if (released) {
            ctx.pendingChargeSec = ctx.chargeSec;
            ctx.chargeSec = 0;
        } else if (pressing) {
            ctx.chargeSec += dt;
        } else {
            ctx.chargeSec = 0;
        }
    }

    /**
     * 蓄力流：正在蓄力时（chargeSec > 0 且仍按住）移速 × moveSpeedRatio。
     * 非蓄力流 / 未蓄力 = 1.0（由基类默认实现覆盖此分支）。
     */
    getMoveSpeedRatio(ctx: PlayerCtx): number {
        if (this._shootMode.type !== 'charge') return 1;
        if (ctx.chargeSec <= 0) return 1;
        return this._shootMode.moveSpeedRatio;
    }

    buildSkillContext(src: ISkillContextSource): SkillContext {
        return {
            playerProp:    src.playerProp,
            playerCombat:  src.playerCombat,
            playerNode:    src.playerNode,
            hitEffectMgr:  src.hitEffectMgr,
            buffMgr:       src.buffMgr,
            buffOwner:     src.buffOwner,
            mouseWorldPos: src.mouseWorldPos,
            behavior:      this,
            services:      this._services!,
        };
    }

    onBehaviorCommand(cmd: string, ...args: unknown[]): void {
        // 流派层：切射击模式 —— 同时记录 ShootModeDef（供未来蓄力状态读取）
        if (cmd === 'set_shoot_mode') {
            const mode = args[0] as ShootModeDef;
            if (!mode || typeof mode !== 'object' || typeof (mode as any).type !== 'string') {
                console.warn('[ArcherBehavior] set_shoot_mode 收到非法 ShootModeDef:', mode);
                return;
            }
            this._shootMode = mode;
            this._shootPolicy = createPolicyByMode(mode);
            return;
        }
        // 升级 / 技能层：按类名切 Policy（不影响 _shootMode）
        if (cmd === 'set_shoot_policy_class') {
            const cls = args[0] as string;
            const level = args[1] as number | undefined;
            const policy = createPolicyByClass(cls, level);
            if (!policy) {
                console.warn(`[ArcherBehavior] set_shoot_policy_class: 未知 policyClass "${cls}"`);
                return;
            }
            this._shootPolicy = policy;
            return;
        }
        // 兼容老路径：直接塞 Policy 实例
        if (cmd === 'set_shoot_policy') {
            this._shootPolicy = args[0] as IShootPolicy;
            return;
        }
        if (cmd === 'execute_attack') {
            AttackExecutor.execute(args[0] as AttackSpec);
            return;
        }
    }
}
