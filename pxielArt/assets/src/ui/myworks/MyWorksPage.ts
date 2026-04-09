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
    SpriteFrame,
    UITransform,
    view,
    Widget,
} from 'cc';
import { LevelManifest, LevelEntry } from '../../config/LevelManifest';
import { PuzzleData } from '../../types/types';
import { BoardData } from '../../core/data/BoardData';
import { PuzzlePreview } from '../../util/PuzzlePreview';
import { StorageService } from '../../storage/StorageService';

const { ccclass } = _decorator;

const TOP_BAR_HEIGHT = 120;
const CARD_WIDTH = 320;
const CARD_HEIGHT = 380;
const CARD_GAP = 24;
const COLS = 2;
const SIDE_PADDING = 24;
const PREVIEW_SIZE = 280;

@ccclass('MyWorksPage')
export class MyWorksPage extends Component {

    private _onBack: (() => void) | null = null;
    private _scrollContent: Node | null = null;
    private _emptyHint: Node | null = null;
    private _popupLayer: Node | null = null;

    init(onBack: () => void): void {
        this._onBack = onBack;
        this._build();
    }

    refreshList(): void {
        if (this._scrollContent) {
            this._scrollContent.removeAllChildren();
        }
        this._dismissPopup();
        this._loadCompletedWorks();
    }

    /* ========== 构建 ========== */

    private _build(): void {
        this.node.removeAllChildren();
        this._scrollContent = null;
        this._emptyHint = null;
        this._popupLayer = null;
        const vs = view.getVisibleSize();

        this._buildTopBar(vs.width);
        this._buildScroll(vs.width, vs.height);
        this._buildEmptyHint(vs.width, vs.height);
        this._buildPopupLayer(vs.width, vs.height);
    }

    /* ── TopBar ── */

    private _buildTopBar(viewW: number): void {
        const bar = new Node('TopBar');
        this.node.addChild(bar);
        const barUt = bar.addComponent(UITransform);
        barUt.setContentSize(viewW, TOP_BAR_HEIGHT);

        const w = bar.addComponent(Widget);
        w.isAlignTop = true;    w.top = 0;
        w.isAlignLeft = true;   w.left = 0;
        w.isAlignRight = true;  w.right = 0;
        w.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;

        const bgNode = new Node('BarBg');
        bar.addChild(bgNode);
        bgNode.addComponent(UITransform).setContentSize(viewW, TOP_BAR_HEIGHT);
        const bgSp = bgNode.addComponent(Sprite);
        bgSp.sizeMode = Sprite.SizeMode.CUSTOM;
        bgSp.color = new Color(245, 245, 245, 255);

        const titleNode = new Node('Title');
        bar.addChild(titleNode);
        titleNode.setPosition(0, -10, 0);
        titleNode.addComponent(UITransform).setContentSize(300, 50);
        const titleLab = titleNode.addComponent(Label);
        titleLab.string = '我的作品';
        titleLab.fontSize = 40;
        titleLab.horizontalAlign = Label.HorizontalAlign.CENTER;
        titleLab.verticalAlign = Label.VerticalAlign.CENTER;
        titleLab.color = new Color(50, 50, 50, 255);

        const backNode = new Node('BackBtn');
        bar.addChild(backNode);
        backNode.setPosition(-viewW / 2 + 60, -10, 0);
        backNode.addComponent(UITransform).setContentSize(100, 50);
        const backLab = backNode.addComponent(Label);
        backLab.string = '< 返回';
        backLab.fontSize = 28;
        backLab.horizontalAlign = Label.HorizontalAlign.CENTER;
        backLab.verticalAlign = Label.VerticalAlign.CENTER;
        backLab.color = new Color(100, 100, 100, 255);

        const backBtn = backNode.addComponent(Button);
        backBtn.target = backNode;
        backBtn.transition = Button.Transition.SCALE;
        backBtn.zoomScale = 0.9;
        backBtn.node.on(Button.EventType.CLICK, () => this._onBack?.());
    }

    /* ── ScrollView ── */

    private _buildScroll(viewW: number, viewH: number): void {
        const scrollH = viewH - TOP_BAR_HEIGHT;

        const scrollNode = new Node('WorksScroll');
        this.node.addChild(scrollNode);
        scrollNode.setPosition(0, -TOP_BAR_HEIGHT / 2, 0);
        scrollNode.addComponent(UITransform).setContentSize(viewW, scrollH);

        const sw = scrollNode.addComponent(Widget);
        sw.isAlignTop = true;    sw.top = TOP_BAR_HEIGHT;
        sw.isAlignBottom = true; sw.bottom = 0;
        sw.isAlignLeft = true;   sw.left = 0;
        sw.isAlignRight = true;  sw.right = 0;
        sw.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;

        const viewNode = new Node('view');
        scrollNode.addChild(viewNode);
        viewNode.addComponent(UITransform).setContentSize(viewW, scrollH);
        viewNode.addComponent(Mask).type = MaskType.GRAPHICS_RECT;

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
    }

