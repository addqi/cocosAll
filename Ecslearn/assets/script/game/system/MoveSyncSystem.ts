import type { ISystem, Entity } from '../../baseSystem/ecs';
import { VelocityComp, NodeRefComp } from '../component';

/** 第④层：将 ECS 速度同步到 Cocos 节点位置 */
export class MoveSyncSystem implements ISystem {
    update(entities: Entity[], dt: number) {
        for (const e of entities) {
            const vel = e.getComponent(VelocityComp);
            const ref = e.getComponent(NodeRefComp);
            if (!vel || !ref) continue;

            const pos = ref.node.position;
            ref.node.setPosition(
                pos.x + vel.vx * dt,
                pos.y + vel.vy * dt,
                pos.z,
            );
        }
    }
}
