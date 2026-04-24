import { KeyCode } from 'cc';
import type { ISystem, Entity } from '../../baseSystem/ecs';
import { RawInputComp, ActionComp, EAction } from '../component';

/** 键位映射表：物理按键 → 语义动作。改键位只改这张表 */
const KEYMAP: ReadonlyMap<number, EAction> = new Map([
    [KeyCode.KEY_W, EAction.MoveUp],
    [KeyCode.KEY_S, EAction.MoveDown],
    [KeyCode.KEY_A, EAction.MoveLeft],
    [KeyCode.KEY_D, EAction.MoveRight],
    [KeyCode.KEY_J, EAction.Attack],
    [KeyCode.SPACE, EAction.Dodge],
    [KeyCode.DIGIT_1, EAction.Skill1],
    [KeyCode.DIGIT_2, EAction.Skill2],
    [KeyCode.DIGIT_3, EAction.Skill3],
]);

/** 第②层：将原始按键翻译成语义动作 + 归一化移动方向 */
export class ActionMapSystem implements ISystem {
    update(entities: Entity[]) {
        for (const e of entities) {
            const raw = e.getComponent(RawInputComp);
            const act = e.getComponent(ActionComp);
            if (!raw || !act) continue;

            act.active.clear();
            act.justPressed.clear();
            act.justReleased.clear();

            for (const [key, action] of KEYMAP) {
                if (raw.keys.get(key)) act.active.add(action);
                if (raw.down.has(key)) act.justPressed.add(action);
                if (raw.up.has(key))   act.justReleased.add(action);
            }

            if (raw.mouseDown) act.justPressed.add(EAction.Attack);
            if (raw.mouseHeld) act.active.add(EAction.Attack);
            if (raw.mouseUp)   act.justReleased.add(EAction.Attack);

            // moveDir 优先级：键盘 WASD（数字 0/1，需归一化）；
            //                  键盘空闲时回退到虚拟摇杆（已是归一化连续值）
            const kbDx = (act.active.has(EAction.MoveRight) ? 1 : 0)
                       - (act.active.has(EAction.MoveLeft)  ? 1 : 0);
            const kbDy = (act.active.has(EAction.MoveUp)    ? 1 : 0)
                       - (act.active.has(EAction.MoveDown)  ? 1 : 0);
            if (kbDx !== 0 || kbDy !== 0) {
                const len = Math.sqrt(kbDx * kbDx + kbDy * kbDy) || 1;
                act.moveDir.x = kbDx / len;
                act.moveDir.y = kbDy / len;
            } else if (raw.virtualMoveActive) {
                act.moveDir.x = raw.virtualMoveX;
                act.moveDir.y = raw.virtualMoveY;
            } else {
                act.moveDir.x = 0;
                act.moveDir.y = 0;
            }
        }
    }
}
