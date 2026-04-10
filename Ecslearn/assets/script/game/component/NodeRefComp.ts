import type { Node } from 'cc';
import type { IComponent } from '../../baseSystem/ecs';

/** ECS ↔ Cocos 桥接：持有 Cocos 节点引用，供 MoveSyncSystem 同步位置 */
export class NodeRefComp implements IComponent {
    constructor(public readonly node: Node) {}
}
