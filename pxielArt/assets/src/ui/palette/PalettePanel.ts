import {
    _decorator,
    Button,
    Color,
    Component,
    Label,
    Mask,
    MaskType,
    Node,
    ScrollView,
    Sprite,
    SpriteFrame,
    UITransform,
    view,
} from 'cc';
import { BrushState } from '../../core/data/BrushState';

const { ccclass, property } = _decorator;

/** 运行时 / setup 传入的布局与样式（2×2 等小图靠 CUSTOM 尺寸放大显示） */
export interface PalettePanelOptions {
    itemWidth?: number;
    itemHeight?: number;
    itemSpacing?: number;
    padding?: number;
    labelFontSize?: number;
    /** 选中描边环的 Sprite 着色 */
    ringColor?: Color;
    /** 描环比色块每边多出的像素（环节点比色块大 2×该值） */
    ringOutset?: number;
    /** 根节点比色块每边多出的像素（扩大点击与描环占位） */
    itemRootOutset?: number;
    /** 数字颜色；不设且 useContrastLabel 为 true 时自动黑/白 */
    labelColor?: Color | null;
    useContrastLabel?: boolean;
    /** 选中色块后回调（如刷新 G15 ZoomFade 盘面高亮） */
    onBrushIndexChanged?: () => void;
}

/**
 * 底部调色板：2 行 × 多列，横向 ScrollView；色块共用一张底图 + color 着色。
 * 与核心唯一交互：写入 BrushState.currentIndex。
 */
@ccclass('PalettePanel')
export class PalettePanel extends Component {
    @property({ displayName: '色块显示宽', tooltip: '底图像素可任意（如 2×2），此处为屏幕上宽度' })
    itemWidth = 100;

    @property({ displayName: '色块显示高' })
    itemHeight = 100;

    @property({ displayName: '色块间距' })
    itemSpacing = 12;

    @property({ displayName: '内边距' })
    padding = 14;

    @property({ displayName: '序号字号' })
    labelFontSize = 28;

    @property({ type: Color, displayName: '选中描边颜色' })
    ringColor = new Color(48, 48, 48, 255);

    @property({ displayName: '描边外扩(px/边)' })
    ringOutset = 4;

    @property({ displayName: '格子根节点外扩(px/边)' })
    itemRootOutset = 6;

    @property({ displayName: '序号自动对比色' })
    useContrastLabel = true;

    @property({
        type: Color,
        displayName: '序号固定色',
        visible(this: PalettePanel) {
            return !this.useContrastLabel;
        },
    })
    labelFixedColor = new Color(255, 255, 255, 255);

    private _brushState: BrushState | null = null;
    private _itemRoots: Node[] = [];
    private _selectedIndex = 0;
    private _palette: string[] = [];
    private _onBrushIndexChanged: (() => void) | null = null;

