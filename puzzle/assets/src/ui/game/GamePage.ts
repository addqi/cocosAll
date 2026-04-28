import {
    _decorator, Button, Color, Component, Label, Material, Node,
    Sprite, SpriteFrame, UITransform, view, Widget,
} from 'cc';
import { BundleManager } from '../../config/BundleManager';
import {
    LevelEntry, DIFFICULTIES, DEFAULT_DIFFICULTY_INDEX, BOARD_FILL_RATIO,
} from '../../config/Level';
import { PuzzleBoard } from '../../puzzle/PuzzleBoard';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { WinDialog } from '../common/WinDialog';
import { getWhitePixelSF } from '../../util/WhitePixel';

const { ccclass } = _decorator;

const TOP_BAR_HEIGHT = 120;
const SKIP_DIFF_CONFIRM_KEY = 'puzzle.skipDiffConfirm';

/**
 * [08 节] 共享 piece material 路径——bundle 内 effects/puzzle-piece.mtl。
 *
 * 加载流程（GamePage._ensurePieceMaterial）：
 *   1. 第一次调时 await BundleManager.loadMaterial(此路径)
 *   2. 成功 → 缓存到 _pieceMatPromise，后续所有 startLevel 复用
 *   3. 失败（用户没在编辑器创建 .mtl）→ 缓存 Promise<null>，PuzzleBoard fallback
 *      到 01 节路径，**只警告一次**——别每关都狂喷 console
 */
const PIECE_MATERIAL_PATH = 'effects/puzzle-piece';
let _pieceMatPromise: Promise<Material | null> | null = null;

/** 难度区布局常量——一处改全局对齐自动跟着走。 */
const DIFF_BTN_W = 70;
const DIFF_LABEL_W = 160;
const DIFF_GAP = 12;

/**
 * 游戏页。
 *
 * 流程：
 *   AppRoot.showGame(entry) → startLevel(entry)
 *   → 加载图 → 用当前 _diffIdx 对应的 gridSize 渲染
 *   → 顶栏"难度"按钮可循环切换难度，切换即重开本关
 *
 * 难度状态保存在本组件，跨关卡保留——玩家选了 5×5，下一关默认还是 5×5。
 */
@ccclass('GamePage')
export class GamePage extends Component {

    private _onBack: (() => void) | null = null;
    private _titleLabel: Label | null = null;
    private _diffLabel: Label | null = null;
    private _diffMinusBtn: Button | null = null;
    private _diffPlusBtn: Button | null = null;
    private _diffMinusSp: Sprite | null = null;
    private _diffPlusSp: Sprite | null = null;
    private _boardRoot: Node | null = null;
    private _board: PuzzleBoard | null = null;

    private _entry: LevelEntry | null = null;
    private _findNextEntry: ((current: LevelEntry) => LevelEntry | null) | null = null;
    private _sf: SpriteFrame | null = null;
    /** [08 节] 共享 piece material；null = 走 01 路径。startLevel 注入。 */
    private _pieceMaterial: Material | null = null;
    private _diffIdx: number = DEFAULT_DIFFICULTY_INDEX;

    /**
     * 初始化。AppRoot 注入两个回调：
     *   - onBack：玩家点返回 / 胜利窗"返回首页"
     *   - findNextEntry：求下一关 entry，最后一关返回 null。GamePage 不感知关卡序列。
     */
    init(onBack: () => void, findNextEntry: (current: LevelEntry) => LevelEntry | null): void {
        this._onBack = onBack;
        this._findNextEntry = findNextEntry;
        this._build();
    }

    async startLevel(entry: LevelEntry): Promise<void> {
        this._entry = entry;
        if (this._titleLabel) this._titleLabel.string = entry.name;
        this._updateDiffLabel();

        try {
            // 并行加载图和 material——material 找不到 fallback 到 null（01 路径），
            // 不 block startLevel 正常流程。
            const [sf, mat] = await Promise.all([
                BundleManager.loadImageSF(entry.imagePath),
                this._ensurePieceMaterial(),
            ]);
            this._sf = sf;
            this._pieceMaterial = mat;
            this._mountBoard();
        } catch (e) {
            console.error('[GamePage] startLevel failed:', e);
            if (this._titleLabel) this._titleLabel.string = `加载失败: ${entry.name}`;
        }
    }

