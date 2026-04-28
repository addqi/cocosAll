import {
    _decorator, Component, EventTouch, Material, Node, Sprite, SpriteFrame, Tween,
} from 'cc';
import { PuzzlePiece } from './PuzzlePiece';

import { shuffleSlots } from './algo/shuffle';
import { mergeScan, type PieceLite } from './algo/merge-scan';
import { recalcBorderMasks } from './algo/border-mask';
import { resolveSwap } from './algo/swap-resolver';
import { pointerToSlot, slotToPosition } from './algo/layout';

import { createPieces } from './view/PieceFactory';
import { applyPieceColors } from './view/PieceColor';
import { setDragLayering, clearDragLayering } from './view/DragSorter';
import { tweenPiecesToSlots } from './view/DragTween';

import { dumpBoard } from './debug/BoardDump';

const { ccclass } = _decorator;

/**
 * 拼图主控（教程 01-08 节累计版本）。
 *
 * 这个文件**只负责**：
 *   - 字段（GamePage 注入项 + 调参）
 *   - 状态机（_victorious / _inputLocked）
 *   - 事务编排（render / touchStart-Move-End / commitAfterTween）
 *
 * 切片、洗牌、合并扫描、边框推导、整组搬运解算、缓动、调试输出——全在子模块里。
 *
 * 渲染双路径（08 节，向后兼容铁律）：
 *   - pieceMaterial == null：01 节切片路径——无 shader 但功能完整
 *   - pieceMaterial != null：08 节共享路径——shader 自绘 + 真合批
 *   见 view/PieceFactory.ts 详细文档。
 *
 * 数据真相源：
 *   _slots[j] = pieceId       槽位 j 当前放着哪块
 *   _pieceNodes[pid] = Node   pid → Node 的 O(1) 索引
 *   piece.groupId             同 groupId 的属于同一组——派生自 mergeScan
 *
 * **Position 永远是 slots 的投影**，groupId 永远是 mergeScan 的投影。
 * 派生的不存真相——派生意味着每次重扫，不增量。
 *
 * 事务模型（06/07 节合体）：
 *   BEGIN：onPieceTouchStart  → setDragLayering（拖动组进顶 / 其余进底，仅 shader 路径）
 *   WORK： onPieceTouchMove   → 整组按 UIDelta 同步移动（不动 slots）
 *   COMMIT：onPieceTouchEnd   → resolveSwap → 写 slots → tweenPiecesToSlots
 *           → commitAfterTween → clearDragLayering + mergeScan + 胜利判定
 *
 * 拖动层级**生命周期边界化**：Sorting2D 仅在拖动窗口内存在——非拖动期间
 * piece 节点没 Sorting2D，胜利弹窗 / 难度确认窗等后挂兄弟节点天然画在最上层。
 * 反向 priority 逻辑及试验记录见 view/DragSorter.ts 顶部。
 *
 * 用 start() 不用 onLoad()——后者在 addComponent() 同步触发，
 * GamePage 流程是 "addComponent → 赋值 sourceImage"，onLoad 时字段还是 null。
 */
@ccclass('PuzzleBoard')
export class PuzzleBoard extends Component {

    // ────── GamePage 注入项 ──────
    // 整个 PuzzleBoard 是 runtime 通过 addComponent 创建的，不是场景脚本，
    // 因此**没有 @property 装饰器**——Inspector 不会显示，写也是噪音。

    sourceImage: SpriteFrame | null = null;
    boardSize: number = 800;
    pieceGrid: number = 3;
    /** null 时走 01 节切片 fallback——见 view/PieceFactory.ts。 */
    pieceMaterial: Material | null = null;

    // ────── 内部调参 ──────

    /** 洗牌散度阈值——见 algo/shuffle.ts。 */
    scatterRatio: number = 0.7;
    maxShuffleAttempts: number = 100;
    /** 单次缓动时长（秒）——commit / snap-back 共用。 */
    tweenDuration: number = 0.2;

