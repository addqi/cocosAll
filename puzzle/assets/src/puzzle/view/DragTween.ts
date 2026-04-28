import { Node, tween, Vec3 } from 'cc';
import { slotToPosition } from '../algo/layout';

/**
 * 整组 / 弹回 共用的缓动器。
 *
 * **两条路径完全等价**——commit 与 snap-back 唯一区别是 slots 状态：
 *   commit：调用前 slots 已写入新位置 → tween 到目标
 *   snap-back：slots 不动 → tween 回原位
 * 因此一个函数搞定，不用拆 commitTween/snapBackTween 两份对偶代码。
 *
 * timer tween 用 owner（PuzzleBoard 本节点）当事件总线——最稳的生命周期。
 * 不挂在某个 piece 上：piece 缓动期间被异常 destroy 时回调会丢；不用 setTimeout：
 * setTimeout 不绑节点生命周期、节点销毁后还跑，回调访问销毁节点 → crash。
 */
export interface PieceTweenOptions {
    /** pid → Node */
    nodes: readonly Node[];
    /** timer tween 挂的节点（建议 PuzzleBoard 本身） */
    timerNode: Node;
    duration: number;
    /** 这次要动的 pid 列表（commit 时是 group + displaced，snap-back 时是 group） */
    pids: readonly number[];
    /** 当前 slots（commit 调用前已是新值；snap-back 是旧值） */
    slots: readonly number[];
    pieceGrid: number;
    pieceDisplay: number;
    /** duration 后唯一一次回调。**调用方**负责锁释放 / mergeScan / 复位 priority。 */
    onComplete: () => void;
}

export function tweenPiecesToSlots(opts: PieceTweenOptions): void {
    const { nodes, timerNode, duration, pids, slots, pieceGrid, pieceDisplay, onComplete } = opts;

    // 一次性建 pidToSlot 反向索引——避免每个 pid 走 slots.indexOf 的 O(N)。
    const pidToSlot: number[] = new Array(slots.length);
    for (let s = 0; s < slots.length; s++) pidToSlot[slots[s]] = s;

    for (const pid of pids) {
        const slot = pidToSlot[pid];
        const { x, y } = slotToPosition(slot, pieceGrid, pieceDisplay);
        tween(nodes[pid])
            .to(duration, { position: new Vec3(x, y, 0) })
            .start();
    }
    tween(timerNode).delay(duration).call(onComplete).start();
}
