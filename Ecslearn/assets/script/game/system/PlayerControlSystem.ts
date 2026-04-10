import type { ISystem, Entity } from '../../baseSystem/ecs';
import { ActionComp, VelocityComp } from '../component';

/** 第③层：将语义动作转为实际速度。后续接 PlayerProperty 读 MoveSpeed */
export class PlayerControlSystem implements ISystem {
    update(entities: Entity[]) {
        for (const e of entities) {
            const act = e.getComponent(ActionComp);
            const vel = e.getComponent(VelocityComp);
            if (!act || !vel) continue;

            const speed = 200;
            vel.vx = act.moveDir.x * speed;
            vel.vy = act.moveDir.y * speed;
        }
    }
}
