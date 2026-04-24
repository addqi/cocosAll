import { _decorator, Enum } from 'cc';
import { EMinionType } from './behaviors';
import { EnemyBase } from '../base/EnemyBase';
import { EMobState } from '../base/types';
import type { EnemyConfigData } from '../config/enemyConfig';
import type { PropertyBaseConfig } from '../../entity/EntityPropertyMgr';
import { EnemyBehaviorFactory } from '../../../baseSystem/enemy';
import { StateMachine } from '../../../baseSystem/fsm';
import { PlayerControl } from '../../player/PlayerControl';
import { LevelRun } from '../../level/LevelRun';
import { isCombatActive } from '../../level/LevelPhaseTransition';
import type { MinionBehavior } from './MinionBehavior';
import type { IMinionCtx } from './MinionContext';
import {
    MinionIdleState,
    MinionWanderState,
    MinionChaseState,
    MinionWindUpState,
    MinionAttackState,
    MinionRecoveryState,
    MinionStaggerState,
    MinionDeadState,
} from './states';

const { ccclass, property } = _decorator;
const MinionTypeEnum = Enum(EMinionType);

@ccclass('MinionControl')
export class MinionControl extends EnemyBase {
    @property({ type: MinionTypeEnum, tooltip: '小怪类型' })
    behaviorId: EMinionType = EMinionType.Warrior;

    private _behavior!: MinionBehavior;
    private _fsm!: StateMachine<EMobState, IMinionCtx>;
    private _ctx!: IMinionCtx;

    protected getConfig(): EnemyConfigData { return this._behavior.config; }
    protected getPropertyCfg(): PropertyBaseConfig { return this._behavior.propertyCfg; }

    onLoad() {
        this._behavior = EnemyBehaviorFactory.create<MinionBehavior>(this.behaviorId);
        super.onLoad();
        this._initFsm();
    }

    update(dt: number) {
        // 暂停门禁：非战斗阶段（Upgrading / Victory / GameOver ...）敌人 FSM 不跑
        // 死亡状态是例外：已进 Dead 的敌人仍要播溶解动画直到 destroy，不能冻
        const run = LevelRun.current;
        if (run && !isCombatActive(run.phase) && this._state !== EMobState.Dead) {
            return;
        }

        this._flashWhite?.tick(dt);

        const player = PlayerControl.instance;
        if (player && !player.combat.isDead && this._combat.isDead && this._state !== EMobState.Dead) {
            this._state = EMobState.Dead;
            this._fsm.changeState(EMobState.Dead);
        }

        this._tickStagger(dt);

        this._buffMgr.update(dt);
        this._fsm.tick(dt);

        if (this._state !== EMobState.Dead) {
            this._visual.updateHpBar(this._combat, dt);
        }
    }

    private _tickStagger(dt: number): void {
        if (this._state === EMobState.Dead) return;

        if (this._staggerTimer > 0) {
            if (this._state !== EMobState.Stagger) {
                this._state = EMobState.Stagger;
                this._fsm.changeState(EMobState.Stagger);
            }
            this._staggerTimer -= dt;
            if (this._staggerTimer < 0) this._staggerTimer = 0;
        } else if (this._state === EMobState.Stagger) {
            this._state = EMobState.Idle;
            this._fsm.changeState(EMobState.Idle);
        }
    }

    private _initFsm() {
        this._ctx = {
            behavior: this._behavior,
            visual: this._visual,
            movement: this._movement,
            cfg: this._cfg,
            node: this.node,
            body: this._body,
            anim: this._anim,
            prop: this._prop,
            combat: this._combat,
            groundFX: this._groundFX,
            uiAnchor: this._uiAnchor,
            fsm: null!,
            facingAngle: 0,
            xpGranted: false,
        };

        this._fsm = new StateMachine<EMobState, IMinionCtx>(this._ctx);
        this._ctx.fsm = this._fsm;

        this._fsm.addState(EMobState.Idle,     new MinionIdleState());
        this._fsm.addState(EMobState.Wander,   new MinionWanderState());
        this._fsm.addState(EMobState.Chase,    new MinionChaseState());
        this._fsm.addState(EMobState.WindUp,   new MinionWindUpState());
        this._fsm.addState(EMobState.Attack,   new MinionAttackState());
        this._fsm.addState(EMobState.Recovery, new MinionRecoveryState());
        this._fsm.addState(EMobState.Stagger,  new MinionStaggerState());
        this._fsm.addState(EMobState.Dead,     new MinionDeadState());
        this._fsm.changeState(EMobState.Idle);
    }
}
