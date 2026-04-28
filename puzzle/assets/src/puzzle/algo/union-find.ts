/**
 * Union-Find（并查集）带路径压缩。纯函数，无状态。
 *
 * parents 数组由调用方持有；本模块只提供 find / union 操作。
 *
 * 不支持 disunion——并查集没这个操作。"组拆解" 通过全量重扫天然支持
 * （新建 parents 重跑 unionAll），见 merge-scan.ts。
 */

/**
 * 找根（带路径压缩）。
 * 走 parent 链直到自指；途中把每个节点直接挂到爷节点下，下次更扁。
 */
export function find(parents: number[], x: number): number {
    while (parents[x] !== x) {
        parents[x] = parents[parents[x]];
        x = parents[x];
    }
    return x;
}

/**
 * 合并两组。
 * @returns true = 这次真合了；false = 已同组（不计入新合并）
 */
export function union(parents: number[], a: number, b: number): boolean {
    const ra = find(parents, a);
    const rb = find(parents, b);
    if (ra === rb) return false;
    parents[ra] = rb;
    return true;
}
