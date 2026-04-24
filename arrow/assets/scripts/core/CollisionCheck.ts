import { ArrowMoveMode, ArrowRuntime, deriveDirection } from "./ArrowState";
import { isInsideBoard } from "./Coord";
import { Cell } from "./LevelData";
export interface CollisionResult {
    /** 被撞的箭头 index，-1 表示没碰撞 */
    targetIdx: number;
    /** 碰撞点（头部抵达的格子），无碰撞时为 null */
    point: Cell | null;
}
/**
 * 判断箭头 shooterIdx 沿 coords 派生方向射出后，前方是否有"还挡路"的其他箭头。
 * 返回挡路箭头的 index，没挡返回 -1。
 *
 * "还挡路" = mode < Start。即 Idle / Collide / Back 状态的箭头挡路；
 * 已 Start 或 End 的箭头不挡路（和 G3_FBase `mode >= Start 不挡` 语义对齐）。
 * 依赖 ArrowMoveMode 的数值顺序，改枚举顺序会破坏这个判定。
 */
export function findCollision(
    shooterIdx: number,
    runtimes: readonly ArrowRuntime[],
    rows: number, cols: number,
): number {
    const shooter = runtimes[shooterIdx];
    if (!shooter || shooter.coords.length === 0) return -1;

    const direction = deriveDirection(shooter.coords);
    if (direction[0] === 0 && direction[1] === 0) return -1;

    const head = shooter.coords[shooter.coords.length - 1];
    let r = head[0], c = head[1];

    while (true) {
        r += direction[0];
        c += direction[1];
        if (!isInsideBoard(r, c, rows, cols)) return -1;

        for (let j = 0; j < runtimes.length; j++) {
            if (j === shooterIdx) continue;
            const rt = runtimes[j];
            if (rt.mode >= ArrowMoveMode.Start) continue;
            if (rt.coords.some(p => p[0] === r && p[1] === c)) {
                return j;
            }
        }
    }
}