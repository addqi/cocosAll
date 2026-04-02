import { _decorator, Component, Node } from 'cc';
import { RoleStateBase } from '../RoleStateBase';
import { RoleState } from '../../GlobalEnum/Enum';
const { ccclass, property } = _decorator;

@ccclass('RoleStateRun')
export class RoleStateRun extends RoleStateBase {
    
    // 静态初始化块 - 自动注册
    static {
        RoleStateBase.registerState(RoleState.RUN, RoleStateRun);
    }
    
    override enterState(): void {
        super.enterState();
        console.log('进入run状态');
    }
    override exitState(): void {
        super.exitState();
        console.log('退出run状态');
    }
    override updateState(): void {
        console.log('更新run状态');
    }
}


