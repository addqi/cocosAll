import type { IComponent } from '../../baseSystem/ecs';

export class RawInputComp implements IComponent {
    /** 当前按住的键 */
    keys = new Map<number, boolean>();
    /** 本帧刚按下的键 */
    down = new Set<number>();
    /** 本帧刚抬起的键 */
    up   = new Set<number>();
    /** 本帧鼠标左键是否按下（单帧脉冲） */
    mouseDown = false;
    /** 鼠标左键是否持续按住 */
    mouseHeld = false;
    /** 本帧鼠标左键是否刚抬起（单帧脉冲）*/
    mouseUp = false;
    /** 鼠标屏幕坐标 X（像素，左下角 0） */
    mouseScreenX = 0;
    /** 鼠标屏幕坐标 Y（像素，左下角 0） */
    mouseScreenY = 0;

    // ─── 虚拟摇杆输入（手机虚拟手柄 / 调试） ─────────────
    // ActionMapSystem 当键盘 WASD 都未按时回退到这里。
    /** 摇杆 X 分量，归一化 [-1, 1] */
    virtualMoveX = 0;
    /** 摇杆 Y 分量，归一化 [-1, 1] */
    virtualMoveY = 0;
    /** 是否正在被摇杆按住（决定 ActionMapSystem 是否回退到 virtualMove*）*/
    virtualMoveActive = false;
}