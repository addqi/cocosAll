import { _decorator, Component, Vec2 } from 'cc';
import { FlowFieldMgr } from './FlowFieldMgr';
const { ccclass } = _decorator;

@ccclass('Enemy')
export class Enemy extends Component {

    speed = 150;

    update(dt: number) {
        const mgr = FlowFieldMgr.Instance;
        if (!mgr || !mgr.enemyCanMove) return;

        const pos = this.node.position.clone() as any;
        const dir = mgr.getDirectionByWorldPos(pos);

        if (dir.equals(Vec2.ZERO)) return;

        this.node.setPosition(
            this.node.position.x + dir.x * this.speed * dt,
            this.node.position.y + dir.y * this.speed * dt
        );
    }
}