    get pieceCount(): number {
        return this.pieceGrid * this.pieceGrid;
    }

    get pieceDisplay(): number {
        return this.boardSize / this.pieceGrid;
    }

    /* ───────────────────── 状态字段 ───────────────────── */

    private _slots: number[] = [];
    private _pieceNodes: Node[] = [];
    /** Sprite 引用——applyPieceColors 用。01 路径下也填，O(N) 内存可忽略。 */
    private _pieceSprites: Sprite[] = [];
    private _rendered = false;

    /** 派生自 mergeScan 的 allInOneGroup。一旦 true 就锁死，restart() 才能重置。 */
    private _victorious: boolean = false;

    /** 缓动锁——swap 提交期间禁止再拖。tween 末尾的 commit 阶段自动清。 */
    private _inputLocked: boolean = false;

    /**
     * 当前拖动组的 pid 列表（含 anchor）。touchStart 算一次后缓存，
     * touchMove 直接遍历它，免去每帧 N 次 getComponent。
     *
     * 生命周期：
     *   touchStart  → 写入（_collectGroupPids 结果）
     *   touchMove   → 读
     *   touchEnd    → 复用（不重新 _collectGroupPids，groupId 在 drag 期间不变）
     *   commit/snap-back 缓动结束 → 清 null
     *
     * null 时不可拖（防御：touchMove/End 在没经过 touchStart 时早退）。
     */
    private _dragPids: number[] | null = null;

    /** 计时（毫秒）。每次 render() 重置。胜利时 GamePage 自取 elapsed。 */
    private _startTime: number = 0;

    /** 胜利回调。GamePage 在 startLevel 后挂上去。 */
    onWin: ((elapsedMs: number) => void) | null = null;

    /* ───────────────────── 生命周期 ───────────────────── */

    start(): void {
        if (this.sourceImage && !this._rendered) {
            this.render();
        }
    }

    /**
     * 节点销毁时（GamePage.cleanup → boardRoot.removeAllChildren）调。
     *
     * tween 不会随节点 destroy 自动停——它在 schedulingManager 里。
     * 必须显式 stopAllByTarget，否则 0.2s 后 commitAfterTween 回调访问已销毁的
     * _pieceNodes → 崩或静默 bug（onWin 在场景已切走后被触发）。
     *
     * 事件监听器（TOUCH_*）随节点 destroy 由 cocos 自动清理，不需要显式 off。
     */
    onDestroy(): void {
        this._stopAllTweens();
        // 兜底：即使有残留 timer tween 漏掉 stop，inputLocked 让 commitAfterTween 早退
        this._inputLocked = true;
    }