    /* ── 空状态 ── */

    private _buildEmptyHint(viewW: number, viewH: number): void {
        const hint = new Node('EmptyHint');
        this.node.addChild(hint);
        hint.addComponent(UITransform).setContentSize(viewW, viewH);
        hint.active = false;

        const labNode = new Node('HintLabel');
        hint.addChild(labNode);
        labNode.setPosition(0, 40, 0);
        labNode.addComponent(UITransform).setContentSize(400, 60);
        const lab = labNode.addComponent(Label);
        lab.string = '还没有完成的作品';
        lab.fontSize = 32;
        lab.horizontalAlign = Label.HorizontalAlign.CENTER;
        lab.verticalAlign = Label.VerticalAlign.CENTER;
        lab.color = new Color(160, 160, 160, 255);

        const btnNode = new Node('GoBtn');
        hint.addChild(btnNode);
        btnNode.setPosition(0, -30, 0);
        btnNode.addComponent(UITransform).setContentSize(200, 56);
        const btnSp = btnNode.addComponent(Sprite);
        btnSp.sizeMode = Sprite.SizeMode.CUSTOM;
        btnSp.color = new Color(76, 175, 80, 255);

        const btnLab = new Node('Label');
        btnNode.addChild(btnLab);
        btnLab.addComponent(UITransform).setContentSize(200, 56);
        const bl = btnLab.addComponent(Label);
        bl.string = '去挑战';
        bl.fontSize = 26;
        bl.horizontalAlign = Label.HorizontalAlign.CENTER;
        bl.verticalAlign = Label.VerticalAlign.CENTER;
        bl.color = Color.WHITE;

        const btn = btnNode.addComponent(Button);
        btn.target = btnNode;
        btn.transition = Button.Transition.SCALE;
        btn.zoomScale = 0.9;
        btn.node.on(Button.EventType.CLICK, () => this._onBack?.());

        this._emptyHint = hint;
    }

    /* ── 弹窗层 ── */

    private _buildPopupLayer(viewW: number, viewH: number): void {
        const layer = new Node('PopupLayer');
        this.node.addChild(layer);
        layer.addComponent(UITransform).setContentSize(viewW, viewH);
        layer.active = false;
        this._popupLayer = layer;
    }

    /* ========== 数据加载 ========== */

    private _loadCompletedWorks(): void {
        const doneEntries: LevelEntry[] = [];
        for (const entry of LevelManifest) {
            if (StorageService.isLevelDone(entry.id)) {
                doneEntries.push(entry);
            }
        }

        if (this._emptyHint) {
            this._emptyHint.active = doneEntries.length === 0;
        }

        for (const entry of doneEntries) {
            resources.load(entry.jsonPath, JsonAsset, (err, jsonAsset) => {
                if (err || !jsonAsset) return;
                const puzzle = jsonAsset.json as PuzzleData;
                const previewSF = this._createColorPreview(puzzle);
                const card = this._createWorkCard(entry.name, previewSF);
                this._scrollContent?.addChild(card);
            });
        }
    }

    /** 已完成关卡：所有非空格子都视为已涂色 → 全彩预览 */
    private _createColorPreview(puzzle: PuzzleData): SpriteFrame {
        const flat = BoardData.rleDecode(puzzle.pixels);
        const total = puzzle.gridSize * puzzle.gridSize;
        const paintedSet = new Set<number>();
        for (let i = 0; i < total; i++) {
            const bi = i < flat.length ? flat[i] : -1;
            if (bi >= 0) paintedSet.add(i);
        }
        return PuzzlePreview.createSpriteFrame(puzzle, paintedSet);
    }

    /* ========== 卡片 ========== */

