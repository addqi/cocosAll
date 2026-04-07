import type { Entity } from '../entity';
import { PositionComponent, VelocityComponent } from '../component';

/** 移动系统 - 根据速度更新位置 */
export class MovementSystem {
    update(entities: Entity[], dt: number) {
        for (const e of entities) {
            const pos = e.getComponent(PositionComponent);
            const vel = e.getComponent(VelocityComponent);

            if (!pos || !vel) continue;

            pos.x += vel.vx * dt;
            pos.y += vel.vy * dt;
        }
    }
}