    /**
     * 显式渲染入口。GamePage 切难度 / 重玩当前关都调这个。
     * 重复调用安全：每次 PieceLayer 先清空、状态字段全部归位、计时重置。
     */
    render(): void {
        if (!this.sourceImage) {
            console.error('[PuzzleBoard] 源图未设置');
            return;
        }
        const layer = this.node.getChildByName('PieceLayer');
        if (!layer) {
            console.error('[PuzzleBoard] 找不到 PieceLayer 子节点');
            return;
        }
        // 关键：layer.removeAllChildren 之前停所有 tween——上一关有未完成
        // 缓动时切难度会触发本路径，旧 tween 持有的 _pieceNodes 引用即将失效。
        this._stopAllTweens();
        layer.removeAllChildren();
        this._victorious = false;
        this._inputLocked = false;
        this._dragPids = null;

        this._initSlots();

        const stats = shuffleSlots(this._slots, this.scatterRatio, this.maxShuffleAttempts);
        if (stats.satisfied) {
            console.log(
                `[PuzzleBoard] 洗牌完成 — pieceCount=${this.pieceCount}, ` +
                `misplaced=${stats.misplaced}, attempts=${stats.attempts}`,
            );
        } else {
            console.warn(
                `[PuzzleBoard] 洗牌 ${this.maxShuffleAttempts} 次仍未达标，使用最后一次。` +
                ` 检查 scatterRatio 是否过高。`,
            );
        }

        const created = createPieces(layer, {
            sourceImage: this.sourceImage,
            pieceMaterial: this.pieceMaterial,
            pieceCount: this.pieceCount,
            pieceGrid: this.pieceGrid,
            pieceDisplay: this.pieceDisplay,
            onTouchHandlersBind: (n) => this._registerPieceTouch(n),
        });
        this._pieceNodes = created.map(c => c.node);
        this._pieceSprites = created.map(c => c.sprite);

        this._layoutAllPieces();

        // 开局扫一次：偶尔洗牌后两块刚好相对正确，立刻合上。
        this._mergeAndApplyDerived();

        this._startTime = Date.now();
        this._rendered = true;

        console.log(
            `[PuzzleBoard] 开局校准 — pieceGrid=${this.pieceGrid}, ` +
            `boardSize=${this.boardSize}, pieceDisplay=${this.pieceDisplay}\n` +
            `pid 编号规则: pid = row*${this.pieceGrid} + col\n` +
            `  pid=0 显示源图 (row=0,col=0)=左上角 → 应在屏幕 [0,0] 槽（左上）\n` +
            `  pid=${this.pieceCount - 1} 显示源图 ` +
            `(row=${this.pieceGrid - 1},col=${this.pieceGrid - 1})=右下角 → ` +
            `应在屏幕 [${this.pieceGrid - 1},${this.pieceGrid - 1}] 槽（右下）\n` +
            this._dump(),
        );
    }

    /** 重玩当前关——等价于再调 render()，给调用方一个清晰命名。 */
    restart(): void {
        this.render();
    }

    get victorious(): boolean {
        return this._victorious;
    }

    /* ───────────────────── 内部辅助 ───────────────────── */

    private _initSlots(): void {
        this._slots = [];
        for (let i = 0; i < this.pieceCount; i++) this._slots.push(i);
    }

    /**
     * 把所有块的 PuzzlePiece 拍成 algo 层用的 PieceLite 数组。
     *
     * 单次 .getComponent() × N 比 algo 内部反复 .getComponent() × N×4 快得多——
     * 算法函数纯起来，一举两得。
     */
    private _readPieceLites(): PieceLite[] {
        const out: PieceLite[] = new Array(this.pieceCount);
        for (let pid = 0; pid < this.pieceCount; pid++) {
            const p = this._pieceNodes[pid].getComponent(PuzzlePiece)!;
            out[pid] = { row: p.row, col: p.col, groupId: p.groupId };
        }
        return out;
    }

    /**
     * 摆位——遍历 **slot** 而不是 pid。
     *
     * slot 是 _slots 数组的天然索引：slots[slot] = pid。遍历 slot 直接 O(N)，
     * 遍历 pid 则要 O(N²)（每次 indexOf 反查）。数据结构对了，特殊情况自然消失。
     */
    private _layoutAllPieces(): void {
        for (let slot = 0; slot < this.pieceCount; slot++) {
            const pid = this._slots[slot];
            const { x, y } = slotToPosition(slot, this.pieceGrid, this.pieceDisplay);
            this._pieceNodes[pid].setPosition(x, y, 0);
        }
    }

