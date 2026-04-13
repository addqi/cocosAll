import type { ISystem, Entity } from '../../baseSystem/ecs';
import { ActionComp, VelocityComp } from '../component';

/** 第③层：将语义动作转为实际速度，速度值来自 VelocityComp.speed（由属性系统写入） */
export class PlayerControlSystem implements ISystem {
    update(entities: Entity[]) {
        for (const e of entities) {
            const act = e.getComponent(ActionComp);
            const vel = e.getComponent(VelocityComp);
            if (!act || !vel) continue;

            vel.vx = act.moveDir.x * vel.speed;
            vel.vy = act.moveDir.y * vel.speed;
        }
    }
}
