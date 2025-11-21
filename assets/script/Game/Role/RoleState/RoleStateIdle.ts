import { _decorator, Component, Node } from 'cc';
import { RoleStateBase } from '../RoleStateBase';
import { RoleAnim, RoleState } from '../../GlobalEnum/Enum';
import { joystick } from '../../joystick/joystick';
const { ccclass, property } = _decorator;

@ccclass('RoleStateIdle')
export class RoleStateIdle extends RoleStateBase {
    
    // 静态初始化块 - 自动注册
    static {
        RoleStateBase.registerState(RoleState.IDLE, RoleStateIdle);
    }
    
    override enterState(): void {
        super.enterState();
        console.log('进入idle状态');
        this.roleMgr.playAnim(RoleAnim.IDLE);
    }
    override exitState(): void {
        super.exitState();
        console.log('退出idle状态');
    }
    override updateState(): void {

        // 添加安全检查，防止 joystick.instance 或 direction 为 undefined
        if(joystick.instance && joystick.instance.direction && joystick.instance.direction.length() > 0) {
            this.roleMgr.changeState(RoleState.WALK);
        }
    }
}


