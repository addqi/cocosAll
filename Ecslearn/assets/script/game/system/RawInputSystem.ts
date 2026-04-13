import { input, Input, EventKeyboard, EventMouse } from 'cc';
import type { ISystem, Entity } from '../../baseSystem/ecs';
import { RawInputComp } from '../component';

/** 第①层：采集键盘 + 鼠标原始状态，写入 RawInputComp。全局唯一接触 cc.input 的地方 */
export class RawInputSystem implements ISystem {
    private held      = new Map<number, boolean>();
    private frameDown = new Set<number>();
    private frameUp   = new Set<number>();
    private frameMouseDown = false;
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

            raw.keys = new Map(this.held);
            raw.down = new Set(this.frameDown);
            raw.up   = new Set(this.frameUp);
            raw.mouseDown = this.frameMouseDown;
            raw.mouseHeld = this.mouseLeftHeld;
            raw.mouseScreenX = this.mouseX;
            raw.mouseScreenY = this.mouseY;
        }
        this.frameDown.clear();
        this.frameUp.clear();
        this.frameMouseDown = false;
    }
}
