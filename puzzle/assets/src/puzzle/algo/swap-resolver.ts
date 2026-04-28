/**
 * 整组搬运 swap 解算。纯函数，无引擎依赖。
 *
 * 数据驱动铁律：**先全部读 → 全部算 → 全部写**——不能写 newSlots 中途又读 newSlots。
 * 否则被挤者填到空槽时会读到组员（组员先被写入 newSlots[displaceFrom[i]]）。
 *
 * 集合差消除特殊情况：自动消掉重叠部分，|displaceFrom| === |fillTo| 是数学保证。
 * 不需要 if/else 判断 "是否单块组 / 是否完全平移 / 是否邻位 swap"。
 */

export interface SwapInput {
    slots: number[];
    /** 整组的 pid 列表（含 anchor） */
    groupPids: number[];
    /** 拖动锚点的 pid */
    anchorPid: number;
    /** 拖动锚点的目标槽位（由 pointerToSlot 算出，调用方负责） */
    anchorDstSlot: number;
    pieceGrid: number;
}

export interface SwapResult {
    /** false = 越界，调用方应弹回原位 */
    valid: boolean;
    /** 写完后的新 slots（仅 valid=true 有意义） */
    newSlots: number[];
    /** 被挤的 pid 列表（valid=true） */
    displacedPids: number[];
    /** dRow/dCol——给日志或调试用 */
    dRow: number;
    dCol: number;
}

/**
 * 解算整组搬运。
 *
 * 流程：
 *   1. 算偏移（dRow/dCol，基于锚块的源/目标槽）
 *   2. 越界检查（任何组员目标超出 0..pieceGrid → 返回 valid=false）
 *   3. 集合差：displaceFrom = dst \ src（被挤的非组员槽）
 *              fillTo       = src \ dst（空出的槽）
 *   4. 写新 slots：组员到目标 → 被挤者从 OLD slots 读出来填回 fillTo
 */
export function resolveSwap(input: SwapInput): SwapResult {
    const { slots, groupPids, anchorPid, anchorDstSlot, pieceGrid } = input;

    // 一次性建 pidToSlot 反向索引——避免每个 pid 走 slots.indexOf 的 O(N)。
    const pidToSlot: number[] = new Array(slots.length);
    for (let s = 0; s < slots.length; s++) pidToSlot[slots[s]] = s;

    const anchorSrcSlot = pidToSlot[anchorPid];
    const dRow = Math.floor(anchorDstSlot / pieceGrid) - Math.floor(anchorSrcSlot / pieceGrid);
    const dCol = (anchorDstSlot % pieceGrid) - (anchorSrcSlot % pieceGrid);

    const srcSlots: number[] = [];
    const dstSlots: number[] = [];
    for (const pid of groupPids) {
        const srcSlot = pidToSlot[pid];
        const srcRow = Math.floor(srcSlot / pieceGrid);
        const srcCol = srcSlot % pieceGrid;
        const dstRow = srcRow + dRow;
        const dstCol = srcCol + dCol;
        if (dstRow < 0 || dstRow >= pieceGrid || dstCol < 0 || dstCol >= pieceGrid) {
            return { valid: false, newSlots: [], displacedPids: [], dRow, dCol };
        }
        srcSlots.push(srcSlot);
        dstSlots.push(dstRow * pieceGrid + dstCol);
    }

    // 集合差。不用 includes（ES2016）—— indexOf 等价、ES5 lib 也能跑。
    const displaceFrom = dstSlots.filter(s => srcSlots.indexOf(s) === -1);
    const fillTo = srcSlots.filter(s => dstSlots.indexOf(s) === -1);

    const newSlots = slots.slice();
    for (let i = 0; i < groupPids.length; i++) {
        newSlots[dstSlots[i]] = groupPids[i];
    }
    const displacedPids: number[] = [];
    for (let i = 0; i < displaceFrom.length; i++) {
        const dPid = slots[displaceFrom[i]]; // ← 必须从 OLD slots 读
        newSlots[fillTo[i]] = dPid;
        displacedPids.push(dPid);
    }

    return { valid: true, newSlots, displacedPids, dRow, dCol };
}
