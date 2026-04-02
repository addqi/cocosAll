import {
    _decorator,
    Button,
    Color,
    Component,
    Label,
    Mask,
    Node,
    ScrollView,
    Sprite,
    SpriteFrame,
    UITransform,
    view,
} from 'cc';
import { BrushState } from '../../core/data/BrushState';

const { ccclass, property } = _decorator;

/**
 * 底部调色板：2 行 × 多列，横向 ScrollView；色块共用一张底图 + color 着色。
 * 与核心唯一交互：写入 BrushState.currentIndex。
 */
@ccclass('PalettePanel')
export class PalettePanel extends Component {
    @property
    itemWidth = 72;

    @property
    itemHeight = 72;

    @property
    itemSpacing = 10;

    @property
    padding = 12;

    private _brushState: BrushState | null = null;
    private _itemRoots: Node[] = [];
    private _selectedIndex = 0;
    private _palette: string[] = [];

    /**
     * @param palette   与谜题 palette 一致
     * @param brushState 当前画笔状态
     * @param itemFrame  色块底图（如 splash.png 的 SpriteFrame）
     */
    setup(palette: string[], brushState: BrushState, itemFrame: SpriteFrame): void {
        this._brushState = brushState;
        this._palette = palette;
        this.node.removeAllChildren();
        this._itemRoots = [];

        const viewW = view.getVisibleSize().width;
        const barH = this.padding * 2 + this.itemHeight * 2 + this.itemSpacing;

        const rootUt = this.node.getComponent(UITransform) || this.node.addComponent(UITransform);
        rootUt.setContentSize(viewW, barH);

        const cols = Math.ceil(palette.length / 2);
        const gridW = cols * this.itemWidth + Math.max(0, cols - 1) * this.itemSpacing;
        const gridH = this.itemHeight * 2 + this.itemSpacing;
        const contentW = gridW + this.padding * 2;
        const contentH = barH;

        const scrollNode = new Node('ScrollView');
        this.node.addChild(scrollNode);
        const svUt = scrollNode.addComponent(UITransform);
        svUt.setContentSize(viewW, barH);

        const viewNode = new Node('view');
        scrollNode.addChild(viewNode);
        const vUt = viewNode.addComponent(UITransform);
        vUt.setContentSize(viewW, barH);
        const mask = viewNode.addComponent(Mask);
        mask.type = Mask.Type.RECT;

        const content = new Node('content');
        viewNode.addChild(content);
        const cUt = content.addComponent(UITransform);
        cUt.setContentSize(contentW, contentH);
        cUt.setAnchorPoint(0, 0.5);
        content.setPosition(-viewW * 0.5, 0, 0);

        const scroll = scrollNode.addComponent(ScrollView);
        scroll.content = content;
        scroll.view = viewNode;
        scroll.horizontal = true;
        scroll.vertical = false;
        scroll.elastic = true;
        scroll.brake = 0.5;
        scroll.bounceDuration = 0.5;

        const ox = this.padding + this.itemWidth * 0.5;
        const oyTop = gridH * 0.5 - this.itemHeight * 0.5;
        const oyBot = -gridH * 0.5 + this.itemHeight * 0.5;

        for (let i = 0; i < palette.length; i++) {
            const col = Math.floor(i / 2);
            const row = i % 2;
            const x = ox + col * (this.itemWidth + this.itemSpacing);
            const y = row === 0 ? oyTop : oyBot;

            const item = new Node(`PaletteItem_${i}`);
            content.addChild(item);
            item.setPosition(x, y, 0);
            const iUt = item.addComponent(UITransform);
            iUt.setContentSize(this.itemWidth + 4, this.itemHeight + 4);

            const ring = new Node('Ring');
            item.addChild(ring);
            const rUt = ring.addComponent(UITransform);
            rUt.setContentSize(this.itemWidth + 8, this.itemHeight + 8);
            const ringSp = ring.addComponent(Sprite);
            ringSp.spriteFrame = itemFrame;
            ringSp.sizeMode = Sprite.SizeMode.CUSTOM;
            ringSp.color = new Color(40, 40, 40, 255);
            ring.active = i === brushState.currentIndex;

            const bg = new Node('Bg');
            item.addChild(bg);
            const bgUt = bg.addComponent(UITransform);
            bgUt.setContentSize(this.itemWidth, this.itemHeight);
            const sp = bg.addComponent(Sprite);
            sp.spriteFrame = itemFrame;
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
            sp.color = this._hexToColor(palette[i]);

            const labNode = new Node('Label');
            item.addChild(labNode);
            labNode.setPosition(0, 0, 0);
            const lUt = labNode.addComponent(UITransform);
            lUt.setContentSize(this.itemWidth, this.itemHeight);
            const lab = labNode.addComponent(Label);
            lab.string = String(i + 1);
            lab.fontSize = 26;
            lab.horizontalAlign = Label.HorizontalAlign.CENTER;
            lab.verticalAlign = Label.VerticalAlign.CENTER;
            lab.color = this._contrastLabelColor(sp.color);

            const idx = i;
            const btn = item.addComponent(Button);
            btn.target = item;
            btn.transition = Button.Transition.NONE;
            btn.node.on(Button.EventType.CLICK, () => {
                this._select(idx);
            });

            this._itemRoots.push(item);
        }

        this._selectedIndex = brushState.currentIndex;
    }

    private _select(index: number): void {
        if (!this._brushState) return;
        this._brushState.currentIndex = index;
        this._selectedIndex = index;
        for (let i = 0; i < this._itemRoots.length; i++) {
            const ringNode = this._itemRoots[i].getChildByName('Ring');
            if (ringNode) ringNode.active = i === index;
        }
    }

    private _hexToColor(hex: string): Color {
        let s = hex.trim();
        if (s.startsWith('#')) s = s.slice(1);
        const n = parseInt(s, 16);
        if (Number.isNaN(n) || s.length < 6) {
            return new Color(136, 136, 136, 255);
        }
        return new Color((n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff, 255);
    }

    /** 根据底色选黑/白字，保证可读 */
    private _contrastLabelColor(bg: Color): Color {
        const r = bg.r / 255;
        const g = bg.g / 255;
        const b = bg.b / 255;
        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        return luminance > 0.55 ? new Color(30, 30, 30, 255) : new Color(255, 255, 255, 255);
    }
}
