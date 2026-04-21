import { Node, Prefab, Vec3, instantiate, RigidBody2D, Collider2D } from 'cc';
import { CoinEntity } from './CoinEntity';

const MAX_ACTIVE_COINS = 200;
const AUTO_COMPACT_BATCH = 20;

/**
 * 金币对象池
 *
 * 当前占位：复用 ArrowProjectile 的 prefab 作为视觉，实例化后禁用物理组件。
 * 正式金币图到位后只需把 `init(..., coinPrefab)` 换成新 prefab，其余代码不变。
 */
export class CoinPool {
    private static _prefab: Prefab | null = null;
    private static _parent: Node | null = null;
    private static _pool: Node[] = [];
    private static _active: CoinEntity[] = [];

    static init(parentRoot: Node, prefab: Prefab): void {
        if (this._parent) return;
        const layer = new Node('CoinLayer');
        parentRoot.addChild(layer);
        this._parent = layer;
        this._prefab = prefab;
    }

    static isReady(): boolean { return this._parent !== null && this._prefab !== null; }

    static spawn(worldPos: Readonly<Vec3>, amount: number): CoinEntity | null {
        if (!this._parent || !this._prefab) return null;
        if (amount <= 0) return null;

        if (this._active.length >= MAX_ACTIVE_COINS) {
            this._autoCompact();
        }

        const node = this._pool.pop() ?? this._createNode();
        node.active = true;
        this._parent.addChild(node);

        let coin = node.getComponent(CoinEntity);
        if (!coin) coin = node.addComponent(CoinEntity);
        coin.reset(worldPos, amount);
        this._active.push(coin);
        return coin;
    }

    static release(coin: CoinEntity): void {
        const idx = this._active.indexOf(coin);
        if (idx >= 0) this._active.splice(idx, 1);
        const node = coin.node;
        if (!node || !node.isValid) return;
        node.active = false;
        node.removeFromParent();
        this._pool.push(node);
    }

    static get active(): ReadonlyArray<CoinEntity> { return this._active; }

    static clearAll(): void {
        for (const c of this._active) {
            if (c.node?.isValid) c.node.destroy();
        }
        this._active.length = 0;
        for (const n of this._pool) {
            if (n.isValid) n.destroy();
        }
        this._pool.length = 0;
    }

    private static _createNode(): Node {
        const node = instantiate(this._prefab!);
        // 占位期：禁用箭矢 prefab 自带的物理组件
        this._stripPhysics(node);
        return node;
    }

    private static _stripPhysics(node: Node): void {
        const rb = node.getComponent(RigidBody2D);
        if (rb) rb.enabled = false;
        const cols = node.getComponents(Collider2D);
        for (const col of cols) col.enabled = false;
    }

    /** 场上物件超限时合并最老的一批，化整为零以防图形/内存爆炸 */
    private static _autoCompact(): void {
        const victims = this._active.slice(0, AUTO_COMPACT_BATCH);
        if (victims.length === 0) return;
        let total = 0;
        const last = victims[victims.length - 1];
        const pos = new Vec3(
            last.node.worldPosition.x,
            last.node.worldPosition.y,
            last.node.worldPosition.z,
        );
        for (const c of victims) {
            total += c.denomination;
            this.release(c);
        }
        this.spawn(pos, total);
    }
}
