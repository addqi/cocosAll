/**
 * 槽位 ↔ 坐标双向投影。纯函数，无引擎依赖。
 *
 * Board-local 坐标系：Board 中心 = (0, 0)，y 朝上、x 朝右。
 * 中心槽对应 (0, 0)。
 */

export interface Position {
    x: number;
    y: number;
}

/** 槽位下标 → Board-local (x, y)。中心槽对应 (0, 0)。 */
export function slotToPosition(
    slotIdx: number,
    pieceGrid: number,
    pieceDisplay: number,
): Position {
    const sr = Math.floor(slotIdx / pieceGrid);
    const sc = slotIdx % pieceGrid;
    const center = (pieceGrid - 1) / 2;
    return {
        x: (sc - center) * pieceDisplay,
        y: (center - sr) * pieceDisplay,
    };
}

/**
 * Board-local 坐标 → 槽位下标。越界返回 -1。
 *
 * 用 round 而不是 floor —— 块的 anchor 在中心，块中心稍微偏移时按"四舍五入到最近格"
 * 比"向左下取整"对玩家更宽容。
 */
export function pointerToSlot(
    boardLocalX: number,
    boardLocalY: number,
    pieceGrid: number,
    pieceDisplay: number,
): number {
    const center = (pieceGrid - 1) / 2;
    const sc = Math.round(boardLocalX / pieceDisplay + center);
    const sr = Math.round(center - boardLocalY / pieceDisplay);
    if (sr < 0 || sr >= pieceGrid || sc < 0 || sc >= pieceGrid) return -1;
    return sr * pieceGrid + sc;
}