    /**
     * 确保 piece material 加载状态。模块级 Promise 缓存——多次 startLevel 共享。
     *
     * 找不到时**只警告一次**：用户没在编辑器创建 .mtl 是合法状态（走 01 路径），
     * 不该当 error 处理。
     */
    private _ensurePieceMaterial(): Promise<Material | null> {
        if (!_pieceMatPromise) {
            _pieceMatPromise = BundleManager.loadMaterial(PIECE_MATERIAL_PATH).then(mat => {
                if (!mat) {
                    console.warn(
                        `[GamePage] piece material 未找到（${PIECE_MATERIAL_PATH}）。` +
                        `走 01 节简单切片路径——无圆角/边框/合并接缝消失视觉。` +
                        `\n  启用 08 节视觉的方法：在 Cocos 编辑器右键 ` +
                        `assets/game-bundle/effects/puzzle-piece.effect → Create / Material，` +
                        `命名为 puzzle-piece.mtl，重启游戏即可。`,
                    );
                }
                return mat;
            });
        }
        return _pieceMatPromise;
    }

    cleanup(): void {
        if (this._boardRoot) this._boardRoot.removeAllChildren();
        if (this._board) this._board.onWin = null;
        this._board = null;
        this._sf = null;
        this._entry = null;
    }

    /* ── UI 构建 ── */

    private _build(): void {
        this.node.removeAllChildren();
        const vs = view.getVisibleSize();
        this._buildTopBar(vs.width);
        this._buildBoardRoot(vs.width, vs.height);
    }

    private _buildTopBar(viewW: number): void {
        const sf = getWhitePixelSF();

        const bar = new Node('TopBar');
        this.node.addChild(bar);
        bar.addComponent(UITransform).setContentSize(viewW, TOP_BAR_HEIGHT);
        const w = bar.addComponent(Widget);
        w.isAlignTop = true; w.top = 0;
        w.isAlignLeft = true; w.left = 0;
        w.isAlignRight = true; w.right = 0;
        w.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;

        const bg = new Node('Bg');
        bar.addChild(bg);
        bg.addComponent(UITransform).setContentSize(viewW, TOP_BAR_HEIGHT);
        const bgSp = bg.addComponent(Sprite);
        bgSp.sizeMode = Sprite.SizeMode.CUSTOM;
        bgSp.spriteFrame = sf;
        bgSp.color = new Color(245, 245, 245, 255);

        // 返回按钮（左）
        const back = new Node('BackBtn');
        bar.addChild(back);
        back.setPosition(-viewW / 2 + 70, 0, 0);
        back.addComponent(UITransform).setContentSize(110, 70);
        const bl = back.addComponent(Label);
        bl.string = '< 返回';
        bl.fontSize = 32;
        bl.horizontalAlign = Label.HorizontalAlign.CENTER;
        bl.verticalAlign = Label.VerticalAlign.CENTER;
        bl.color = new Color(80, 80, 80, 255);
        const btn = back.addComponent(Button);
        btn.target = back;
        btn.transition = Button.Transition.SCALE;
        btn.zoomScale = 0.9;
        btn.node.on(Button.EventType.CLICK, () => this._onBack?.());

        // 标题（中——置于返回按钮右侧、难度区左侧之间，避免重叠）
        const title = new Node('Title');
        bar.addChild(title);
        title.setPosition(-110, 0, 0);
        title.addComponent(UITransform).setContentSize(220, 60);
        const tl = title.addComponent(Label);
        tl.string = '';
        tl.fontSize = 36;
        // 长关卡名（如 liuying1）比 Title 宽，用 SHRINK 自适应缩字，避免被截
        tl.overflow = Label.Overflow.SHRINK;
        tl.horizontalAlign = Label.HorizontalAlign.CENTER;
        tl.verticalAlign = Label.VerticalAlign.CENTER;
        tl.color = new Color(50, 50, 50, 255);
        this._titleLabel = tl;

        // 难度区（右）：[−] 难度 X×X [+]
        // 从右往左排：plus → label → minus
        const groupRightEdge = viewW / 2 - 20;
        const plusX = groupRightEdge - DIFF_BTN_W / 2;
        const labelX = plusX - DIFF_BTN_W / 2 - DIFF_GAP - DIFF_LABEL_W / 2;
        const minusX = labelX - DIFF_LABEL_W / 2 - DIFF_GAP - DIFF_BTN_W / 2;

        const plus = this._buildDiffButton(bar, '+', plusX, () => this._changeDifficulty(+1));
        this._diffPlusBtn = plus.btn;
        this._diffPlusSp = plus.sp;

        const labelNode = new Node('DiffLabel');
        bar.addChild(labelNode);
        labelNode.setPosition(labelX, 0, 0);
        labelNode.addComponent(UITransform).setContentSize(DIFF_LABEL_W, 70);
        const dl = labelNode.addComponent(Label);
        dl.string = '难度 3×3';
        dl.fontSize = 30;
        dl.horizontalAlign = Label.HorizontalAlign.CENTER;
        dl.verticalAlign = Label.VerticalAlign.CENTER;
        dl.color = new Color(50, 50, 50, 255);
        this._diffLabel = dl;

        const minus = this._buildDiffButton(bar, '−', minusX, () => this._changeDifficulty(-1));
        this._diffMinusBtn = minus.btn;
        this._diffMinusSp = minus.sp;
    }

