import { _decorator, Component, Node } from 'cc';
import { RoleStateBase } from '../RoleStateBase';
import { RoleState } from '../../GlobalEnum/Enum';
const { ccclass, property } = _decorator;

@ccclass('RoleStateAttack')
export class RoleStateAttack extends RoleStateBase {
    
    // 静态初始化块 - 自动注册
    static {
        RoleStateBase.registerState(RoleState.ATTACK, RoleStateAttack);
    }
    
    override enterState(): void {
        super.enterState();
        console.log('进入攻击状态');
    }
    override exitState(): void {
        super.exitState();
        console.log('退出攻击状态');
    }
    override updateState(): void {
        console.log('更新攻击状态');
    }
}