    /**
     * 合并扫描 + 派生（borderMask + sprite.color）。两个动作总是连在一起：
     * 不在一起就会出现"groupId 变了但视觉边框没刷"的状态，永远是 bug。
     *
     * 写回 groupId / borderMask 到 PuzzlePiece 组件——保持组件作为唯一真相源
     * （别的地方仍可 .getComponent(PuzzlePiece).groupId 拿到最新值）。
     */
    private _mergeAndApplyDerived(): { mergedAny: boolean; allInOneGroup: boolean } {
        const lites = this._readPieceLites();
        const { newGroupIds, mergedAny, allInOneGroup }
            = mergeScan(this._slots, lites, this.pieceGrid);

        for (let pid = 0; pid < this.pieceCount; pid++) {
            this._pieceNodes[pid].getComponent(PuzzlePiece)!.groupId = newGroupIds[pid];
            lites[pid].groupId = newGroupIds[pid];
        }

        const masks = recalcBorderMasks(this._slots, lites, this.pieceGrid);
        for (let pid = 0; pid < this.pieceCount; pid++) {
            this._pieceNodes[pid].getComponent(PuzzlePiece)!.borderMask = masks[pid];
        }

        // 01 路径下不写 sprite.color——会污染默认 material 的整块染色。
        if (this.pieceMaterial) {
            applyPieceColors(this._pieceSprites, masks);
        }

        return { mergedAny, allInOneGroup };
    }

    private _dump(): string {
        return dumpBoard(this._slots, this._readPieceLites(), this.pieceGrid);
    }

    /* ───────────────────── 触摸事件 ───────────────────── */

    /**
     * TOUCH_END 和 TOUCH_CANCEL 共用 handler——
     * 滑出节点松手会触发 CANCEL 而不是 END，必须两个都接，否则块卡半空。
     */
    private _registerPieceTouch(node: Node): void {
        node.on(Node.EventType.TOUCH_START, this._onTouchStart, this);
        node.on(Node.EventType.TOUCH_MOVE, this._onTouchMove, this);
        node.on(Node.EventType.TOUCH_END, this._onTouchEnd, this);
        node.on(Node.EventType.TOUCH_CANCEL, this._onTouchEnd, this);
    }

    /**
     * BEGIN：拖动组进顶 / 其余 piece 进底，并缓存 _dragPids 给 touchMove/End 复用。
     * 仅 shader 路径影响层级——01 路径 walk-order 已经够。详见 view/DragSorter.ts。
     */
    private _onTouchStart(event: EventTouch): void {
        if (this._victorious || this._inputLocked) return;
        const node = event.target as Node;
        const groupId = node.getComponent(PuzzlePiece)!.groupId;
        this._dragPids = this._collectGroupPids(groupId);
        setDragLayering(this._pieceNodes, this._dragPids, !!this.pieceMaterial);
    }

    /**
     * WORK：拖动组按 UIDelta 一起挪。slots 不动——COMMIT 才提交。
     *
     * 直接遍历缓存的 _dragPids（drag 期间 groupId 不会变），
     * 避免每帧 N 次 getComponent + N 次比较。
     */
    private _onTouchMove(event: EventTouch): void {
        if (this._victorious || this._inputLocked || !this._dragPids) return;
        const delta = event.getUIDelta();
        for (const pid of this._dragPids) {
            const pNode = this._pieceNodes[pid];
            const pos = pNode.position;
            pNode.setPosition(pos.x + delta.x, pos.y + delta.y, pos.z);
        }
    }

