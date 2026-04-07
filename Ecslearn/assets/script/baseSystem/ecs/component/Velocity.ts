import type { IComponent } from '../ecsbase';

/** 速度组件 */
export class VelocityComponent implements IComponent {
    constructor(public vx: number = 0, public vy: number = 0) {}
}