    private _buildDiffButton(
        parent: Node, text: string, x: number, onClick: () => void,
    ): { btn: Button; sp: Sprite } {
        const sf = getWhitePixelSF();
        const node = new Node(`DiffBtn_${text}`);
        parent.addChild(node);
        node.setPosition(x, 0, 0);
        node.addComponent(UITransform).setContentSize(DIFF_BTN_W, 70);
        const sp = node.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.spriteFrame = sf;
        sp.color = new Color(255, 200, 100, 255);

        const labNode = new Node('Label');
        node.addChild(labNode);
        labNode.addComponent(UITransform).setContentSize(DIFF_BTN_W, 70);
        const lab = labNode.addComponent(Label);
        lab.string = text;
        lab.fontSize = 44;
        lab.horizontalAlign = Label.HorizontalAlign.CENTER;
        lab.verticalAlign = Label.VerticalAlign.CENTER;
        lab.color = new Color(80, 60, 30, 255);

        const btn = node.addComponent(Button);
        btn.target = node;
        btn.transition = Button.Transition.SCALE;
        btn.zoomScale = 0.9;
        btn.node.on(Button.EventType.CLICK, onClick);
        return { btn, sp };
    }

    private _buildBoardRoot(viewW: number, viewH: number): void {
        const root = new Node('BoardRoot');
        this.node.addChild(root);
        root.setPosition(0, -TOP_BAR_HEIGHT / 2, 0);
        root.addComponent(UITransform).setContentSize(viewW, viewH - TOP_BAR_HEIGHT);
        this._boardRoot = root;
    }

    /* ── 难度切换 ── */

    /**
     * 升 / 降一档难度。
     *
     * 流程：
     *   1. 边界检查（到顶/到底直接返回）
     *   2. 若用户没勾过"不再显示"——弹确认窗
     *   3. 用户确认 → 应用新难度 + 重洗（_mountBoard 重建 PuzzleBoard）
     *   4. 用户勾了"不再显示"且确认 → 写 sys.localStorage，下次跳过
     *
     * @param dir +1 = 升档，-1 = 降档
     */
    private async _changeDifficulty(dir: 1 | -1): Promise<void> {
        const next = this._diffIdx + dir;
        if (next < 0 || next >= DIFFICULTIES.length) return;

        if (!ConfirmDialog.shouldSkip(SKIP_DIFF_CONFIRM_KEY)) {
            const result = await ConfirmDialog.show(
                this.node,
                '修改难度',
                '修改难度会打乱当前排序，确定吗？',
            );
            if (!result.confirmed) return;
            if (result.dontAskAgain) ConfirmDialog.markSkip(SKIP_DIFF_CONFIRM_KEY);
        }

        this._diffIdx = next;
        this._updateDiffLabel();
        if (this._sf) this._mountBoard();
    }

