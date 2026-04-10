import type { IComponent } from '../../baseSystem/ecs';

export class RawInputComp implements IComponent {
    /** 当前按住的键 */
    keys = new Map<number, boolean>();
    /** 本帧刚按下的键 */
    down = new Set<number>();
    /** 本帧刚抬起的键 */
    up   = new Set<number>();
    /** 本帧鼠标左键是否按下 */
    mouseDown = false;
}