import {
    _decorator,
    Color,
    Component,
    Label,
    Node,
    Sprite,
    SpriteFrame,
    UITransform,
    view,
} from 'cc';
import { BrushState } from '../../core/data/BrushState';

const { ccclass, property } = _decorator;

export interface PalettePanelOptions {
    itemWidth?: number;
    itemHeight?: number;
    itemSpacing?: number;
    padding?: number;
    labelFontSize?: number;
    ringColor?: Color;
    ringOutset?: number;
    itemRootOutset?: number;
    labelColor?: Color | null;
    useContrastLabel?: boolean;
    onBrushIndexChanged?: () => void;
    columnsPerPage?: number;
    rowsPerPage?: number;
}

/**
 * 调色板状态管理 + 色块节点工厂。
 * 不处理任何触摸事件；点击/滑动全部由 PaletteInstaller 统一接管。
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
    private _completedSet = new Set<number>();
    private _cols = 5;
    private _rows = 2;

    /** PaletteInstaller 设置：自动选色导致翻页时回调（参数为色块页索引，0-based） */
    onScrollToPage: ((colorPageIndex: number) => void) | null = null;

    get selectedIndex(): number { return this._selectedIndex; }

    /**
     * 按 cols×rows 分页创建色块节点，返回 Node[]（每页一个）。
     * 不含 ScrollView / Button，触摸由外部处理。
     */
    setup(
        palette: string[],
        brushState: BrushState,
        itemFrame: SpriteFrame,
        options?: PalettePanelOptions,
    ): Node[] {
        this._brushState = brushState;
        this._palette = palette;
        this._onBrushIndexChanged = options?.onBrushIndexChanged ?? null;
        this._itemRoots = [];
        this._completedSet = new Set<number>();

        const iw = options?.itemWidth ?? this.itemWidth;
        const ih = options?.itemHeight ?? this.itemHeight;
        const spc = options?.itemSpacing ?? this.itemSpacing;
        const fontSz = options?.labelFontSize ?? this.labelFontSize;
        const ringCol = options?.ringColor ?? this.ringColor;
        const ringO = options?.ringOutset ?? this.ringOutset;
        const rootO = options?.itemRootOutset ?? this.itemRootOutset;
        const useContrast = options?.useContrastLabel ?? this.useContrastLabel;
        const labelFixed = options?.labelColor ?? (useContrast ? null : this.labelFixedColor);
        const cols = options?.columnsPerPage ?? 5;
        const rows = options?.rowsPerPage ?? 2;

        this._cols = cols;
        this._rows = rows;

        const perPage = cols * rows;
        const pageCount = Math.ceil(palette.length / perPage) || 1;
        const viewW = view.getVisibleSize().width;
        const gridH = ih * rows + spc * Math.max(0, rows - 1);
        const gridW = cols * iw + Math.max(0, cols - 1) * spc;
        const pageH = gridH;

        const ringW = iw + ringO * 2;
        const ringH = ih + ringO * 2;
        const rootW = iw + rootO * 2;
        const rootH = ih + rootO * 2;

        const pages: Node[] = [];

        for (let p = 0; p < pageCount; p++) {
            const page = new Node(`ColorPage_${p}`);
            page.addComponent(UITransform).setContentSize(viewW, pageH);

            const startIdx = p * perPage;
            const endIdx = Math.min(startIdx + perPage, palette.length);

            for (let i = startIdx; i < endIdx; i++) {
                const li = i - startIdx;
                const col = li % cols;
                const row = Math.floor(li / cols);
                const ox = -gridW / 2 + iw / 2 + col * (iw + spc);
                const oy = gridH / 2 - ih / 2 - row * (ih + spc);

                const item = new Node(`PaletteItem_${i}`);
                page.addChild(item);
                item.setPosition(ox, oy, 0);
                item.addComponent(UITransform).setContentSize(rootW, rootH);

                const ring = new Node('Ring');
                item.addChild(ring);
                ring.addComponent(UITransform).setContentSize(ringW, ringH);
                const ringSp = ring.addComponent(Sprite);
                this._spriteCustomSize(ringSp, itemFrame, ringW, ringH);
                ringSp.color = ringCol.clone();
                ring.active = i === brushState.currentIndex;

                const bg = new Node('Bg');
                item.addChild(bg);
                bg.addComponent(UITransform).setContentSize(iw, ih);
                const sp = bg.addComponent(Sprite);
                this._spriteCustomSize(sp, itemFrame, iw, ih);
                sp.color = this._hexToColor(palette[i]);

                const labNode = new Node('Label');
                item.addChild(labNode);
                labNode.addComponent(UITransform).setContentSize(iw, ih);
                const lab = labNode.addComponent(Label);
                lab.string = String(i + 1);
                lab.fontSize = fontSz;
                lab.horizontalAlign = Label.HorizontalAlign.CENTER;
                lab.verticalAlign = Label.VerticalAlign.CENTER;
                lab.color = (labelFixed ?? this._contrastLabelColor(sp.color)).clone();

                this._itemRoots.push(item);
            }

            pages.push(page);
        }

        this._selectedIndex = brushState.currentIndex;
        return pages;
    }

    /** 命中测试：给定色块页索引 + 页内局部坐标，返回 palette index 或 -1 */
    hitTest(colorPageIndex: number, localX: number, localY: number): number {
        const perPage = this._cols * this._rows;
        const startIdx = colorPageIndex * perPage;
        const endIdx = Math.min(startIdx + perPage, this._palette.length);
        for (let i = startIdx; i < endIdx; i++) {
            const item = this._itemRoots[i];
            const p = item.position;
            const ut = item.getComponent(UITransform)!;
            const hw = ut.width * 0.5;
            const hh = ut.height * 0.5;
            if (localX >= p.x - hw && localX <= p.x + hw &&
                localY >= p.y - hh && localY <= p.y + hh) {
                return i;
            }
        }
        return -1;
    }

    getPageForIndex(index: number): number {
        const perPage = this._cols * this._rows;
        return Math.floor(index / perPage);
    }

    select(index: number): void {
        if (!this._brushState) return;
        if (this._completedSet.has(index)) return;
        if (index < 0 || index >= this._palette.length) return;
        const prevPage = this.getPageForIndex(this._selectedIndex);
        this._brushState.currentIndex = index;
        this._selectedIndex = index;
        for (let i = 0; i < this._itemRoots.length; i++) {
            const ringNode = this._itemRoots[i].getChildByName('Ring');
            if (ringNode) ringNode.active = i === index;
        }
        this._onBrushIndexChanged?.();
        const newPage = this.getPageForIndex(index);
        if (newPage !== prevPage) this.onScrollToPage?.(newPage);
    }

    markBrushComplete(brushIndex: number): void {
        if (brushIndex < 0 || brushIndex >= this._itemRoots.length) return;
        this._completedSet.add(brushIndex);
        const item = this._itemRoots[brushIndex];
        const labNode = item.getChildByName('Label');
        if (labNode) {
            const lab = labNode.getComponent(Label);
            if (lab) { lab.string = '✓'; lab.fontSize = 36; }
        }
    }

    autoSelectNextUnfinished(completedIndex: number, isComplete: (i: number) => boolean): void {
        if (this._selectedIndex !== completedIndex) return;
        const len = this._itemRoots.length;
        for (let offset = 1; offset < len; offset++) {
            const idx = (completedIndex + offset) % len;
            if (!isComplete(idx)) {
                this.select(idx);
                return;
            }
        }
    }

    private _spriteCustomSize(sprite: Sprite, frame: SpriteFrame, w: number, h: number): void {
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.type = Sprite.Type.SIMPLE;
        sprite.spriteFrame = frame;
        sprite.node.getComponent(UITransform)!.setContentSize(w, h);
    }

    private _hexToColor(hex: string): Color {
        let s = hex.trim();
        if (s.startsWith('#')) s = s.slice(1);
        const n = parseInt(s, 16);
        if (Number.isNaN(n) || s.length < 6) return new Color(136, 136, 136, 255);
        return new Color((n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff, 255);
    }

    private _contrastLabelColor(bg: Color): Color {
        const r = bg.r / 255, g = bg.g / 255, b = bg.b / 255;
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        return lum > 0.55 ? new Color(30, 30, 30, 255) : new Color(255, 255, 255, 255);
    }
}
