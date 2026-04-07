import type { IComponent } from '../ecsbase';

/** 位置组件 */
export class PositionComponent implements IComponent {
    constructor(public x: number = 0, public y: number = 0) {}
}
