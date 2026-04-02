import { _decorator, Component, Node } from 'cc';
import { stateBase } from '../Base/RoleBase/stateBase';
import { RoleMgr } from './RoleMgr';
import { updateMgr } from './updateMgr';
import { RoleState } from '../GlobalEnum/Enum';
const { ccclass, property } = _decorator;

@ccclass('RoleStateBase')
export abstract class RoleStateBase extends stateBase {

    // 静态注册表，自动管理所有状态类
    private static stateRegistry: Map<RoleState, new (roleMgr: RoleMgr) => RoleStateBase> = new Map();

    // 注册状态类的静态方法
    public static registerState(stateType: RoleState, stateClass: new (roleMgr: RoleMgr) => RoleStateBase): void {
        this.stateRegistry.set(stateType, stateClass);
    }

    // 获取所有注册的状态类
    public static getStateRegistry(): Map<RoleState, new (roleMgr: RoleMgr) => RoleStateBase> {
        return this.stateRegistry;
    }
    /**角色管理器 */
    protected roleMgr: RoleMgr;
    /**更新引用 */
    private _updateRef: (dt: number) => void;
    /**状态 */
    constructor(roleMgr: RoleMgr) {
        super();
        this.roleMgr = roleMgr;

        // 只在构造时创建一次绑定函数
        this._updateRef = this.updateState.bind(this);
    }
    /**进入状态 */
    override enterState(): void {
        console.log('进入状态');
        
        // 检查updateMgr是否可用
        const mgr = updateMgr.get();
        if (!mgr) {
            console.error('updateMgr未找到！请确保updateMgr组件已添加到场景中');
            return;
        }
        
        mgr.addUpdate(this._updateRef);
    }

    /**退出状态 */
    override exitState(): void {
        console.log('退出状态');
        updateMgr.get().removeUpdate(this._updateRef);
    }
}
