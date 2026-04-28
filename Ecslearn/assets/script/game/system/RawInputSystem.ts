import { input, Input, EventKeyboard, EventMouse } from 'cc';
import type { ISystem, Entity } from '../../baseSystem/ecs';
import { RawInputComp } from '../component';

/** 第①层：采集键盘 + 鼠标原始状态，写入 RawInputComp。全局唯一接触 cc.input 的地方 */
export class RawInputSystem implements ISystem {
    /**
     * 全局开关：是否禁用鼠标点击作为攻击输入（位置 mouseScreenX/Y 仍正常更新）。
     *
     * true 时：
     *   - mouseDown / mouseHeld / mouseUp 不再被本系统写入
     *   - VirtualInputPanel 直接写这些字段独占控制（虚拟攻击按钮成为唯一来源）
     *   - 用于 PC 调试虚拟按钮，避免鼠标点击和按钮点击双重触发
     */
    static disableMouseClick = false;

    private held      = new Map<number, boolean>();
    private frameDown = new Set<number>();
    private frameUp   = new Set<number>();
    private frameMouseDown = false;
    private frameMouseUp   = false;
    private mouseLeftHeld  = false;
    private mouseX = 0;
    private mouseY = 0;

    constructor() {
        input.on(Input.EventType.KEY_DOWN, (e: EventKeyboard) => {
            this.held.set(e.keyCode, true);
            this.frameDown.add(e.keyCode);
        });
        input.on(Input.EventType.KEY_UP, (e: EventKeyboard) => {
            this.held.set(e.keyCode, false);
            this.frameUp.add(e.keyCode);
        });
        input.on(Input.EventType.MOUSE_DOWN, (e: EventMouse) => {
            if (e.getButton() === EventMouse.BUTTON_LEFT) {
                this.frameMouseDown = true;
                this.mouseLeftHeld  = true;
            }
            this.mouseX = e.getLocationX();
            this.mouseY = e.getLocationY();
        });
        input.on(Input.EventType.MOUSE_UP, (e: EventMouse) => {
            if (e.getButton() === EventMouse.BUTTON_LEFT) {
                this.mouseLeftHeld = false;
                this.frameMouseUp  = true;
            }
        });
        input.on(Input.EventType.MOUSE_MOVE, (e: EventMouse) => {
            this.mouseX = e.getLocationX();
            this.mouseY = e.getLocationY();
        });
    }

    update(entities: Entity[]) {
        for (const e of entities) {
            const raw = e.getComponent(RawInputComp);
            if (!raw) continue;

            raw.keys.clear();
            for (const [k, v] of this.held) raw.keys.set(k, v);
            raw.down.clear();
            for (const k of this.frameDown) raw.down.add(k);
            raw.up.clear();
            for (const k of this.frameUp) raw.up.add(k);
            // 鼠标点击 → 攻击：默认走，但可被 disableMouseClick 关闭（让虚拟按钮独占）
            if (!RawInputSystem.disableMouseClick) {
                raw.mouseDown = this.frameMouseDown;
                raw.mouseHeld = this.mouseLeftHeld;
                raw.mouseUp   = this.frameMouseUp;
            }
            // 鼠标位置始终写入 —— 技能瞄准依赖
            raw.mouseScreenX = this.mouseX;
            raw.mouseScreenY = this.mouseY;
        }
        this.frameDown.clear();
        this.frameUp.clear();
        this.frameMouseDown = false;
        this.frameMouseUp   = false;
    }
}