    /**
     * @param palette   与谜题 palette 一致
     * @param brushState 当前画笔状态
     * @param itemFrame  色块底图（任意分辨率如 2×2；显示尺寸由 itemWidth/Height 决定）
     * @param options   可选覆盖；GameManager 运行时创建组件时应用此参数最可靠
     */
    setup(palette: string[], brushState: BrushState, itemFrame: SpriteFrame, options?: PalettePanelOptions): void {
        this._brushState = brushState;
        this._palette = palette;
        this._onBrushIndexChanged = options?.onBrushIndexChanged ?? null;
        this.node.removeAllChildren();
        this._itemRoots = [];

        const iw = options?.itemWidth ?? this.itemWidth;
        const ih = options?.itemHeight ?? this.itemHeight;
        const spc = options?.itemSpacing ?? this.itemSpacing;
        const pad = options?.padding ?? this.padding;
        const fontSz = options?.labelFontSize ?? this.labelFontSize;
        const ringCol = options?.ringColor ?? this.ringColor;
        const ringO = options?.ringOutset ?? this.ringOutset;
        const rootO = options?.itemRootOutset ?? this.itemRootOutset;
        const useContrast = options?.useContrastLabel ?? this.useContrastLabel;
        const labelFixed = options?.labelColor ?? (useContrast ? null : this.labelFixedColor);

        const viewW = view.getVisibleSize().width;
        const barH = pad * 2 + ih * 2 + spc;

        const rootUt = this.node.getComponent(UITransform) || this.node.addComponent(UITransform);
        rootUt.setContentSize(viewW, barH);

        const cols = Math.ceil(palette.length / 2);
        const gridW = cols * iw + Math.max(0, cols - 1) * spc;
        const gridH = ih * 2 + spc;
        const contentW = gridW + pad * 2;
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
        mask.type = MaskType.GRAPHICS_RECT;

        const content = new Node('content');
        viewNode.addChild(content);
        const cUt = content.addComponent(UITransform);
        cUt.setContentSize(contentW, contentH);
        cUt.setAnchorPoint(0, 0.5);
        content.setPosition(-viewW * 0.5, 0, 0);

        const scroll = scrollNode.addComponent(ScrollView);
        scroll.content = content;
        scroll.horizontal = true;
        scroll.vertical = false;
        scroll.elastic = true;
        scroll.brake = 0.5;
        scroll.bounceDuration = 0.5;

        const ox = pad + iw * 0.5;
        const oyTop = gridH * 0.5 - ih * 0.5;
        const oyBot = -gridH * 0.5 + ih * 0.5;

        const ringW = iw + ringO * 2;
        const ringH = ih + ringO * 2;
        const rootW = iw + rootO * 2;
        const rootH = ih + rootO * 2;

        for (let i = 0; i < palette.length; i++) {
            const col = Math.floor(i / 2);
            const row = i % 2;
            const x = ox + col * (iw + spc);
            const y = row === 0 ? oyTop : oyBot;

            const item = new Node(`PaletteItem_${i}`);
            content.addChild(item);
            item.setPosition(x, y, 0);
            const iUt = item.addComponent(UITransform);
            iUt.setContentSize(rootW, rootH);

            const ring = new Node('Ring');
            item.addChild(ring);
            const rUt = ring.addComponent(UITransform);
            rUt.setContentSize(ringW, ringH);
            const ringSp = ring.addComponent(Sprite);
            this._spriteCustomSize(ringSp, itemFrame, ringW, ringH);
            ringSp.color = ringCol.clone();
            ring.active = i === brushState.currentIndex;

            const bg = new Node('Bg');
            item.addChild(bg);
            const bgUt = bg.addComponent(UITransform);
            bgUt.setContentSize(iw, ih);
            const sp = bg.addComponent(Sprite);
            this._spriteCustomSize(sp, itemFrame, iw, ih);
            sp.color = this._hexToColor(palette[i]);

            const labNode = new Node('Label');
            item.addChild(labNode);
            labNode.setPosition(0, 0, 0);
            const lUt = labNode.addComponent(UITransform);
            lUt.setContentSize(iw, ih);
            const lab = labNode.addComponent(Label);
            lab.string = String(i + 1);
            lab.fontSize = fontSz;
            lab.horizontalAlign = Label.HorizontalAlign.CENTER;
            lab.verticalAlign = Label.VerticalAlign.CENTER;
            lab.color = (labelFixed ?? this._contrastLabelColor(sp.color)).clone();

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

    /**
     * 必须先 CUSTOM 再赋 spriteFrame，否则会按 TRIMMED 把 UITransform 改成贴图像素（如 2×2）。
     */
    private _spriteCustomSize(sprite: Sprite, frame: SpriteFrame, w: number, h: number): void {
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.type = Sprite.Type.SIMPLE;
        sprite.spriteFrame = frame;
        sprite.node.getComponent(UITransform)!.setContentSize(w, h);
    }

    private _select(index: number): void {
        if (!this._brushState) return;
        this._brushState.currentIndex = index;
        this._selectedIndex = index;
        for (let i = 0; i < this._itemRoots.length; i++) {
            const ringNode = this._itemRoots[i].getChildByName('Ring');
            if (ringNode) ringNode.active = i === index;
        }
        this._onBrushIndexChanged?.();
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