    /**
     * COMMIT：解算 → 写 slots → 缓动 → commitAfterTween。
     *
     * inputLocked 必须**在所有 tween.start() 之前**置 true——
     * 不能等回调里设：tween 第一帧前若有触摸事件会漏过早退。
     */
    private _onTouchEnd(event: EventTouch): void {
        if (this._victorious || this._inputLocked) return;
        // _dragPids null 意味着 touchEnd 在没 touchStart 的情况下到达——
        // 不可能但防御性早退。同时把 dragGroupId 从 _dragPids 起点反推也安全。
        if (!this._dragPids) return;

        const node = event.target as Node;
        const piece = node.getComponent(PuzzlePiece)!;
        const dragPid = piece.pieceId;
        const dragGroupId = piece.groupId;
        const groupPids = this._dragPids;  // 复用 touchStart 缓存——drag 期间 groupId 不变

        const dragDstSlot = pointerToSlot(
            node.position.x, node.position.y, this.pieceGrid, this.pieceDisplay,
        );

        if (dragDstSlot < 0) {
            this._snapBack(groupPids);
            return;
        }

        const swap = resolveSwap({
            slots: this._slots,
            groupPids,
            anchorPid: dragPid,
            anchorDstSlot: dragDstSlot,
            pieceGrid: this.pieceGrid,
        });

        if (!swap.valid) {
            this._snapBack(groupPids);
            return;
        }

        this._slots = swap.newSlots;

        console.log(
            `[PuzzleBoard] 整组搬运 — group=${dragGroupId}, ` +
            `groupPids=[${groupPids}], dRow=${swap.dRow}, dCol=${swap.dCol}, ` +
            `displaced=[${swap.displacedPids}]`,
        );

        this._inputLocked = true;
        tweenPiecesToSlots({
            nodes: this._pieceNodes,
            timerNode: this.node,
            duration: this.tweenDuration,
            pids: [...groupPids, ...swap.displacedPids],
            slots: this._slots,
            pieceGrid: this.pieceGrid,
            pieceDisplay: this.pieceDisplay,
            onComplete: () => this._commitAfterTween(),
        });
    }

    /**
     * 缓动结束后的提交：复位层级 + mergeScan + 胜利判定。
     *
     * try/finally 包一层——mergeScan 异常时锁仍能释放，避免"卡死永远不能拖"。
     */
    private _commitAfterTween(): void {
        try {
            clearDragLayering(this._pieceNodes);
            const { mergedAny, allInOneGroup } = this._mergeAndApplyDerived();
            if (mergedAny) {
                console.log('[PuzzleBoard] merge happened\n' + this._dump());
            }
            // !this._victorious 防止 mergeScan 再次返回 allInOneGroup=true 重复触发 onWin。
            if (allInOneGroup && !this._victorious) {
                this._victorious = true;
                const elapsed = Date.now() - this._startTime;
                console.log(`[PuzzleBoard] 胜利！用时 ${(elapsed / 1000).toFixed(1)}s`);
                this.onWin?.(elapsed);
            }
        } finally {
            this._dragPids = null;
            this._inputLocked = false;
        }
    }

    /** 整组弹回原槽（缓动）。越界 / 落点等于源时调。 */
    private _snapBack(groupPids: number[]): void {
        this._inputLocked = true;
        tweenPiecesToSlots({
            nodes: this._pieceNodes,
            timerNode: this.node,
            duration: this.tweenDuration,
            pids: groupPids,
            slots: this._slots,
            pieceGrid: this.pieceGrid,
            pieceDisplay: this.pieceDisplay,
            onComplete: () => {
                clearDragLayering(this._pieceNodes);
                this._dragPids = null;
                this._inputLocked = false;
            },
        });
    }

    private _collectGroupPids(groupId: number): number[] {
        const out: number[] = [];
        for (let pid = 0; pid < this.pieceCount; pid++) {
            if (this._pieceNodes[pid].getComponent(PuzzlePiece)!.groupId === groupId) {
                out.push(pid);
            }
        }
        return out;
    }

    /**
     * 停所有挂在 PuzzleBoard 自身节点 + 各 piece 节点上的 tween。
     *
     * 为什么不只停 this.node 的：piece 缓动 tween(node).to(...) 是挂在
     * piece 节点上的（DragTween），timer tween 才挂 this.node。
     * 漏停 piece tween 的话，节点销毁后下一帧 tween scheduler 仍会尝试更新它的
     * position，写入失效内存（虽然 V8 会拦但日志会喷 warn）。
     */
    private _stopAllTweens(): void {
        Tween.stopAllByTarget(this.node);
        for (const pNode of this._pieceNodes) {
            if (pNode && pNode.isValid) {
                Tween.stopAllByTarget(pNode);
            }
        }
    }
}
