import { _decorator, Component, Node,Animation, Material, SpriteFrame, Sprite, RigidBody2D } from 'cc';
import { RoleStateBase } from './RoleStateBase';
import { RoleAnim, RoleState } from '../GlobalEnum/Enum';
import { RolePropertyMgr } from './RolePropertyMgr';
import { BuffMgr } from '../Buff/BuffMgr';
const { ccclass, property } = _decorator;

@ccclass('RoleMgr')
export class RoleMgr extends Component {
    /**实例 */
    private  _instance: RoleMgr;
    get(): RoleMgr {
        return this._instance;
    }
    /**动画 */
    @property(Animation)
    public anim: Animation;
    @property(RigidBody2D)
    public rightBody:RigidBody2D;

    private roleProMgr:RolePropertyMgr;
    private rolebuffMgr:BuffMgr;

    private material: Material;
    /**当前状态 */
    private currentState: RoleStateBase;
    /**状态映射 */
    private stateMap: Map<RoleState, RoleStateBase> = new Map();
    //运动相关参数
    public  readonly moveSpeed: number = 100;


    protected onLoad(): void {
        this.initState();
        this.roleProMgr = this.node.getComponent(RolePropertyMgr);
        this.rolebuffMgr = new BuffMgr(this.roleProMgr);
        this._instance = this;
        this.material = this.anim.node.getComponent(Sprite)!.sharedMaterial!;
    }
    start() {
        //初始化状态
        this.currentState = this.stateMap.get(RoleState.IDLE);
        this.currentState.enterState();
    }

    initState() {
        // 使用自动注册系统创建所有状态实例
        const stateRegistry = RoleStateBase.getStateRegistry();
        stateRegistry.forEach((StateClass, stateType) => {
            this.stateMap.set(stateType, new StateClass(this));
        });
    }

    public changeState(name: RoleState) {
        if (this.currentState) {
            this.currentState.exitState();
        }

        this.currentState = this.stateMap.get(name);
        this.currentState.enterState();
    }

    update(deltaTime: number) {
        this.rolebuffMgr?.update(deltaTime);
    }

    //动画管理
    public playAnim(anim: RoleAnim) {
        if (this.anim.name === anim.toString()) {
            return;
        }
        this.anim.play(anim.toString());
    }

    public getBuffMgr(): BuffMgr {
        return this.rolebuffMgr;
    }

    public getPropertyMgr(): RolePropertyMgr {
        return this.roleProMgr;
    }
}


