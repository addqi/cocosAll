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

interface PaletteSlot {
    root: Node;
    ringSp: Sprite;
    bgSp: Sprite;
    lab: Label;
    boundIndex: number;
}

const POOL_SIZE = 12; // 2×5 + 2 transition buffer

/**
 * 调色板 — 虚拟列表实现。
 * 对象池固定 12 个 slot，按可见区域动态绑定/回收。
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
        visible(this: PalettePanel) { return !this.useContrastLabel; },
    })
    labelFixedColor = new Color(255, 255, 255, 255);

    private _brushState: BrushState | null = null;
    private _palette: string[] = [];
    private _selectedIndex = 0;
    private _completedSet = new Set<number>();
    private _onBrushIndexChanged: (() => void) | null = null;
    private _cols = 5;
    private _rows = 2;

    private _iw = 100;
    private _ih = 100;
    private _spc = 12;
    private _fontSz = 28;
    private _gridW = 0;
    private _gridH = 0;
    private _rootO = 6;
    private _ringO = 4;
    private _viewW = 960;
    private _ringCol = new Color(48, 48, 48, 255);
    private _useContrast = true;
    private _labelFixed: Color | null = null;

    private _container: Node | null = null;
    private _slots: PaletteSlot[] = [];
    private _freeSlots: PaletteSlot[] = [];
    private _boundMap = new Map<number, PaletteSlot>();

    /** PaletteInstaller 设置：自动选色导致翻页时回调（参数为色块页索引，0-based） */
    onScrollToPage: ((colorPageIndex: number) => void) | null = null;

    get selectedIndex(): number { return this._selectedIndex; }

    /**
     * 创建虚拟列表容器，返回单个 Node（挂到 Content 下）。
     * 调用后需 refreshVisibleSlots() 激活首屏 slot。
     */
    setup(
        palette: string[],
        brushState: BrushState,
        itemFrame: SpriteFrame,
        options?: PalettePanelOptions,
    ): Node {
        this._brushState = brushState;
        this._palette = palette;
        this._onBrushIndexChanged = options?.onBrushIndexChanged ?? null;
        this._completedSet = new Set<number>();

        const iw = this._iw = options?.itemWidth ?? this.itemWidth;
        const ih = this._ih = options?.itemHeight ?? this.itemHeight;
        const spc = this._spc = options?.itemSpacing ?? this.itemSpacing;
        this._fontSz = options?.labelFontSize ?? this.labelFontSize;
        this._ringCol = (options?.ringColor ?? this.ringColor).clone();
        this._ringO = options?.ringOutset ?? this.ringOutset;
        this._rootO = options?.itemRootOutset ?? this.itemRootOutset;
        this._useContrast = options?.useContrastLabel ?? this.useContrastLabel;
        this._labelFixed = options?.labelColor ?? (this._useContrast ? null : this.labelFixedColor);
        const cols = this._cols = options?.columnsPerPage ?? 5;
        const rows = this._rows = options?.rowsPerPage ?? 2;

        this._gridW = cols * iw + Math.max(0, cols - 1) * spc;
        this._gridH = ih * rows + spc * Math.max(0, rows - 1);
        this._viewW = view.getVisibleSize().width;

        const perPage = cols * rows;
        const pageCount = Math.ceil(palette.length / perPage) || 1;

        const container = new Node('ColorContainer');
        container.addComponent(UITransform).setContentSize(pageCount * this._viewW, this._gridH);
        this._container = container;

        this._slots = [];
        this._freeSlots = [];
        this._boundMap = new Map();
        for (let s = 0; s < POOL_SIZE; s++) {
            const slot = this._createSlot(container, itemFrame, s);
            slot.root.active = false;
            this._slots.push(slot);
            this._freeSlots.push(slot);
        }

        this._selectedIndex = brushState.currentIndex;
        return container;
    }

    /**
     * 根据 Content.position.x 刷新可见 slot。
     * 每次 Content 位置变化（翻页/拖拽/动画帧）都应调用。
     */
    refreshVisibleSlots(contentPosX: number): void {
        if (!this._container) return;
        const viewW = this._viewW;
        const iw = this._iw;
        const spc = this._spc;
        const containerOX = this._container.position.x;

        const visLeft = -contentPosX - viewW / 2 - containerOX;
        const visRight = -contentPosX + viewW / 2 - containerOX;

        const perPage = this._cols * this._rows;
        const pageCount = Math.ceil(this._palette.length / perPage) || 1;
        const visibleSet = new Set<number>();

        for (let p = 0; p < pageCount; p++) {
            const pc = p * viewW;
            if (pc + this._gridW / 2 < visLeft || pc - this._gridW / 2 > visRight) continue;

            const start = p * perPage;
            const end = Math.min(start + perPage, this._palette.length);
            for (let i = start; i < end; i++) {
                const col = (i - start) % this._cols;
                const cx = pc - this._gridW / 2 + iw / 2 + col * (iw + spc);
                if (cx + iw / 2 >= visLeft && cx - iw / 2 <= visRight) {
                    visibleSet.add(i);
                }
            }
        }

        for (const slot of this._slots) {
            if (slot.boundIndex >= 0 && !visibleSet.has(slot.boundIndex)) {
                this._unbindSlot(slot);
            }
        }
        for (const idx of visibleSet) {
            if (!this._boundMap.has(idx)) {
                const slot = this._freeSlots.pop();
                if (!slot) break;
                this._bindSlot(slot, idx);
            }
        }
    }

    /** 命中测试：纯数学计算，不依赖物理节点 */
    hitTest(colorPageIndex: number, localX: number, localY: number): number {
        const iw = this._iw;
        const ih = this._ih;
        const spc = this._spc;
        const halfRW = (iw + this._rootO * 2) / 2;
        const halfRH = (ih + this._rootO * 2) / 2;

        const perPage = this._cols * this._rows;
        const start = colorPageIndex * perPage;
        const end = Math.min(start + perPage, this._palette.length);

        for (let i = start; i < end; i++) {
            const li = i - start;
            const col = li % this._cols;
            const row = Math.floor(li / this._cols);
            const cx = -this._gridW / 2 + iw / 2 + col * (iw + spc);
            const cy = this._gridH / 2 - ih / 2 - row * (ih + spc);

            if (localX >= cx - halfRW && localX <= cx + halfRW &&
                localY >= cy - halfRH && localY <= cy + halfRH) {
                return i;
            }
        }
        return -1;
    }

    getPageForIndex(index: number): number {
        return Math.floor(index / (this._cols * this._rows));
    }

    select(index: number): void {
        if (!this._brushState) return;
        if (this._completedSet.has(index)) return;
        if (index < 0 || index >= this._palette.length) return;
        const prevPage = this.getPageForIndex(this._selectedIndex);
        this._brushState.currentIndex = index;
        this._selectedIndex = index;
        for (const [bIdx, slot] of this._boundMap) {
            slot.ringSp.node.active = bIdx === index;
        }
        this._onBrushIndexChanged?.();
        const newPage = this.getPageForIndex(index);
        if (newPage !== prevPage) this.onScrollToPage?.(newPage);
    }

    markBrushComplete(brushIndex: number): void {
        if (brushIndex < 0 || brushIndex >= this._palette.length) return;
        this._completedSet.add(brushIndex);
        const slot = this._boundMap.get(brushIndex);
        if (slot) {
            slot.lab.string = '✓';
            slot.lab.fontSize = 36;
        }
    }

    autoSelectNextUnfinished(completedIndex: number, isComplete: (i: number) => boolean): void {
        if (this._selectedIndex !== completedIndex) return;
        const len = this._palette.length;
        for (let offset = 1; offset < len; offset++) {
            const idx = (completedIndex + offset) % len;
            if (!isComplete(idx)) {
                this.select(idx);
                return;
            }
        }
    }

    // ── Private ──────────────────────────────────────────

    private _createSlot(parent: Node, frame: SpriteFrame, idx: number): PaletteSlot {
        const iw = this._iw;
        const ih = this._ih;
        const ringW = iw + this._ringO * 2;
        const ringH = ih + this._ringO * 2;
        const rootW = iw + this._rootO * 2;
        const rootH = ih + this._rootO * 2;

        const root = new Node(`Slot_${idx}`);
        parent.addChild(root);
        root.addComponent(UITransform).setContentSize(rootW, rootH);

        const ring = new Node('Ring');
        root.addChild(ring);
        ring.addComponent(UITransform).setContentSize(ringW, ringH);
        const ringSp = ring.addComponent(Sprite);
        this._spriteCustomSize(ringSp, frame, ringW, ringH);
        ringSp.color = this._ringCol.clone();

        const bg = new Node('Bg');
        root.addChild(bg);
        bg.addComponent(UITransform).setContentSize(iw, ih);
        const bgSp = bg.addComponent(Sprite);
        this._spriteCustomSize(bgSp, frame, iw, ih);

        const labNode = new Node('Label');
        root.addChild(labNode);
        labNode.addComponent(UITransform).setContentSize(iw, ih);
        const lab = labNode.addComponent(Label);
        lab.fontSize = this._fontSz;
        lab.horizontalAlign = Label.HorizontalAlign.CENTER;
        lab.verticalAlign = Label.VerticalAlign.CENTER;

        return { root, ringSp, bgSp, lab, boundIndex: -1 };
    }

    private _bindSlot(slot: PaletteSlot, index: number): void {
        const perPage = this._cols * this._rows;
        const page = Math.floor(index / perPage);
        const li = index - page * perPage;
        const col = li % this._cols;
        const row = Math.floor(li / this._cols);

        const x = page * this._viewW - this._gridW / 2 + this._iw / 2 + col * (this._iw + this._spc);
        const y = this._gridH / 2 - this._ih / 2 - row * (this._ih + this._spc);
        slot.root.setPosition(x, y, 0);

        const bgColor = this._hexToColor(this._palette[index]);
        slot.bgSp.color = bgColor;

        if (this._completedSet.has(index)) {
            slot.lab.string = '✓';
            slot.lab.fontSize = 36;
        } else {
            slot.lab.string = String(index + 1);
            slot.lab.fontSize = this._fontSz;
        }
        slot.lab.color = (this._labelFixed ?? this._contrastLabelColor(bgColor)).clone();
        slot.ringSp.node.active = index === this._selectedIndex;

        slot.boundIndex = index;
        slot.root.active = true;
        this._boundMap.set(index, slot);
    }

    private _unbindSlot(slot: PaletteSlot): void {
        this._boundMap.delete(slot.boundIndex);
        slot.boundIndex = -1;
        slot.root.active = false;
        this._freeSlots.push(slot);
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
