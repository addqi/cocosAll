import type { IComponent } from '../ecsbase';

/** 输入组件 - 存储当前按键状态 */
export class InputComponent implements IComponent {
    up = false;
    down = false;
    left = false;
    right = false;
}
