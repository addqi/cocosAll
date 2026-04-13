import { Vec3, Node } from 'cc';
import { EPropertyId } from '../../config/enum/propertyEnum';
import type { EnemyProperty } from '../EnemyProperty';

export class EnemyMovement {
    constructor(
        private readonly _node: Node,
        private readonly _body: Node,
        private readonly _prop: EnemyProperty,
    ) {}

    moveToward(target: Readonly<Vec3>, dt: number): void {
        const wPos = this._node.worldPosition;
        const dx = target.x - wPos.x;
        const dy = target.y - wPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) return;

        const speed = this._prop.getValue(EPropertyId.MoveSpeed);
        const step = Math.min(speed * dt, dist);
        const nx = dx / dist;
        const ny = dy / dist;

        const lPos = this._node.position;
        this._node.setPosition(lPos.x + nx * step, lPos.y + ny * step, lPos.z);

        if (dx !== 0) {
            this._body.setScale(dx < 0 ? -1 : 1, 1, 1);
        }
    }

    faceTarget(target: Node): void {
        const dx = target.worldPosition.x - this._node.worldPosition.x;
        if (dx !== 0) this._body.setScale(dx < 0 ? -1 : 1, 1, 1);
    }

    distTo(target: Node): number {
        return Vec3.distance(this._node.worldPosition, target.worldPosition);
    }
}
