import { _decorator, Component, Sprite } from 'cc';
import { Entity } from '../../baseSystem/ecs';
import { StateMachine } from '../../baseSystem/fsm';
import { RawInputComp, ActionComp, EAction, VelocityComp, NodeRefComp } from '../component';
import { World } from '../core/World';
import { PlayerAnimation } from './anim/PlayerAnimation';
import {
    EPlayerState,
    type PlayerCtx,
    PlayerIdleState,
    PlayerRunState,
    PlayerShootState,
} from './states';

const { ccclass } = _decorator;

/**
 * 玩家控制器（OOP 大脑 + ECS 代理）
 *
 * - ECS 侧：创建代理 Entity 注册到 World，共享系统处理输入和移动
 * - OOP 侧：FSM 状态机管理 Idle/Run/Shoot 等复杂行为
 * - lateUpdate 中读取 ECS 数据驱动状态机切换
 *
 * 场景节点结构：
 *   GameRoot  ← 挂 GameLoop（onLoad 创建 World）
 *     Player  ← 挂 PlayerControl + PlayerAnimation + Sprite
 */
@ccclass('PlayerControl')
export class PlayerControl extends Component {
    private _entity: Entity = null!;
    private _anim: PlayerAnimation = null!;
    private _fsm!: StateMachine<EPlayerState, PlayerCtx>;

    onLoad() {
        if (!this.getComponent(Sprite)) {
            this.node.addComponent(Sprite);
        }
        this._anim = this.getComponent(PlayerAnimation) || this.node.addComponent(PlayerAnimation);
    }

    start() {
        if (!World.inst) {
            console.error(
                '[PlayerControl] World 尚未初始化，请确保场景中有一个节点挂了 GameLoop，' +
                '且该节点在 Player 节点之前（父节点或靠前的兄弟节点）。',
            );
            return;
        }

        this._initProxy();
        this._initFsm();
    }

    private _initProxy() {
        this._entity = new Entity();
        this._entity.addComponent(new RawInputComp());
        this._entity.addComponent(new ActionComp());
        this._entity.addComponent(new VelocityComp());
        this._entity.addComponent(new NodeRefComp(this.node));
        World.inst.add(this._entity);
    }

    private _initFsm() {
        const ctx: PlayerCtx = { anim: this._anim, node: this.node, fsm: null! };
        this._fsm = new StateMachine<EPlayerState, PlayerCtx>(ctx);
        ctx.fsm = this._fsm;

        this._fsm.addState(EPlayerState.Idle,  new PlayerIdleState());
        this._fsm.addState(EPlayerState.Run,   new PlayerRunState());
        this._fsm.addState(EPlayerState.Shoot, new PlayerShootState());
        this._fsm.changeState(EPlayerState.Idle);
    }

    lateUpdate(dt: number) {
        if (!this._entity) return;

        const vel = this._entity.getComponent(VelocityComp)!;
        const act = this._entity.getComponent(ActionComp)!;
        const isMoving = vel.vx !== 0 || vel.vy !== 0;

        if (act.justPressed.has(EAction.Attack) && this._fsm.current !== EPlayerState.Shoot) {
            this._fsm.changeState(EPlayerState.Shoot);
        } else if (this._fsm.current !== EPlayerState.Shoot) {
            this._fsm.changeState(isMoving ? EPlayerState.Run : EPlayerState.Idle);
        }

        if (vel.vx !== 0) {
            this.node.setScale(vel.vx < 0 ? -1 : 1, 1, 1);
        }

        this._fsm.tick(dt);
    }

    onDestroy() {
        if (this._entity && World.inst) {
            World.inst.remove(this._entity);
        }
    }
}