    private _createWorkCard(name: string, previewFrame: SpriteFrame): Node {
        const root = new Node(`WorkCard_${name}`);
        root.addComponent(UITransform).setContentSize(CARD_WIDTH, CARD_HEIGHT);

        const bg = new Node('Bg');
        root.addChild(bg);
        bg.addComponent(UITransform).setContentSize(CARD_WIDTH, CARD_HEIGHT);
        const bgSp = bg.addComponent(Sprite);
        bgSp.sizeMode = Sprite.SizeMode.CUSTOM;
        bgSp.color = Color.WHITE;

        const preview = new Node('Preview');
        root.addChild(preview);
        preview.setPosition(0, (CARD_HEIGHT - PREVIEW_SIZE) / 2 - 10, 0);
        preview.addComponent(UITransform).setContentSize(PREVIEW_SIZE, PREVIEW_SIZE);
        const pvSp = preview.addComponent(Sprite);
        pvSp.sizeMode = Sprite.SizeMode.CUSTOM;
        pvSp.spriteFrame = previewFrame;

        const labelNode = new Node('Name');
        root.addChild(labelNode);
        labelNode.setPosition(0, -CARD_HEIGHT / 2 + 30, 0);
        labelNode.addComponent(UITransform).setContentSize(CARD_WIDTH, 40);
        const lab = labelNode.addComponent(Label);
        lab.string = name;
        lab.fontSize = 28;
        lab.horizontalAlign = Label.HorizontalAlign.CENTER;
        lab.verticalAlign = Label.VerticalAlign.CENTER;
        lab.color = new Color(50, 50, 50, 255);

        const btn = root.addComponent(Button);
        btn.target = root;
        btn.transition = Button.Transition.SCALE;
        btn.zoomScale = 0.95;
        btn.node.on(Button.EventType.CLICK, () => this._showPreviewPopup(name, previewFrame));

        return root;
    }

    /* ========== 全屏预览弹窗 ========== */

    private _showPreviewPopup(name: string, frame: SpriteFrame): void {
        const layer = this._popupLayer;
        if (!layer) return;
        layer.removeAllChildren();
        layer.active = true;

        const vs = view.getVisibleSize();

        const overlay = new Node('Overlay');
        layer.addChild(overlay);
        overlay.addComponent(UITransform).setContentSize(vs.width, vs.height);
        const oSp = overlay.addComponent(Sprite);
        oSp.sizeMode = Sprite.SizeMode.CUSTOM;
        oSp.color = new Color(0, 0, 0, 180);
        const oBtn = overlay.addComponent(Button);
        oBtn.target = overlay;
        oBtn.transition = Button.Transition.NONE;
        oBtn.node.on(Button.EventType.CLICK, () => this._dismissPopup());

        const imgSize = Math.min(vs.width, vs.height) * 0.75;

        const imgNode = new Node('FullPreview');
        layer.addChild(imgNode);
        imgNode.setPosition(0, 30, 0);
        imgNode.addComponent(UITransform).setContentSize(imgSize, imgSize);
        const imgSp = imgNode.addComponent(Sprite);
        imgSp.sizeMode = Sprite.SizeMode.CUSTOM;
        imgSp.spriteFrame = frame;

        const titleNode = new Node('Title');
        layer.addChild(titleNode);
        titleNode.setPosition(0, -imgSize / 2 - 10, 0);
        titleNode.addComponent(UITransform).setContentSize(400, 50);
        const titleLab = titleNode.addComponent(Label);
        titleLab.string = name;
        titleLab.fontSize = 36;
        titleLab.horizontalAlign = Label.HorizontalAlign.CENTER;
        titleLab.verticalAlign = Label.VerticalAlign.CENTER;
        titleLab.color = Color.WHITE;

        const closeNode = new Node('CloseBtn');
        layer.addChild(closeNode);
        closeNode.setPosition(0, -imgSize / 2 - 70, 0);
        closeNode.addComponent(UITransform).setContentSize(160, 50);
        const closeSp = closeNode.addComponent(Sprite);
        closeSp.sizeMode = Sprite.SizeMode.CUSTOM;
        closeSp.color = new Color(255, 255, 255, 40);

        const closeLab = new Node('Label');
        closeNode.addChild(closeLab);
        closeLab.addComponent(UITransform).setContentSize(160, 50);
        const cl = closeLab.addComponent(Label);
        cl.string = '关闭';
        cl.fontSize = 28;
        cl.horizontalAlign = Label.HorizontalAlign.CENTER;
        cl.verticalAlign = Label.VerticalAlign.CENTER;
        cl.color = Color.WHITE;

        const closeBtn = closeNode.addComponent(Button);
        closeBtn.target = closeNode;
        closeBtn.transition = Button.Transition.SCALE;
        closeBtn.zoomScale = 0.9;
        closeBtn.node.on(Button.EventType.CLICK, () => this._dismissPopup());
    }

    private _dismissPopup(): void {
        if (this._popupLayer) {
            this._popupLayer.removeAllChildren();
            this._popupLayer.active = false;
        }
    }
}
