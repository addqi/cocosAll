import { input, Input, EventKeyboard, KeyCode } from 'cc';
import type { Entity } from '../entity';
import { InputComponent, VelocityComponent } from '../component';

/** 输入系统 - 将键盘输入写入 InputComponent 并更新 VelocityComponent */
export class InputSystem {
    private keyMap: Record<number, boolean> = {};

    constructor() {
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
    }

    private onKeyDown(event: EventKeyboard) {
        this.keyMap[event.keyCode] = true;
    }

    private onKeyUp(event: EventKeyboard) {
        this.keyMap[event.keyCode] = false;
    }

    update(entities: Entity[]) {
        for (const e of entities) {
            const inputCom = e.getComponent(InputComponent);
            const vel = e.getComponent(VelocityComponent);

            if (!inputCom || !vel) continue;

            inputCom.up = !!this.keyMap[KeyCode.KEY_W];
            inputCom.down = !!this.keyMap[KeyCode.KEY_S];
            inputCom.left = !!this.keyMap[KeyCode.KEY_A];
            inputCom.right = !!this.keyMap[KeyCode.KEY_D];

            vel.vx = (inputCom.right ? 200 : 0) - (inputCom.left ? 200 : 0);
            vel.vy = (inputCom.up ? 200 : 0) - (inputCom.down ? 200 : 0);
        }
    }
}
