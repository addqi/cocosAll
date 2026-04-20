import { RedDotNode, RedDotListener } from './RedDotNode';

export class RedDotManager {
    private static _instance: RedDotManager | null = null;
    static get instance(): RedDotManager {
        if (!this._instance) this._instance = new RedDotManager();
        return this._instance;
    }

    /** 所有节点的扁平映射：path → node。便于 O(1) 查找。 */
    private _nodes: Map<string, RedDotNode> = new Map();

    register(path: string): RedDotNode {
        let node = this._nodes.get(path);
        if (node) return node;

        node = new RedDotNode(path);
        this._nodes.set(path, node);

        const parentPath = this._parentPath(path);
        if (parentPath !== null) {
            const parent = this.register(parentPath);  // ← 递归：父节点不在就自动建
            node.parent = parent;
            parent.children.set(node.segmentKey, node);
        }
        return node;
    }
    /** 获取父路径 */
    private _parentPath(path: string): string | null {
        const i = path.lastIndexOf('.');
        return i < 0 ? null : path.substring(0, i);
    }

    /** 获取某个节点的总红点数 */
    getTotalCount(path: string): number {
        return this._nodes.get(path)?.totalCount ?? 0;
    }
    /** 设置某个节点的自红点数 */
    setSelfCount(path: string, count: number): void {
        const node = this.register(path);
        const c = Math.max(0, Math.floor(count));
        if (node.selfCount === c) return;  // 值没变就彻底不动
        node.selfCount = c;
        this._bubble(node);  // 自动冒泡到根
    }
    /** 从 startNode 开始向上冒泡，重算每层 totalCount 并派发。 */
    private _bubble(startNode: RedDotNode): void {
        let node: RedDotNode | null = startNode;
        while (node) {
            const oldTotal = node.totalCount;
            let sum = node.selfCount;

            node.children.forEach(ch => {
                sum += ch.totalCount;
            })
            if (sum === oldTotal) return;

            node.totalCount = sum;

            node.listeners.forEach(cb => cb(sum));

            node = node.parent;

        }


    }

    /** 订阅某个路径的 totalCount 变化。返回反订阅函数。 */
    subscribe(path: string, cb: RedDotListener): () => void {
        const node = this.register(path);
        node.listeners.add(cb);
        cb(node.totalCount);                        // 立即派发一次初始值
        return () => node.listeners.delete(cb);
    }
    /** 仅用于测试：清空所有节点 */
    _resetForTest(): void {
        this._nodes.clear();
    }
}