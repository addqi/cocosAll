import { Node, Sorting2D } from 'cc';

/**
 * 拖动期间的层级控制——**仅在拖动窗口内启用 Sorting2D，触摸结束立即拆除**。
 *
 * 核心反常识：在本项目（08 路径，共享 puzzle-piece.effect 自定义 shader）下，
 * **数值越小的 priority 反而画在最上层**——与 cocos 文档约定相反。
 * 推测原因：puzzle-piece.effect 用 `blend: true` + `cullMode: none`，sprite 被归入
 * 3D transparent queue，该 queue 通常按 painter's algorithm（远→近）画，
 * 实现上反映为"低 priority 后画 → 在最上"。
 *
 * 设计：**生命周期边界化** —— Sorting2D 只在拖动开始时按需 addComponent，
 * 拖动结束（commit / snap-back）后 removeComponent。这样有几个好处：
 *
 *   1. 非拖动期间，piece 节点没 Sorting2D → 走默认 walk-order → 弹窗等
 *      后挂的兄弟节点天然画在 piece 之上（修复"胜利弹窗被拼图压在底下"bug）
 *   2. 反向 priority 这层泥泞知识只在 setDragLayering 内部有效，
 *      泄漏面 = 0
 *   3. 01 路径（无 shader）下完全跳过——不需要 Sorting2D，walk-order 已经够
 *
 * 失败的多次尝试（删除前留证据，给未来踩同样坑的人）：
 *   - 试验1: 强制走 01 路径（pieceMaterial=null）→ 视觉正常 → 锁定问题在 shader 路径
 *   - 试验2: 单 layer + setSiblingIndex → 改了 children 数组没改 chunk vid → 无效
 *   - 试验3: 双 layer + reparent 到 DragLayer → chunk 物理位置不变 → 无效
 *   - 试验4: Sorting2D 全程开 + 拖动组 +1000+pid（高 priority）→ 结果 dragged 在底
 *   - 试验5: Sorting2D 全程开 + 拖动组 -1000-pid（极低 priority）→ 视觉正确
 *           但**留下副作用**：所有 piece 永远在 Sorting2D 排序中，
 *           导致后挂的非 Sorting2D 弹窗节点被压在 piece 下面
 *   - 试验6（当前）: Sorting2D 仅在拖动窗口内存在 → 修复试验 5 的副作用
 *
 * 未来如果换 effect / 升 cocos 版本，**先把 -1000 / +1000 反过来验证一次**——
 * 如果新版本/新 shader 让 sort 方向回归正向，应该改回去保持代码符合直觉。
 */

/** 拖动组的极小 priority——< 0 - max_pid（即使 31×31=961 块仍安全）。 */
const DRAG_GROUP_TOP = -1000;
/** 非拖动组的极大 priority——同上一道安全线，但反方向。 */
const NON_DRAG_BOTTOM = 1000;

/**
 * 拖动开始时调：拖动组 → 顶层，其余所有 piece → 底层。
 *
 * 仅 shader 路径（useShader=true）执行。01 路径下 piece 用默认 sprite material，
 * walk-order 已能正确分层，加 Sorting2D 反而引入额外 sort 路径。
 *
 * 调用前不假设节点上有 Sorting2D；调用后保证有，可重复调用安全。
 */
export function setDragLayering(
    nodes: readonly Node[],
    dragGroupPids: readonly number[],
    useShader: boolean,
): void {
    if (!useShader) return;

    const isDragged = new Set(dragGroupPids);
    for (let pid = 0; pid < nodes.length; pid++) {
        const node = nodes[pid];
        let sorting = node.getComponent(Sorting2D);
        if (!sorting) sorting = node.addComponent(Sorting2D);
        sorting.sortingOrder = isDragged.has(pid)
            ? DRAG_GROUP_TOP - pid       // 顶层：极小（反向逻辑）
            : NON_DRAG_BOTTOM + pid;     // 底层：极大（反向逻辑）
    }
}

/**
 * 触摸结束（commit / snap-back 缓动完成）后调：摘除所有 piece 的 Sorting2D。
 *
 * 摘干净后，节点回到默认 walk-order 排序——这是关键：
 * **后挂的同级节点（如胜利弹窗）会按兄弟顺序天然画在 piece 之上**。
 * 不摘的话，piece 的 Sorting2D priority（即使 reset 到 0）仍参与全局排序，
 * 把无 Sorting2D 的弹窗压到底下——见试验 5 注释。
 *
 * 没有 Sorting2D 的节点（01 路径下从来没加过）也是 no-op，安全。
 */
export function clearDragLayering(nodes: readonly Node[]): void {
    for (const node of nodes) {
        const s = node.getComponent(Sorting2D);
        if (s) node.removeComponent(s);
    }
}
