import type { PieceLite } from './merge-scan';

/**
 * borderMask 推导。纯函数，无引擎依赖。
 *
 * 编码（与 puzzle-piece.effect 的 fs 解码对应）：
 *   bit0=上, bit1=右, bit2=下, bit3=左
 *   mask=1 该方向需要画边框（无同组邻居）
 *   mask=0 已合并、不画边框
 *
 * 复杂度：N × 4 个邻居判断 = O(4N)。N=100 时 400 次比较，< 1ms 忽略不计。
 *
 * 派生意味着不储存真相——和 position 同性质。每次重扫，不增量。
 */

const TOP = 1, RIGHT = 2, BOTTOM = 4, LEFT = 8;

/**
 * 全量计算所有 pid 的 borderMask。
 *
 * 内部一次性建 `pidToSlot` 反向索引——避免对每个 pid 走 slots.indexOf(pid)
 * 这条 O(N) 反查。N=100 时差距 100x（10000 次 → 100 次 + 4N 邻居访问）。
 *
 * @returns 长度 = pieces.length 的 mask 数组，索引为 pid
 */
export function recalcBorderMasks(
    slots: number[],
    pieces: readonly PieceLite[],
    pieceGrid: number,
): number[] {
    const pieceCount = slots.length;
    const masks: number[] = new Array(pieceCount);

    const pidToSlot: number[] = new Array(pieceCount);
    for (let s = 0; s < pieceCount; s++) pidToSlot[slots[s]] = s;

    for (let pid = 0; pid < pieceCount; pid++) {
        const piece = pieces[pid];
        const slotIdx = pidToSlot[pid];
        const sr = Math.floor(slotIdx / pieceGrid);
        const sc = slotIdx % pieceGrid;
        const r = piece.row;
        const c = piece.col;
        const myGroup = piece.groupId;

        let mask = 0xf;

        // 上邻：屏幕上方对应 sr-1。槽里那块的"原始 row/col" 应是 (r-1, c)。
        if (sr > 0) {
            const np = pieces[slots[(sr - 1) * pieceGrid + sc]];
            if (np.groupId === myGroup && np.row === r - 1 && np.col === c) mask &= ~TOP;
        }
        if (sc + 1 < pieceGrid) {
            const np = pieces[slots[sr * pieceGrid + sc + 1]];
            if (np.groupId === myGroup && np.row === r && np.col === c + 1) mask &= ~RIGHT;
        }
        if (sr + 1 < pieceGrid) {
            const np = pieces[slots[(sr + 1) * pieceGrid + sc]];
            if (np.groupId === myGroup && np.row === r + 1 && np.col === c) mask &= ~BOTTOM;
        }
        if (sc > 0) {
            const np = pieces[slots[sr * pieceGrid + sc - 1]];
            if (np.groupId === myGroup && np.row === r && np.col === c - 1) mask &= ~LEFT;
        }

        masks[pid] = mask;
    }

    return masks;
}
