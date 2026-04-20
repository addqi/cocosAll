export type RedDotListener = (totalCount: number) => void;

/**
 * 红点树节点。纯数据，不包含任何算法逻辑（算法在 RedDotManager 里）。
 * 设计原则：只负责"存"，不负责"算"。
 */
export class RedDotNode {
    readonly path: string;
    parent: RedDotNode | null = null;
    readonly children: Map<string, RedDotNode> = new Map();

    selfCount: number = 0;
    totalCount: number = 0;

    readonly listeners: Set<RedDotListener> = new Set();

    constructor(path: string) {
        this.path = path;
    }

    /** path 的最后一段，用作 parent.children 的 key */
    get segmentKey(): string {
        const i = this.path.lastIndexOf('.');
        return i < 0 ? this.path : this.path.substring(i + 1);
    }
}