import { Node, Prefab, instantiate } from 'cc';

export class ProjectilePool {
    private static _pool: Node[] = [];
    private static _parent: Node | null = null;
    private static _prefab: Prefab | null = null;

    /** 由 GameLoop.onLoad 调用 */
    static init(parent: Node, prefab?: Prefab) {
        const layer = new Node('ProjectileLayer');
        parent.addChild(layer);
        this._parent = layer;
        this._prefab = prefab ?? null;
    }

    static acquire(): Node {
        let node = this._pool.pop();
        if (!node) {
            if (!this._prefab) {
                console.error('[ProjectilePool] prefab 未设置，无法创建弹射物');
                return new Node('Arrow_ERROR');
            }
            node = instantiate(this._prefab);
        }
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
