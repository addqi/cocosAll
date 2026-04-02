import { _decorator, Component, Node } from 'cc';
import { RoleStateBase } from '../RoleStateBase';
import { RoleState } from '../../GlobalEnum/Enum';
const { ccclass, property } = _decorator;

@ccclass('RoleStateDead')
export class RoleStateDead extends RoleStateBase {
    
    // 静态初始化块 - 自动注册
    static {
        RoleStateBase.registerState(RoleState.DEAD, RoleStateDead);
    }
    
    override enterState(): void {
        super.enterState();
        console.log('进入死亡状态');
    }
    override exitState(): void {
        super.exitState();
        console.log('退出死亡状态');
    }
    override updateState(): void {
        console.log('更新死亡状态');
    }
}
