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

            for (const [key, action] of KEYMAP) {
                if (raw.keys.get(key)) act.active.add(action);
                if (raw.down.has(key)) act.justPressed.add(action);
            }

            if (raw.mouseDown) act.justPressed.add(EAction.Attack);

            const dx = (act.active.has(EAction.MoveRight) ? 1 : 0)
                      - (act.active.has(EAction.MoveLeft)  ? 1 : 0);
            const dy = (act.active.has(EAction.MoveUp)     ? 1 : 0)
                      - (act.active.has(EAction.MoveDown)  ? 1 : 0);
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            act.moveDir.x = dx / len;
            act.moveDir.y = dy / len;
        }
    }
}