    private _updateDiffLabel(): void {
        if (!this._diffLabel) return;
        const n = DIFFICULTIES[this._diffIdx];
        this._diffLabel.string = `难度 ${n}×${n}`;

        const atMin = this._diffIdx === 0;
        const atMax = this._diffIdx === DIFFICULTIES.length - 1;
        this._setBtnEnabled(this._diffMinusBtn, this._diffMinusSp, !atMin);
        this._setBtnEnabled(this._diffPlusBtn, this._diffPlusSp, !atMax);
    }

    private _setBtnEnabled(btn: Button | null, sp: Sprite | null, enabled: boolean): void {
        if (btn) btn.interactable = enabled;
        if (sp) sp.color = enabled
            ? new Color(255, 200, 100, 255)
            : new Color(220, 220, 220, 255);
    }

    /* ── 挂载 PuzzleBoard ── */

    /**
     * boardSize 自适应——一行公式，无特殊情况。
     *
     *   boardSize = floor(min(屏宽, 屏高) × BOARD_FILL_RATIO / grid) × grid
     *
     * 屏短边 × 0.8 = 拼图边长，向 grid 取整下界保证 boardSize % grid == 0
     *（否则 pieceDisplay 出现非整数像素，相邻块会出现 1px 缝隙）。
     *
     * 不再扣 TopBar / margin——竖屏 H/W ≈ 16/9，短边乘 0.8 已留够余量，
     * TopBar 是布局问题，不该污染尺寸计算。
     */
    private _mountBoard(): void {
        if (!this._boardRoot || !this._sf) return;
        this._boardRoot.removeAllChildren();

        const vs = view.getVisibleSize();
        const grid = DIFFICULTIES[this._diffIdx];
        const boardSize = Math.floor(Math.min(vs.width, vs.height) * BOARD_FILL_RATIO / grid) * grid;

        const node = new Node('PuzzleBoard');
        this._boardRoot.addChild(node);
        node.addComponent(UITransform).setContentSize(boardSize, boardSize);

        const pieceLayer = new Node('PieceLayer');
        node.addChild(pieceLayer);
        pieceLayer.addComponent(UITransform).setContentSize(boardSize, boardSize);

        // 拖动专用层——永远在 PieceLayer 之上（sibling 更大）。
        // 拖一组时整组 reparent 进来，commit 后 reparent 回去。
        // 不靠 setSiblingIndex 在同层挪——cocos 3.8 sprite batcher 在合批模式下
        // 内部 vertex buffer 的实际绘制顺序对 setSiblingIndex 不严格响应，
        // 视觉上"被拖块仍被其他块挡"的诡异现象就出在这里。两层物理隔离最干净。
        const dragLayer = new Node('DragLayer');
        node.addChild(dragLayer);
        dragLayer.addComponent(UITransform).setContentSize(boardSize, boardSize);

        this._board = node.addComponent(PuzzleBoard);
        this._board.sourceImage = this._sf;
        this._board.boardSize = boardSize;
        this._board.pieceGrid = grid;
        this._board.pieceMaterial = this._pieceMaterial;
        this._board.onWin = (elapsedMs) => this._showWinDialog(elapsedMs);
        this._board.render();
    }

    /* ── 胜利结算 ── */

    /**
     * 弹胜利窗。三按钮：返回首页 / 再来一次 / 下一关。
     *
     * "下一关"的下一关靠 _findNextEntry 现问 AppRoot——所以连续通关多关都能继续，
     * 不需要 GamePage 持有关卡序列。
     */
    private _showWinDialog(elapsedMs: number): void {
        if (!this._entry) return;
        const seconds = (elapsedMs / 1000).toFixed(1);
        const levelName = `${this._entry.name}  ·  用时 ${seconds}s`;
        const next = this._findNextEntry?.(this._entry) ?? null;

        WinDialog.show(this.node, levelName, {
            onBack: () => this._onBack?.(),
            onRetry: () => {
                if (this._board) this._board.restart();
            },
            onNext: next ? () => this.startLevel(next) : null,
        });
    }
}
