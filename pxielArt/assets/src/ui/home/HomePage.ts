import {
    _decorator,
    Button,
    Color,
    Component,
    JsonAsset,
    Label,
    Layout,
    Mask,
    MaskType,
    Node,
    resources,
    ScrollView,
    Sprite,
    UITransform,
    view,
    Widget,
} from 'cc';
import { LevelManifest, LevelEntry } from '../../config/LevelManifest';
import { PuzzleData } from '../../types/types';
import { PuzzlePreview } from '../../util/PuzzlePreview';
import { LevelCard, LevelStatus } from './LevelCard';
import { StorageService } from '../../storage/StorageService';

const { ccclass } = _decorator;

const TOP_BAR_HEIGHT = 120;
const CARD_WIDTH = 320;
const CARD_HEIGHT = 380;
const CARD_GAP = 24;
const COLS = 2;
const SIDE_PADDING = 24;

@ccclass('HomePage')
export class HomePage extends Component {

    private _onSelectLevel: ((entry: LevelEntry) => void) | null = null;
    private _onMyWorks: (() => void) | null = null;

    private _scrollContent: Node | null = null;

    init(
        onSelectLevel: (entry: LevelEntry) => void,
        onMyWorks: () => void,
    ): void {
        this._onSelectLevel = onSelectLevel;
        this._onMyWorks = onMyWorks;
        this._build();
    }

    /** 从 GamePage 返回时调用：重建关卡列表以刷新状态徽章 */
    refreshList(): void {
        if (this._scrollContent) {
            this._scrollContent.removeAllChildren();
            this._loadAllLevels(this._scrollContent);
        }
    }

    private _build(): void {
        this.node.removeAllChildren();
        this._scrollContent = null;
        const vs = view.getVisibleSize();

        this._buildTopBar(vs.width);
        this._buildScroll(vs.width, vs.height);
    }

    /* ========== TopBar ========== */

    private _buildTopBar(viewW: number): void {
        const bar = new Node('TopBar');
        this.node.addChild(bar);
        const barUt = bar.addComponent(UITransform);
        barUt.setContentSize(viewW, TOP_BAR_HEIGHT);

        const w = bar.addComponent(Widget);
        w.isAlignTop = true;
        w.top = 0;
        w.isAlignLeft = true;
        w.left = 0;
        w.isAlignRight = true;
        w.right = 0;
        w.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;

        // 背景
        const bgNode = new Node('BarBg');
        bar.addChild(bgNode);
        const bgUt = bgNode.addComponent(UITransform);
        bgUt.setContentSize(viewW, TOP_BAR_HEIGHT);
        const bgSp = bgNode.addComponent(Sprite);
        bgSp.sizeMode = Sprite.SizeMode.CUSTOM;
        bgSp.color = new Color(245, 245, 245, 255);

        // 标题
        const titleNode = new Node('Title');
        bar.addChild(titleNode);
        titleNode.setPosition(0, -10, 0);
        const tUt = titleNode.addComponent(UITransform);
        tUt.setContentSize(300, 50);
        const titleLab = titleNode.addComponent(Label);
        titleLab.string = '选择关卡';
        titleLab.fontSize = 40;
        titleLab.horizontalAlign = Label.HorizontalAlign.CENTER;
        titleLab.verticalAlign = Label.VerticalAlign.CENTER;
        titleLab.color = new Color(50, 50, 50, 255);

        // "我的作品"按钮（预留）
        const myWorksNode = new Node('MyWorksBtn');
        bar.addChild(myWorksNode);
        myWorksNode.setPosition(viewW / 2 - 80, -10, 0);
        const mwUt = myWorksNode.addComponent(UITransform);
        mwUt.setContentSize(120, 50);
        const mwLab = myWorksNode.addComponent(Label);
        mwLab.string = '我的作品';
        mwLab.fontSize = 24;
        mwLab.horizontalAlign = Label.HorizontalAlign.CENTER;
        mwLab.verticalAlign = Label.VerticalAlign.CENTER;
        mwLab.color = new Color(100, 100, 100, 255);

        const mwBtn = myWorksNode.addComponent(Button);
        mwBtn.target = myWorksNode;
        mwBtn.transition = Button.Transition.SCALE;
        mwBtn.zoomScale = 0.9;
        mwBtn.node.on(Button.EventType.CLICK, () => this._onMyWorks?.());
    }

    /* ========== ScrollView ========== */

    private _buildScroll(viewW: number, viewH: number): void {
        const scrollH = viewH - TOP_BAR_HEIGHT;

        // ScrollView 节点
        const scrollNode = new Node('LevelScroll');
        this.node.addChild(scrollNode);
        scrollNode.setPosition(0, -TOP_BAR_HEIGHT / 2, 0);
        const svUt = scrollNode.addComponent(UITransform);
        svUt.setContentSize(viewW, scrollH);

        const sw = scrollNode.addComponent(Widget);
        sw.isAlignTop = true;
        sw.top = TOP_BAR_HEIGHT;
        sw.isAlignBottom = true;
        sw.bottom = 0;
        sw.isAlignLeft = true;
        sw.left = 0;
        sw.isAlignRight = true;
        sw.right = 0;
        sw.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;

        // Mask view
        const viewNode = new Node('view');
        scrollNode.addChild(viewNode);
        const vUt = viewNode.addComponent(UITransform);
        vUt.setContentSize(viewW, scrollH);
        viewNode.addComponent(Mask).type = MaskType.GRAPHICS_RECT;

        // Content
        const content = new Node('Content');
        viewNode.addChild(content);
        const cUt = content.addComponent(UITransform);
        cUt.setAnchorPoint(0.5, 1);
        content.setPosition(0, scrollH / 2, 0);

        const layout = content.addComponent(Layout);
        layout.type = Layout.Type.GRID;
        layout.resizeMode = Layout.ResizeMode.CONTAINER;
        layout.startAxis = Layout.AxisDirection.HORIZONTAL;
        layout.cellSize.set(CARD_WIDTH, CARD_HEIGHT);
        layout.spacingX = CARD_GAP;
        layout.spacingY = CARD_GAP;
        layout.paddingTop = CARD_GAP;
        layout.paddingBottom = CARD_GAP;
        layout.paddingLeft = SIDE_PADDING;
        layout.paddingRight = SIDE_PADDING;
        layout.constraint = Layout.Constraint.FIXED_COL;
        layout.constraintNum = COLS;

        const scroll = scrollNode.addComponent(ScrollView);
        scroll.content = content;
        scroll.horizontal = false;
        scroll.vertical = true;
        scroll.elastic = true;
        scroll.bounceDuration = 0.3;
        scroll.brake = 0.75;
        scroll.inertia = true;

        this._scrollContent = content;
        this._loadAllLevels(content);
    }

    /* ========== 加载关卡列表 ========== */

    private _loadAllLevels(content: Node): void {
        for (const entry of LevelManifest) {
            resources.load(entry.jsonPath, JsonAsset, (err, jsonAsset) => {
                if (err || !jsonAsset) return;
                const puzzle = jsonAsset.json as PuzzleData;
                const previewSF = PuzzlePreview.createSpriteFrame(puzzle);
                const status = this._getLevelStatus(entry.id);
                const card = LevelCard.create(
                    entry.name,
                    previewSF,
                    () => this._onSelectLevel?.(entry),
                    status,
                );
                content.addChild(card);
            });
        }
    }

    private _getLevelStatus(levelId: string): LevelStatus {
        if (StorageService.isLevelDone(levelId)) return 'done';
        if (StorageService.hasPaintRecord(levelId)) return 'progress';
        return 'new';
    }
}
