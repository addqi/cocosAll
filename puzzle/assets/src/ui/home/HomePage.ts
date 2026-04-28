import {
    _decorator, Color, Component, Label, Layout, Mask, MaskType,
    Node, ScrollView, Sprite, UITransform, view, Widget,
} from 'cc';
import { BundleManager } from '../../config/BundleManager';
import { LevelEntry } from '../../config/Level';
import { LevelCard } from './LevelCard';
import { getWhitePixelSF } from '../../util/WhitePixel';

const { ccclass } = _decorator;

const TOP_BAR_HEIGHT = 120;
const CARD_WIDTH = 320;
const CARD_HEIGHT = 380;
const CARD_GAP = 24;
const COLS = 2;
const SIDE_PADDING = 24;

/**
 * 选关页。
 *
 * 卡片从 BundleManager.listLevels() 来，扫 game-bundle/images/ 自动生成。
 * 难度不在这里选——点击卡片直接进 GamePage，难度在游戏内顶栏切换。
 */
@ccclass('HomePage')
export class HomePage extends Component {

    private _onSelect: ((entry: LevelEntry) => void) | null = null;
    private _content: Node | null = null;

    init(onSelect: (entry: LevelEntry) => void): void {
        this._onSelect = onSelect;
        this._build();
    }

    refreshList(): void {
        if (!this._content) return;
        this._content.removeAllChildren();
        this._fillCards(this._content);
    }

    private _build(): void {
        this.node.removeAllChildren();
        const vs = view.getVisibleSize();
        this._buildTopBar(vs.width);
        this._buildScroll(vs.width, vs.height);
        if (this._content) this._fillCards(this._content);
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

        const title = new Node('Title');
        bar.addChild(title);
        title.setPosition(0, -10, 0);
        title.addComponent(UITransform).setContentSize(300, 50);
        const tl = title.addComponent(Label);
        tl.string = '选择关卡';
        tl.fontSize = 40;
        tl.horizontalAlign = Label.HorizontalAlign.CENTER;
        tl.verticalAlign = Label.VerticalAlign.CENTER;
        tl.color = new Color(50, 50, 50, 255);
    }

    private _buildScroll(viewW: number, viewH: number): void {
        const scrollH = viewH - TOP_BAR_HEIGHT;

        const scrollNode = new Node('LevelScroll');
        this.node.addChild(scrollNode);
        scrollNode.setPosition(0, -TOP_BAR_HEIGHT / 2, 0);
        scrollNode.addComponent(UITransform).setContentSize(viewW, scrollH);
        const sw = scrollNode.addComponent(Widget);
        sw.isAlignTop = true; sw.top = TOP_BAR_HEIGHT;
        sw.isAlignBottom = true; sw.bottom = 0;
        sw.isAlignLeft = true; sw.left = 0;
        sw.isAlignRight = true; sw.right = 0;
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

        this._content = content;
    }

    private _fillCards(content: Node): void {
        const levels = BundleManager.isLoaded ? BundleManager.listLevels() : [];

        if (levels.length === 0) {
            const empty = new Node('Empty');
            content.addChild(empty);
            empty.addComponent(UITransform).setContentSize(CARD_WIDTH, CARD_HEIGHT);
            const lab = empty.addComponent(Label);
            lab.string = '暂无关卡\n把图扔进 game-bundle/images/\n即可';
            lab.fontSize = 22;
            lab.horizontalAlign = Label.HorizontalAlign.CENTER;
            lab.verticalAlign = Label.VerticalAlign.CENTER;
            lab.color = new Color(150, 150, 150, 255);
            return;
        }

        for (const entry of levels) {
            const card = LevelCard.create(
                entry.name,
                null,
                () => this._onSelect?.(entry),
                { width: CARD_WIDTH, height: CARD_HEIGHT, previewSize: CARD_HEIGHT - 100 },
            );
            content.addChild(card);

            BundleManager.loadImageSF(entry.imagePath)
                .then(sf => {
                    if (!card.isValid) return;
                    const preview = card.getChildByName('Preview');
                    if (!preview) return;
                    const sp = preview.getComponent(Sprite);
                    if (sp) {
                        sp.spriteFrame = sf;
                        sp.color = new Color(255, 255, 255, 255);
                    }
                })
                .catch(e => console.warn('[HomePage] preview load failed:', entry.imagePath, e));
        }
    }
}
