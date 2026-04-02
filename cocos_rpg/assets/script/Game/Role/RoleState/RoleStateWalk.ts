import { _decorator, Component, Node, Vec2 } from 'cc';
import { RoleStateBase } from '../RoleStateBase';
import { RoleAnim, RoleState } from '../../GlobalEnum/Enum';
import { joystick } from '../../joystick/joystick';
const { ccclass, property } = _decorator;

@ccclass('RoleStateWalk')
export class RoleStateWalk extends RoleStateBase {
    
    // 静态初始化块 - 自动注册
    static {
        RoleStateBase.registerState(RoleState.WALK, RoleStateWalk);
    }
    
    override enterState(): void {
        super.enterState();
        this.roleMgr.playAnim(RoleAnim.WALK);
        console.log('进入walk状态');
    }

    override updateState(dt: number): void {
        if(joystick.instance.direction.length() < 0.01) {
            this.roleMgr.rightBody.linearVelocity = new Vec2(0, 0);
            this.roleMgr.changeState(RoleState.IDLE);
        }
        joystick.instance.direction.normalize();
        let speed:Vec2=joystick.instance.direction.multiplyScalar(this.roleMgr.moveSpeed*dt);

        if(speed.x > 0) {
            this.roleMgr.node.setScale(1, 1, 1);
        } else {
            this.roleMgr.node.setScale(-1, 1, 1);
        }
        this.roleMgr.rightBody.linearVelocity = speed;
    }

    override exitState(): void {
        super.exitState();
        console.log('退出walk状态');
    }
}


