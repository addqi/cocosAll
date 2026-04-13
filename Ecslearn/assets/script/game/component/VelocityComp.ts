import type { IComponent } from '../../baseSystem/ecs';

export class VelocityComp implements IComponent {
    vx = 0;
    vy = 0;
    /** 移动速度（像素/秒），由属性系统写入，PlayerControlSystem 读取 */
    speed = 200;
}