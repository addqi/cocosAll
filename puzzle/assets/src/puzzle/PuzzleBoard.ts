import {
    _decorator, Color, Component, EventTouch, Material, Node, Rect, Sorting2D, Sprite,
    SpriteFrame, tween, UITransform, Vec2, Vec3,
} from 'cc';
import { PuzzlePiece } from './PuzzlePiece';

const { ccclass } = _decorator;

/**
 * 拼图主控（教程 01-07 节累计版本）。
 *
 * 累计的能力：
 *   01: 切片 + 摆位（slots → position 投影）
 *   02: Fisher-Yates 洗牌 + 散度阈值兜底
 *   03: 触摸事件四件套（START/MOVE/END/CANCEL）+ 跟手
 *   04: pointerToSlot + 单块 swap（两两交换 + 越界弹回）
 *   05: mergeScan + Union-Find（Rule B 邻接合并 → groupId）
 *   06: 整组拖动 + 集合差消除特殊情况（displaceFrom / fillTo）
 *   07: 胜利状态机 + tween 缓动 + 输入锁
 *   08: 渲染层升级——共享 SpriteFrame + 共享 Material + sprite.color 编码 → 真合批
 *
 * 渲染双路径（08 节，向后兼容铁律）：
 *   - pieceMaterial == null：01 节路径——每块克隆 SpriteFrame 改 rect。无圆角无边框，
 *     但 N=3~6 时合批仍按 Cocos 默认（同 texture）走，DC 极低。**用户没在编辑器
 *     创建 .mtl 时自动走这条**——零破坏，能玩。
 *   - pieceMaterial != null：08 节路径——所有块共享 sourceFrame + 共享 sharedMat，
 *     差异通过 sprite.color (R=borderMask低4位, G=pieceId, A=255) 顶点色传给 shader。
 *     Shader 里采源图 1/N 区域 + 自绘圆角黑白边 + 合并接缝消失。10×10 仍 1~2 DC。
 *
 * 数据真相源：
 *   _slots[j] = pieceId       槽位 j 当前放着哪块
 *   _pieceNodes[pid] = Node   pid → Node 的 O(1) 索引
 *   piece.groupId             同 groupId 的属于同一组——派生自 mergeScan
 *
 * **Position 永远是 slots 的投影**，groupId 永远是 mergeScan 的投影。
 * 没有任何"另存的、需跟其他字段同步"的状态——所有状态都有唯一真相源。
 *
 * 状态机（07 节）：
 *   - _victorious=true：终止状态。所有触摸早退。restart() 才能重置。
 *   - _inputLocked=true：缓动期间锁。tween 完成后 commit 阶段自清。
 *   两者 OR 合到一个早退入口——不需要 enum。
 *
 * 事务模型（06/07 节合体）：
 *   BEGIN：onPieceTouchStart 整组 Sorting2D.sortingOrder bump 到极值（提层）
 *   WORK： onPieceTouchMove 整组按 UIDelta 同步移动（不动 slots）
 *   COMMIT：onPieceTouchEnd 写 slots → 启动缓动 → 缓动结束跑 _resetAllPriorities
 *           + mergeScan + 胜利判定
 *
 * 节点结构（GamePage 准备）：
 *   PuzzleBoard 节点
 *     └── PieceLayer  （所有 piece 都挂这里）
 *
 * 拖动层级策略（**反直觉，重点看**）：
 *   每块 piece 挂 cc.Sorting2D 组件，sortingOrder 初始 = pid。
 *   拖动时把整组的 sortingOrder bump 到 **-1000-pid（极小值）**，提交后 reset 回 pid。
 *
 *   关键反常识：在本项目（08 路径，共享 puzzle-piece.effect 自定义 shader）下，
 *   **数值越小的 priority 反而画在最上层**——与 cocos 文档约定相反。
 *
 *   推测原因（高置信度但未拍板）：
 *     1. puzzle-piece.effect 用 `blend: true` + `cullMode: none`，sprite 被归入
 *        3D 渲染管线的"transparent queue"，该 queue 的排序方向与 cocos 默认 sprite
 *        material 不一样——transparent 通常按"远→近"画（painter's algorithm），
 *        实现里可能反映为"低 priority 后画 → 在最上"。
 *     2. 也可能是 cocos 3.8 在本项目实际构建里 USE_SORTING_2D 宏没生效——
 *        sort 路径死代码，priority 完全被忽略，但 chunk allocator 的 VBO 物理位置
 *        恰好让"sortingOrder 越小（= 越早设置 = 越早分配 chunk = 越靠 buffer 末尾？）"
 *        的块画在最后，从而在最上。
 *     3. 实证后：诊断 log 证明 priority **真的被算出来**（sorting2DCount > 0 + onEnable
 *        生效），但视觉验证 1000+pid 在底、-1000-pid 在顶——所以 (1) 概率最大。
 *
 *   失败的多次尝试（删除前留证据，给未来踩同样坑的人）：
 *     - 试验1: 强制走 01 路径（pieceMaterial=null）→ 视觉正常 → 锁定问题在 shader 路径
 *     - 试验2: 单 layer + setSiblingIndex → 改了 children 数组没改 chunk vid → 无效
 *     - 试验3: 双 layer + reparent 到 DragLayer → chunk 物理位置不变 → 无效
 *     - 试验4: Sorting2D + 1000+pid（高 priority）→ 结果 dragged 在底（!）
 *     - 试验5: Sorting2D + -1000-pid（极低 priority）→ 视觉正确 → ✓ 当前方案
 *
 *   未来如果换 effect / 升 cocos 版本，**先把 -1000 改回 +1000 验证一次**——
 *   如果新版本/新 shader 让 sort 方向回归正向，应该改回去保持代码符合直觉。
 *
 * 用 start() 不用 onLoad()——后者在 addComponent() 同步触发，
 * GamePage 流程是 "addComponent → 赋值 sourceImage"，onLoad 时字段还是 null。
 */
