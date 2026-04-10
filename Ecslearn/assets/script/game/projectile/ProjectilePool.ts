import { Node } from 'cc';

export class ProjectilePool {
    private static _pool: Node[] = [];
    private static _parent: Node | null = null;

    /** 由 GameLoop.onLoad 调用，传入 GameLoop 所在节点 */
    static init(parent: Node) {
        const layer = new Node('ProjectileLayer');
        parent.addChild(layer);
        this._parent = layer;
    }

    static acquire(): Node {
        const node = this._pool.pop() ?? new Node('Arrow');
        node.active = true;
        this._parent!.addChild(node);
        return node;
    }

    static release(node: Node) {
        if (!node.isValid) return;
        node.active = false;
        node.removeFromParent();
        this._pool.push(node);
    }

    static clear() {
        for (const n of this._pool) {
            if (n.isValid) n.destroy();
        }
        this._pool.length = 0;
    }
}
