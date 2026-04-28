import { find, union } from './union-find';

/**
 * 合并扫描（Rule B：邻接判定）。纯函数，无引擎依赖。
 *
 * Rule B：只看相对位置正确，不看绝对位置——商业拼图标准玩法。
 *   两块同组的条件：在屏幕上彼此相邻，且它们在源图上的 row/col 也相邻。
 *
 * 关键设计：parents 每次调用内重建——"组拆解"通过全量重扫天然支持。
 *
 * 派生意味着不储存真相——和 position 同性质。每次重扫，不增量。
 */

/** algo 层用的 piece 视图——只读 row/col/groupId，不耦合 cocos 组件类型。 */
export interface PieceLite {
    row: number;
    col: number;
    groupId: number;
}

export interface MergeScanResult {
    /** 写回后的 groupId 数组，索引为 pid */
    newGroupIds: number[];
    /** 本轮组数有否减少（=新合并发生）。用于"叮"音效或动画触发。 */
    mergedAny: boolean;
    /** 全部块属于同一组——胜利状态判定。 */
    allInOneGroup: boolean;
}

/**
 * 全量扫描合并。
 *
 * @param slots 槽位 → pid 数组（slots[j] = 第 j 个槽位放着的 pid）
 * @param pieces pid → PieceLite 数组（pieces[pid].row/col/groupId）
 * @param pieceGrid 每边切几块
 *
 * @returns mergedAny **新增**了合并关系才 true（不是"本轮 union 操作 > 0"——
 *                    后者每轮都重置 parents，已合的会反复 union 永远 true）。
 *                    通过对比"上次"和"本轮"的组数判定。
 * @returns allInOneGroup 所有块属于同一组（== 胜利状态）
 */
export function mergeScan(
    slots: number[],
    pieces: readonly PieceLite[],
    pieceGrid: number,
): MergeScanResult {
    const pieceCount = slots.length;

    // 拍一个"上次"的 groupId 集合——后面对比用。
    const prevRoots = new Set<number>();
    for (let pid = 0; pid < pieceCount; pid++) prevRoots.add(pieces[pid].groupId);

    const parents: number[] = [];
    for (let pid = 0; pid < pieceCount; pid++) parents.push(pid);

    for (let sr = 0; sr < pieceGrid; sr++) {
        for (let sc = 0; sc < pieceGrid; sc++) {
            const idx = sr * pieceGrid + sc;
            const pid = slots[idx];
            const piece = pieces[pid];

            // 右邻：邻居的"正确 row/col"应该是 (piece.row, piece.col + 1)
            if (sc + 1 < pieceGrid) {
                const rPid = slots[idx + 1];
                const rPiece = pieces[rPid];
                if (rPiece.row === piece.row && rPiece.col === piece.col + 1) {
                    union(parents, pid, rPid);
                }
            }

            // 下邻：邻居的"正确 row/col"应该是 (piece.row + 1, piece.col)
            if (sr + 1 < pieceGrid) {
                const dPid = slots[idx + pieceGrid];
                const dPiece = pieces[dPid];
                if (dPiece.row === piece.row + 1 && dPiece.col === piece.col) {
                    union(parents, pid, dPid);
                }
            }
        }
    }

    const newGroupIds: number[] = new Array(pieceCount);
    const roots = new Set<number>();
    for (let pid = 0; pid < pieceCount; pid++) {
        const r = find(parents, pid);
        newGroupIds[pid] = r;
        roots.add(r);
    }

    return {
        newGroupIds,
        mergedAny: roots.size < prevRoots.size,
        allInOneGroup: roots.size === 1,
    };
}