@ccclass('PuzzleBoard')
export class PuzzleBoard extends Component {

    // ────── GamePage 注入项（每次 startLevel/_mountBoard 写一次） ──────
    // 整个 PuzzleBoard 是 runtime 通过 addComponent 创建的，不是场景脚本，
    // 因此**没有 @property 装饰器**——Inspector 不会显示，写也是噪音。
    // 配置数据流：GamePage._mountBoard 写字段 → board.render() 用。

    /** 源图。GamePage 从 BundleManager.loadImageSF 异步加载后注入。 */
    sourceImage: SpriteFrame | null = null;

    /** 棋盘像素边长。GamePage 按屏短边 × BOARD_FILL_RATIO 算好注入。 */
    boardSize: number = 800;

    /** 每边切几块（3 = 3×3 = 9 块）。GamePage 按当前难度注入。 */
    pieceGrid: number = 3;

    /**
     * [08 节] 共享 piece 材质——puzzle-piece.mtl。null 时走 01 节切片路径
     * （无边框无圆角，但功能完整）。GamePage._ensurePieceMaterial 加载后注入；
     * 用户没在编辑器创建 .mtl 时就是 null，PuzzleBoard 自动 fallback。
     */
    pieceMaterial: Material | null = null;

    // ────── 内部调参（不外部配置；改这里就是改算法行为） ──────

    /** 洗牌散度阈值（0~1）：至少 scatterRatio 比例的块不在原位才算合格。 */
    scatterRatio: number = 0.7;

    /** 洗牌最大重试次数——极端 scatterRatio 下兜底，避免死循环。 */
    maxShuffleAttempts: number = 100;

    /** 单次缓动时长（秒）。整组搬运/弹回 tween 共用。 */
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
    /** [08 节] piece 的 Sprite 引用，applyPieceColor 用。01 节路径下也填，反正 O(N) 内存。 */
    private _pieceSprites: Sprite[] = [];
    private _rendered = false;

    /** 胜利状态——派生自 mergeScan 的 allInOneGroup。一旦 true 就锁死，restart() 才能重置。 */
    private _victorious: boolean = false;

    /** 缓动锁——swap 提交期间禁止再拖。tween 末尾的 commit 阶段自动清。 */
    private _inputLocked: boolean = false;

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
        layer.removeAllChildren();
        // 重启时所有状态归零——胜利状态绝不能跨次复用。
        this._victorious = false;
        this._inputLocked = false;
        this._initSlots();
        this._shuffleSlots();
        this._createPieces(layer);
        this._layoutAllPieces();
        // 开局扫一次：偶尔洗牌后两块刚好相对正确，立刻合上。
        // mergeScan 末尾会派生 borderMask + applyPieceColor（如果走 08 路径）。
        this._mergeScan();
        this._startTime = Date.now();
        this._rendered = true;

        // 开局打一次对照表：盘面 + 每个 pid 应在的位置 + 切片方向校准。
        // 视觉上"图像内容跟槽位"对不齐时，用户可以对着这张表自查 piece 编号。
        console.log(
            `[PuzzleBoard] 开局校准 — pieceGrid=${this.pieceGrid}, ` +
            `boardSize=${this.boardSize}, pieceDisplay=${this.pieceDisplay}\n` +
            `pid 编号规则: pid = row*${this.pieceGrid} + col\n` +
            `  pid=0 显示源图 (row=0,col=0)=左上角 → 应在屏幕 [0,0] 槽（左上）\n` +
            `  pid=${this.pieceCount - 1} 显示源图 ` +
            `(row=${this.pieceGrid - 1},col=${this.pieceGrid - 1})=右下角 → ` +
            `应在屏幕 [${this.pieceGrid - 1},${this.pieceGrid - 1}] 槽（右下）\n` +
            this._dumpBoard(),
        );
    }

    /**
     * 重玩当前关——洗牌 + 重新摆位。等价于再调 render()，
     * 给调用方一个清晰的语义命名。
     */
    restart(): void {
        this.render();
    }

    /** 当前是否已胜利。GamePage 防止弹窗期间被二次触发用。 */
    get victorious(): boolean {
        return this._victorious;
    }

    /* ───────────────────── 01: 初始化 / 切片 / 摆位 ───────────────────── */

    private _initSlots(): void {
        this._slots = [];
        for (let i = 0; i < this.pieceCount; i++) this._slots.push(i);
    }

    /**
     * 双路径切片入口。**两条路径产出的逻辑完全等价**——piece.row/col/groupId
     * 一致，slot/position 投影一致，触摸事件挂法一致。差异只在视觉来源：
     *
     *   **08 路径**（pieceMaterial != null）
     *     所有块共用 sourceImage SpriteFrame + 共用 sharedMat。
     *     "显示哪 1/N" 由 frag 根据 sprite.color.g(=pieceId) 计算 UV 偏移。
     *     共享 → 真合批：100 块仍 1~2 DC。
     *
     *   **01 路径**（pieceMaterial == null）
     *     每块克隆 SpriteFrame、改 rect 指向 1/N 像素区域。
     *     默认 sprite material（同 texture）下也合批，3×3~6×6 完全够用。
     *     用户没在编辑器做 .mtl 时自动走这条——视觉简陋但功能完整。
     */
    private _createPieces(layer: Node): void {
        if (this.pieceMaterial) {
            console.log(
                `[PuzzleBoard] 🟢 走 08 路径——共享 SpriteFrame + customMaterial（shader 自绘）。` +
                ` material=${this.pieceMaterial.name || '(unnamed)'}`,
            );
            this._createPiecesShared(layer);
        } else {
            console.log('[PuzzleBoard] 🟡 走 01 路径——每块切 SpriteFrame.rect（无 shader）。');
            this._createPiecesSliced(layer);
        }
    }

    /**
     * [08 节] 共享 SpriteFrame + 共享 Material 路径。
     *
     * 关键纪律——任何一条破了都失批：
     *   1. 所有 sprite 的 spriteFrame === sourceImage（同对象引用，不是 clone）
     *   2. 所有 sprite 的 customMaterial === sharedMat（同实例，不要在循环里 new Material）
     *   3. gridDim uniform 只对 sharedMat setProperty 一次（共享 → 一次写全部生效）
     *
     * sprite.color 写 (borderMask, pieceId, 0, 255)——**顶点属性，不破坏合批**。
     * 边框和 pieceId 都通过这条免费旁路传，shader 在 frag 里 floor(c*255+0.5) 还原。
     */
    private _createPiecesShared(layer: Node): void {
        const sourceFrame = this.sourceImage!;
        const sharedMat = this.pieceMaterial!;
        // gridDim 是 vec2——必须传 Vec2 实例，传裸数组在 3.8 上会被默默忽略。
        sharedMat.setProperty('gridDim', new Vec2(this.pieceGrid, this.pieceGrid));

        this._pieceNodes = [];
        this._pieceSprites = [];
        for (let pid = 0; pid < this.pieceCount; pid++) {
            const r = Math.floor(pid / this.pieceGrid);
            const c = pid % this.pieceGrid;

            const node = new Node(`Piece_${pid}`);
            layer.addChild(node);

            const ut = node.addComponent(UITransform);

            const sp = node.addComponent(Sprite);
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
            sp.type = Sprite.Type.SIMPLE;
            sp.spriteFrame = sourceFrame;          // ← 整张大图，所有块共享
            sp.customMaterial = sharedMat;         // ← 共享自定义 effect material
            ut.setContentSize(this.pieceDisplay, this.pieceDisplay);

            const piece = node.addComponent(PuzzlePiece);
            piece.pieceId = pid;
            piece.row = r;
            piece.col = c;
            piece.groupId = pid;
            piece.borderMask = 0xf;

            // Sorting2D：拖动期间靠它把当前组的 priority 调到极值，进而控制层级。
            // **为什么需要 + 反向逻辑**——见类顶部"拖动层级策略"。
            // 初始 sortingOrder=pid 没特别含义（块不重叠），只是给一个稳定 baseline，
            // 方便 _resetAllPriorities 复位。
            const sorting = node.addComponent(Sorting2D);
            sorting.sortingOrder = pid;

            this._registerPieceTouch(node);
            this._pieceNodes.push(node);
            this._pieceSprites.push(sp);
        }
    }

    /**
     * [01 节] 每块克隆 SpriteFrame、改 rect 路径。fallback 用。
     *
     * **rect.y 方向血泪坑**：Cocos 3.8.x 通过 BundleManager 动态加载的 SpriteFrame，
     * `rect` 走的是**像素坐标 / 左上原点 / y 向下**——rect.y=0 对应源图**最上一行**。
     *   所以 r * cellSize 直接用，r=0 → rect.y=0 → 源图上半 → piece.row=0 一致。
     *
     * 如果换引擎/导入设置后视觉变成上下颠倒，把下面 `r * cellSize` 改回
     * `(pieceGrid - 1 - r) * cellSize`。
     */
    private _createPiecesSliced(layer: Node): void {
        const sf = this.sourceImage!;
        const tex = sf.texture;
        const sourceMin = Math.min(sf.rect.width, sf.rect.height);
        const cellSize = Math.floor(sourceMin / this.pieceGrid);
        const offsetX = sf.rect.x + (sf.rect.width - cellSize * this.pieceGrid) / 2;
        const offsetY = sf.rect.y + (sf.rect.height - cellSize * this.pieceGrid) / 2;

        this._pieceNodes = [];
        this._pieceSprites = [];
        for (let pid = 0; pid < this.pieceCount; pid++) {
            const r = Math.floor(pid / this.pieceGrid);
            const c = pid % this.pieceGrid;

            const node = new Node(`Piece_${pid}`);
            layer.addChild(node);

            const ut = node.addComponent(UITransform);

            const frame = new SpriteFrame();
            frame.texture = tex;
            frame.rect = new Rect(
                offsetX + c * cellSize,
                offsetY + r * cellSize,
                cellSize,
                cellSize,
            );

            // 顺序极其讲究：必须 sizeMode=CUSTOM **先**于赋 spriteFrame，
            // 否则 TRIMMED 默认会在赋值瞬间把节点 contentSize 改成 frame.rect 大小（cellSize），
            // 后果是块比 pieceDisplay 大 → 互相重叠。末尾再 setContentSize 兜底。
            const sp = node.addComponent(Sprite);
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
            sp.type = Sprite.Type.SIMPLE;
            sp.spriteFrame = frame;
            ut.setContentSize(this.pieceDisplay, this.pieceDisplay);

            const piece = node.addComponent(PuzzlePiece);
            piece.pieceId = pid;
            piece.row = r;
            piece.col = c;
            piece.groupId = pid;

            // 同 _createPiecesShared 同段注释——01 路径下虽然单块独立 SpriteFrame
            // 不会触发 shader 路径的反向 sort，但保持两条路径行为一致更省心。
            const sorting = node.addComponent(Sorting2D);
            sorting.sortingOrder = pid;

            this._registerPieceTouch(node);
            this._pieceNodes.push(node);
            this._pieceSprites.push(sp);
        }
    }

    /**
     * TOUCH_END 和 TOUCH_CANCEL 共用 handler——
     * 滑出节点松手会触发 CANCEL 而不是 END，必须两个都接，否则块卡半空。
     */
    private _registerPieceTouch(node: Node): void {
        node.on(Node.EventType.TOUCH_START, this._onPieceTouchStart, this);
        node.on(Node.EventType.TOUCH_MOVE, this._onPieceTouchMove, this);
        node.on(Node.EventType.TOUCH_END, this._onPieceTouchEnd, this);
        node.on(Node.EventType.TOUCH_CANCEL, this._onPieceTouchEnd, this);
    }

    /* ───────────────────── 08: 派生 borderMask + 写 sprite.color ───────────────────── */

    /**
     * 全量重扫所有 piece 的 borderMask。调用时机：mergeScan 末尾。
     *
     * 复杂度：N × 4 个邻居判断 = O(4N)。N=100 时 400 次比较，< 1ms，忽略不计。
     *
     * 编码（与 effect 的 fs 解码对应）：bit0=上, bit1=右, bit2=下, bit3=左。
     * mask=1 意味着该方向需要画边框（无同组邻居），mask=0 = 已合并、不画边框。
     *
     * **派生意味着不储存真相**——和 position 同性质。每次重扫，不增量。
     */
    private _recalcBorderMasks(): void {
        const TOP = 1, RIGHT = 2, BOTTOM = 4, LEFT = 8;
        for (let pid = 0; pid < this.pieceCount; pid++) {
            const piece = this._pieceNodes[pid].getComponent(PuzzlePiece)!;
            const slotIdx = this._slots.indexOf(pid);
            const sr = Math.floor(slotIdx / this.pieceGrid);
            const sc = slotIdx % this.pieceGrid;
            const r = piece.row;
            const c = piece.col;
            const myGroup = piece.groupId;

            let mask = 0xf;

            // 上邻：屏幕上方对应 sr-1。槽里那块的"原始 row/col" 应是 (r-1, c)。
            if (sr > 0) {
                const nPid = this._slots[(sr - 1) * this.pieceGrid + sc];
                const np = this._pieceNodes[nPid].getComponent(PuzzlePiece)!;
                if (np.groupId === myGroup && np.row === r - 1 && np.col === c) {
                    mask &= ~TOP;
                }
            }
            // 右邻
            if (sc + 1 < this.pieceGrid) {
                const nPid = this._slots[sr * this.pieceGrid + sc + 1];
                const np = this._pieceNodes[nPid].getComponent(PuzzlePiece)!;
                if (np.groupId === myGroup && np.row === r && np.col === c + 1) {
                    mask &= ~RIGHT;
                }
            }
            // 下邻
            if (sr + 1 < this.pieceGrid) {
                const nPid = this._slots[(sr + 1) * this.pieceGrid + sc];
                const np = this._pieceNodes[nPid].getComponent(PuzzlePiece)!;
                if (np.groupId === myGroup && np.row === r + 1 && np.col === c) {
                    mask &= ~BOTTOM;
                }
            }
            // 左邻
            if (sc > 0) {
                const nPid = this._slots[sr * this.pieceGrid + sc - 1];
                const np = this._pieceNodes[nPid].getComponent(PuzzlePiece)!;
                if (np.groupId === myGroup && np.row === r && np.col === c - 1) {
                    mask &= ~LEFT;
                }
            }

            piece.borderMask = mask;
        }
    }

    /**
     * 把 (borderMask, pieceId) 编码到所有块的 sprite.color。
     *
     *   R 字节 = borderMask 低 4 位（高 4 位备用）
     *   G 字节 = pieceId（0~255，pieceGrid <= 16 时够用）
     *   B 字节 = 备用
     *   A     = 255 不动（透明度走 node opacity / Sprite UIOpacity）
     *
     * 仅 08 路径调——01 路径下 sprite 用默认 material，写 color 等于"整块染色"，
     * 反而把图染歪。守卫一行 `if (!this.pieceMaterial) return`。
     */
    private _applyAllPieceColors(): void {
        if (!this.pieceMaterial) return;
        for (let pid = 0; pid < this.pieceCount; pid++) {
            const piece = this._pieceNodes[pid].getComponent(PuzzlePiece)!;
            const sp = this._pieceSprites[pid];
            const rByte = piece.borderMask & 0xf;
            sp.color = new Color(rByte, pid & 0xff, 0, 255);
        }
    }

    private _layoutAllPieces(): void {
        for (let pid = 0; pid < this.pieceCount; pid++) {
            const slotIdx = this._slots.indexOf(pid);
            const { x, y } = this._slotToPosition(slotIdx);
            this._pieceNodes[pid].setPosition(x, y, 0);
        }
    }

    /** 槽位下标 → Board-local (x, y)。中心槽对应 (0, 0)。 */
    private _slotToPosition(slotIdx: number): { x: number; y: number } {
        const sr = Math.floor(slotIdx / this.pieceGrid);
        const sc = slotIdx % this.pieceGrid;
        const center = (this.pieceGrid - 1) / 2;
        return {
            x: (sc - center) * this.pieceDisplay,
            y: (center - sr) * this.pieceDisplay,
        };
    }

    /* ───────────────────── 04: 槽位反算 ───────────────────── */

    /**
     * Board-local 坐标 → 槽位下标。
     *
     * 用 round 而不是 floor —— 块的 anchor 在中心，块中心稍微偏移时按"四舍五入到最近格"
     * 比"向左下取整"对玩家更宽容。
     */
    private _pointerToSlot(boardLocalX: number, boardLocalY: number): number {
        const center = (this.pieceGrid - 1) / 2;
        const sc = Math.round(boardLocalX / this.pieceDisplay + center);
        const sr = Math.round(center - boardLocalY / this.pieceDisplay);
        if (sr < 0 || sr >= this.pieceGrid || sc < 0 || sc >= this.pieceGrid) return -1;
        return sr * this.pieceGrid + sc;
    }

    /* ───────────────────── 02: 洗牌 ───────────────────── */

    private _shuffleSlots(): void {
        const minMisplaced = Math.floor(this.pieceCount * this.scatterRatio);
        let attempts = 0;
        while (attempts < this.maxShuffleAttempts) {
            this._fisherYates(this._slots);
            attempts++;
            const misplaced = this._countMisplaced(this._slots);
            if (misplaced >= minMisplaced) {
                console.log(
                    `[PuzzleBoard] 洗牌完成 — pieceCount=${this.pieceCount}, ` +
                    `misplaced=${misplaced}, attempts=${attempts}`,
                );
                return;
            }
        }
        console.warn(
            `[PuzzleBoard] 洗牌 ${this.maxShuffleAttempts} 次仍未达标，使用最后一次结果。` +
            ` 检查 scatterRatio 是否过高。`,
        );
    }

    /** Fisher-Yates 原地等概率打乱：1938 年算法，10 行写完。 */
    private _fisherYates(arr: number[]): void {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }

    /** 数有多少块不在正确槽（slots[i] !== i）。 */
    private _countMisplaced(arr: number[]): number {
        let count = 0;
        for (let i = 0; i < arr.length; i++) {
            if (arr[i] !== i) count++;
        }
        return count;
    }

    /* ───────────────────── 05: Union-Find + mergeScan ───────────────────── */

    /**
     * Union-Find 找根（带路径压缩）。
     * 走 parent 链直到自指；途中把每个节点直接挂到爷节点下，下次更扁。
     */
    private _find(parents: number[], x: number): number {
        while (parents[x] !== x) {
            parents[x] = parents[parents[x]];
            x = parents[x];
        }
        return x;
    }

    /** 合并两组。返回 true = 这次真合了、false = 已同组（不计入新合并）。 */
    private _union(parents: number[], a: number, b: number): boolean {
        const ra = this._find(parents, a);
        const rb = this._find(parents, b);
        if (ra === rb) return false;
        parents[ra] = rb;
        return true;
    }

    /**
     * 全量扫描合并：每次 swap 提交后调一次。返回值见接口。
     *
     * 关键设计：parents 在每次调用内重建——"组拆解"通过全量重扫天然支持，
     * 不需要 disunion 操作（并查集不存在该操作）。
     *
     * Rule B：只看相对位置正确，不看绝对位置——商业拼图标准玩法。
     *
     * @returns mergedAny **新增**了合并关系才 true（不是"本轮 union 操作 > 0"——
     *                    后者每轮都重置 parents，已合的会反复 union 永远 true）。
     *                    通过对比"上次 mergeScan 后" 和"本轮" 的 groupId 集合判定。
     * @returns allInOneGroup 所有块属于同一组（== 胜利状态）
     */
    private _mergeScan(): { mergedAny: boolean; allInOneGroup: boolean } {
        // 拍一个"上次"的 groupId 快照——后面对比用。
        const prevGroupIds: number[] = [];
        for (let pid = 0; pid < this.pieceCount; pid++) {
            prevGroupIds.push(this._pieceNodes[pid].getComponent(PuzzlePiece)!.groupId);
        }

        const parents: number[] = [];
        for (let pid = 0; pid < this.pieceCount; pid++) parents.push(pid);

        for (let sr = 0; sr < this.pieceGrid; sr++) {
            for (let sc = 0; sc < this.pieceGrid; sc++) {
                const idx = sr * this.pieceGrid + sc;
                const pid = this._slots[idx];
                const piece = this._pieceNodes[pid].getComponent(PuzzlePiece)!;

                // 右邻：邻居的"正确 row/col"应该是 (piece.row, piece.col + 1)
                if (sc + 1 < this.pieceGrid) {
                    const rPid = this._slots[idx + 1];
                    const rPiece = this._pieceNodes[rPid].getComponent(PuzzlePiece)!;
                    if (rPiece.row === piece.row && rPiece.col === piece.col + 1) {
                        this._union(parents, pid, rPid);
                    }
                }

                // 下邻：邻居的"正确 row/col"应该是 (piece.row + 1, piece.col)
                if (sr + 1 < this.pieceGrid) {
                    const dPid = this._slots[idx + this.pieceGrid];
                    const dPiece = this._pieceNodes[dPid].getComponent(PuzzlePiece)!;
                    if (dPiece.row === piece.row + 1 && dPiece.col === piece.col) {
                        this._union(parents, pid, dPid);
                    }
                }
            }
        }

        // 写回每块的 groupId
        for (let pid = 0; pid < this.pieceCount; pid++) {
            this._pieceNodes[pid].getComponent(PuzzlePiece)!.groupId = this._find(parents, pid);
        }

        // 数 root 数 == 组数。组数 === 1 ↔ 全部属于同一组 ↔ 胜利。
        const roots = new Set<number>();
        for (let pid = 0; pid < this.pieceCount; pid++) {
            roots.add(this._find(parents, pid));
        }
        const allInOneGroup = roots.size === 1;

        // mergedAny 真正语义：组数变少（=组合并）或某 pid 从单块变成多块组的成员（=新加入大组）。
        // 实现：组数减少最直接——前后组数对比即可。前提是 prev 也用同样的"组数"概念。
        const prevRoots = new Set<number>();
        for (const g of prevGroupIds) prevRoots.add(g);
        const mergedAny = roots.size < prevRoots.size;

        // [08 节] 派生 borderMask + 同步 sprite.color。
        // 必须在 groupId 写完之后做——派生 = 投影。01 路径下 _applyAllPieceColors
        // 内部 `if (!pieceMaterial) return`，零成本。
        this._recalcBorderMasks();
        this._applyAllPieceColors();

        return { mergedAny, allInOneGroup };
    }


    /**
     * 调试用：把当前盘面 + 所有组打印成可视化文本。
     *
     * 输出形如：
     *   slots:
     *     [3] [1] [7]
     *     [0] [4] [5]
     *     [6] [2] [8]
     *   groups: [4,5] [0,3] (孤立: 1, 2, 6, 7, 8)
     *
     * 你给我这一段截图，我能立刻 1:1 还原现场判断 Rule B 是否合得对。
     */
    private _dumpBoard(): string {
        // 第 1 行：盘面位置图 — ✓ = 该 pid 在正确槽位（slots[i] === i），✗ = 错位。
        // 还在每个 pid 后面括号显示其 piece.row,col（即"正确位置"），
        // 让肉眼直接对照"看到的图像内容" vs "应该在哪"——上下镜像/左右镜像一目了然。
        let misplaced = 0;
        const lines: string[] = ['slots（✓=在正确槽 / ✗=错位 / pid(row,col)=该块对应源图区域）:'];
        for (let sr = 0; sr < this.pieceGrid; sr++) {
            const row: string[] = [];
            for (let sc = 0; sc < this.pieceGrid; sc++) {
                const idx = sr * this.pieceGrid + sc;
                const pid = this._slots[idx];
                const piece = this._pieceNodes[pid].getComponent(PuzzlePiece)!;
                const ok = pid === idx ? '✓' : '✗';
                if (pid !== idx) misplaced++;
                row.push(`[${ok}${pid}(${piece.row},${piece.col})]`);
            }
            lines.push('  ' + row.join(' '));
        }
        lines.push(`错位块数 misplaced = ${misplaced}（=0 才是真正拼完）`);

        const groups: { [key: number]: number[] } = {};
        for (let pid = 0; pid < this.pieceCount; pid++) {
            const g = this._pieceNodes[pid].getComponent(PuzzlePiece)!.groupId;
            if (!groups[g]) groups[g] = [];
            groups[g].push(pid);
        }
        const multi: string[] = [];
        const solos: number[] = [];
        for (const k in groups) {
            if (groups[k].length > 1) multi.push(`[${groups[k]}]`);
            else solos.push(groups[k][0]);
        }
        const groupLine = multi.length === 0 && solos.length === this.pieceCount
            ? 'groups: (全部孤立)'
            : `groups: ${multi.join(' ')}` + (solos.length ? `  (孤立: ${solos.join(',')})` : '');
        lines.push(groupLine);

        return lines.join('\n');
    }

    /* ───────────────────── 06+07: 触摸事件 ───────────────────── */

    /**
     * BEGIN：把拖动整组的 Sorting2D.sortingOrder bump 到 **-1000-pid**（极小值）。
     *
     * **为什么是负数 / 越小越在上**——见类顶部"拖动层级策略"详细解释。
     * 简版：本项目 08 路径用了自定义 shader（blend+cullNone），sprite 走 3D transparent
     * queue，该 queue 的排序方向相反——priority 越小反而画在最上层。
     * 不是直觉错，是 cocos transparent queue 与 sprite 默认 queue 的排序约定不一样。
     *
     * -1000 这个魔数：< 0 - max_pid（即使 31×31=961 块也安全），保证拖动组的 priority
     * 永远小于其他静态块。组内成员各 -1000-pid 保持相对顺序（多块组也成立）。
     *
     * commit / snapBack 末尾会调 _resetAllPriorities() 把所有块复位回 sortingOrder=pid。
     */
    private _onPieceTouchStart(event: EventTouch): void {
        if (this._victorious || this._inputLocked) return;
        const node = event.target as Node;
        const groupId = node.getComponent(PuzzlePiece)!.groupId;
        for (let pid = 0; pid < this.pieceCount; pid++) {
            const pNode = this._pieceNodes[pid];
            if (pNode.getComponent(PuzzlePiece)!.groupId === groupId) {
                pNode.getComponent(Sorting2D)!.sortingOrder = -1000 - pid;
            }
        }
    }

    /**
     * 把所有 piece 的 sortingOrder 复位到 pid（baseline）。
     * commit 缓动结束时 + snapBack 缓动结束时调——保证下一次拖动前层级是干净的。
     *
     * 复位值 pid 没特别含义（pieces 不重叠），只是给个稳定值——不复位的话下一次
     * touchStart 会在已 bump 的状态上再 bump，逻辑没错但 priority 数值会越拖越极端。
     */
    private _resetAllPriorities(): void {
        for (let pid = 0; pid < this.pieceCount; pid++) {
            this._pieceNodes[pid].getComponent(Sorting2D)!.sortingOrder = pid;
        }
    }

    /**
     * WORK：所有同组块按 UIDelta 一起挪。slots 不动——拖动期间是"虚位移"，COMMIT 才提交。
     */
    private _onPieceTouchMove(event: EventTouch): void {
        if (this._victorious || this._inputLocked) return;
        const node = event.target as Node;
        const piece = node.getComponent(PuzzlePiece)!;
        const groupId = piece.groupId;
        const delta = event.getUIDelta();

        for (let pid = 0; pid < this.pieceCount; pid++) {
            const pNode = this._pieceNodes[pid];
            if (pNode.getComponent(PuzzlePiece)!.groupId === groupId) {
                const pos = pNode.position;
                pNode.setPosition(pos.x + delta.x, pos.y + delta.y, pos.z);
            }
        }
    }

    /**
     * COMMIT：整组搬运 + 集合差消除特殊情况 + tween 缓动 + commitAfterTween。
     *
     * 流程：
     *   1. 收集组员 + 算偏移（dRow/dCol，基于领头块的源/目标槽）
     *   2. 越界检查（任何组员目标超出 0..pieceGrid → 整组弹回）
     *   3. 集合差：displaceFrom = dst \ src（被挤的非组员槽）；fillTo = src \ dst（空出的槽）
     *   4. 写新 slots：组员到目标、被挤者从 OLD slots 读出来填回 fillTo
     *   5. tween 缓动所有移动块（组员 + 被挤者），lastTween + 1 个 timer tween 串到 commit
     *   6. commitAfterTween：清锁 + mergeScan → 胜利则触发 onWin
     *
     * 数据驱动铁律：**先全部读 → 全部算 → 全部写**——不能写 newSlots 中途又读 newSlots。
     * 否则被挤者填到空槽时会读到组员（组员先被写入 newSlots[displaceFrom[i]]）。
     */
    private _onPieceTouchEnd(event: EventTouch): void {
        if (this._victorious || this._inputLocked) return;

        const node = event.target as Node;
        const piece = node.getComponent(PuzzlePiece)!;
        const dragPid = piece.pieceId;
        const dragGroupId = piece.groupId;

        const groupPids: number[] = [];
        for (let pid = 0; pid < this.pieceCount; pid++) {
            if (this._pieceNodes[pid].getComponent(PuzzlePiece)!.groupId === dragGroupId) {
                groupPids.push(pid);
            }
        }

        const dragSrcSlot = this._slots.indexOf(dragPid);
        const dragDstSlot = this._pointerToSlot(node.position.x, node.position.y);

        if (dragDstSlot < 0) {
            this._snapBackGroupTween(groupPids);
            return;
        }

        const dRow = Math.floor(dragDstSlot / this.pieceGrid)
            - Math.floor(dragSrcSlot / this.pieceGrid);
        const dCol = (dragDstSlot % this.pieceGrid) - (dragSrcSlot % this.pieceGrid);

        const srcSlots: number[] = [];
        const dstSlots: number[] = [];
        for (const pid of groupPids) {
            const srcSlot = this._slots.indexOf(pid);
            const srcRow = Math.floor(srcSlot / this.pieceGrid);
            const srcCol = srcSlot % this.pieceGrid;
            const dstRow = srcRow + dRow;
            const dstCol = srcCol + dCol;
            if (dstRow < 0 || dstRow >= this.pieceGrid
                || dstCol < 0 || dstCol >= this.pieceGrid) {
                this._snapBackGroupTween(groupPids);
                return;
            }
            srcSlots.push(srcSlot);
            dstSlots.push(dstRow * this.pieceGrid + dstCol);
        }

        // 集合差：自动消掉重叠部分，|displaceFrom| === |fillTo| 是数学保证。
        // 不用 Array.prototype.includes（ES2016）——indexOf 等价、ES5 lib 也能跑。
        const displaceFrom = dstSlots.filter(s => srcSlots.indexOf(s) === -1);
        const fillTo = srcSlots.filter(s => dstSlots.indexOf(s) === -1);

        // 先复制 + 全部读 → 全部写。被挤者必须从 OLD slots 读，不能从 newSlots 读。
        const newSlots = this._slots.slice();
        for (let i = 0; i < groupPids.length; i++) {
            newSlots[dstSlots[i]] = groupPids[i];
        }
        const displacedPids: number[] = [];
        for (let i = 0; i < displaceFrom.length; i++) {
            const dPid = this._slots[displaceFrom[i]];
            newSlots[fillTo[i]] = dPid;
            displacedPids.push(dPid);
        }
        this._slots = newSlots;

        console.log(
            `[PuzzleBoard] 整组搬运 — group=${dragGroupId}, ` +
            `groupPids=[${groupPids}], dRow=${dRow}, dCol=${dCol}, ` +
            `displaceFrom=[${displaceFrom}], fillTo=[${fillTo}]`,
        );

        // 锁输入 + 缓动所有移动块。inputLocked 必须**在所有 tween.start() 之前**置 true，
        // 不能等回调里设——否则 tween 第一帧前若有触摸事件会漏过早退。
        this._inputLocked = true;
        const allMovingPids = [...groupPids, ...displacedPids];
        for (const pid of allMovingPids) {
            const slot = this._slots.indexOf(pid);
            const { x, y } = this._slotToPosition(slot);
            tween(this._pieceNodes[pid])
                .to(this.tweenDuration, { position: new Vec3(x, y, 0) })
                .start();
        }

        // 单独"timer tween" 当事件总线——挂在 PuzzleBoard 自己 node 上（最稳的生命周期），
        // 不挂在某 piece node 上，避免那块在缓动期间被某种异常 destroy 导致回调不触发。
        // 不用 setTimeout：setTimeout 不绑节点生命周期、节点销毁了它还在跑，回调访问销毁节点 → crash。
        tween(this.node)
            .delay(this.tweenDuration)
            .call(() => this._commitAfterTween())
            .start();
    }

    /**
     * 缓动结束后的提交：清锁 + mergeScan + 胜利判定。
     *
     * try/finally 包一层——mergeScan 内部异常时锁仍能释放，避免"卡死永远不能拖"的灾难。
     */
    private _commitAfterTween(): void {
        try {
            this._resetAllPriorities();
            const { mergedAny, allInOneGroup } = this._mergeScan();
            if (mergedAny) {
                console.log('[PuzzleBoard] merge happened\n' + this._dumpBoard());
            }
            // !this._victorious 防止重复触发——理论上 mergeScan 仍返回 allInOneGroup=true，
            // 没这层早退就会反复触发 onWin。
            if (allInOneGroup && !this._victorious) {
                this._victorious = true;
                const elapsed = Date.now() - this._startTime;
                console.log(`[PuzzleBoard] 胜利！用时 ${(elapsed / 1000).toFixed(1)}s`);
                this.onWin?.(elapsed);
            }
        } finally {
            this._inputLocked = false;
        }
    }

    /**
     * 整组弹回原槽（缓动版）。越界 / 落点等于源时调。
     *
     * 简单做法：每个组员各自缓动回 slots.indexOf(pid) 算出来的位置，timer tween 当锁清除信号。
     */
    private _snapBackGroupTween(groupPids: number[]): void {
        this._inputLocked = true;
        for (const pid of groupPids) {
            const slot = this._slots.indexOf(pid);
            const { x, y } = this._slotToPosition(slot);
            tween(this._pieceNodes[pid])
                .to(this.tweenDuration, { position: new Vec3(x, y, 0) })
                .start();
        }
        tween(this.node)
            .delay(this.tweenDuration)
            .call(() => {
                this._resetAllPriorities();
                this._inputLocked = false;
            })
            .start();
    }
}
