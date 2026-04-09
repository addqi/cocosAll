import {
    Color, EventTouch, Mask, MaskType, Node, Sprite,
    SpriteFrame, tween, Tween, UITransform, Vec3, view, Widget,
} from 'cc';
import { BrushState } from '../core/data/BrushState';
import { ToolState } from '../core/tool/ToolState';
import { ToolType } from '../config/ToolConfig';
import { PalettePanel, PalettePanelOptions } from '../ui/palette/PalettePanel';
import { ToolPanel, ToolPanelHandle } from '../ui/palette/ToolPanel';

export interface PaletteInstallerOptions {
    itemWidth: number;
    itemHeight: number;
    itemSpacing: number;
    padding: number;
    labelFontSize: number;
    ringColor: Color;
    ringOutset: number;
    itemRootOutset: number;
    useContrastLabel: boolean;
    labelFixedColor: Color;
    onBrushIndexChanged?: () => void;
    columnsPerPage?: number;
    rowsPerPage?: number;
    swipeThreshold?: number;
    snapSpeed?: number;
    defaultPage?: number;
}

const INDICATOR_H = 32;
const DOT_SIZE = 10;
const DOT_GAP = 12;
const DRAG_DETECT_PX = 8;

export class PaletteInstaller {

    static install(
        parent: Node,
        palette: string[],
        brushState: BrushState,
        itemSprite: SpriteFrame,
        style: PaletteInstallerOptions,
        toolState: ToolState,
        onToolClick: (type: ToolType) => void,
    ): PalettePanel {
        const viewW = view.getVisibleSize().width;
        const ih = style.itemHeight;
        const spc = style.itemSpacing;
        const pad = style.padding;
        const cols = style.columnsPerPage ?? 5;
        const rows = style.rowsPerPage ?? 2;
        const swipeThreshold = style.swipeThreshold ?? 50;
        const snapSpeed = style.snapSpeed ?? 3000;

        const gridH = ih * rows + spc * Math.max(0, rows - 1);
        const paletteH = pad * 2 + gridH;
        const barH = paletteH + INDICATOR_H;

        const perPage = cols * rows;
        const colorPageCount = Math.max(1, Math.ceil(palette.length / perPage));
        const totalPages = 1 + colorPageCount;
        const defaultPage = Math.min(style.defaultPage ?? 1, totalPages - 1);

        // ── Bar (root) ──────────────────────────────────────────
        const bar = new Node('PaletteBar');
        parent.addChild(bar);
        bar.addComponent(UITransform).setContentSize(viewW, barH);

        const widget = bar.addComponent(Widget);
        widget.isAlignBottom = true;
        widget.isAlignLeft = true;
        widget.isAlignRight = true;
        widget.bottom = 0;
        widget.left = 0;
        widget.right = 0;
        widget.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;

        const barBg = new Node('BarBg');
        bar.addChild(barBg);
        barBg.addComponent(UITransform).setContentSize(viewW, barH);
        const bgSp = barBg.addComponent(Sprite);
        bgSp.sizeMode = Sprite.SizeMode.CUSTOM;
        bgSp.spriteFrame = itemSprite;
        bgSp.color = Color.WHITE;

        // ── Mask view ───────────────────────────────────────────
        const maskNode = new Node('MaskView');
        bar.addChild(maskNode);
        maskNode.setPosition(0, -INDICATOR_H / 2, 0);
        maskNode.addComponent(UITransform).setContentSize(viewW, paletteH);
        maskNode.addComponent(Mask).type = MaskType.GRAPHICS_RECT;

        // ── Content (carries all pages, position.x drives paging) ─
        const content = new Node('Content');
        maskNode.addChild(content);
        content.addComponent(UITransform).setContentSize(viewW * totalPages, paletteH);

        // ── Page 0: Tools ───────────────────────────────────────
        const toolHandle: ToolPanelHandle = ToolPanel.create(toolState, itemSprite, paletteH);
        content.addChild(toolHandle.node);
        toolHandle.node.setPosition(0, 0, 0);

        // ── Page 1+: Colors ─────────────────────────────────────
        const panel = bar.addComponent(PalettePanel);
        const opts: PalettePanelOptions = {
            itemWidth: style.itemWidth,
            itemHeight: style.itemHeight,
            itemSpacing: style.itemSpacing,
            padding: style.padding,
            labelFontSize: style.labelFontSize,
            ringColor: style.ringColor,
            ringOutset: style.ringOutset,
            itemRootOutset: style.itemRootOutset,
            useContrastLabel: style.useContrastLabel,
            labelColor: style.useContrastLabel ? null : style.labelFixedColor,
            onBrushIndexChanged: style.onBrushIndexChanged,
            columnsPerPage: cols,
            rowsPerPage: rows,
        };
        const colorPages = panel.setup(palette, brushState, itemSprite, opts);
        for (let i = 0; i < colorPages.length; i++) {
            content.addChild(colorPages[i]);
            colorPages[i].setPosition((i + 1) * viewW, 0, 0);
        }

        // ── Page indicator dots ─────────────────────────────────
        const dots = this._buildDots(bar, barH, totalPages, defaultPage, itemSprite);

        // ── Paging state ────────────────────────────────────────
        let currentPage = defaultPage;
        const pageX = (p: number) => -p * viewW;
        content.setPosition(pageX(currentPage), 0, 0);

        let activeTween: Tween<Node> | null = null;

        const navigateToPage = (target: number, animated = true) => {
            target = Math.max(0, Math.min(totalPages - 1, target));
            currentPage = target;
            this._updateDots(dots, target);
            if (activeTween) { activeTween.stop(); activeTween = null; }
            const tx = pageX(target);
            if (!animated) { content.setPosition(tx, 0, 0); return; }
            const dist = Math.abs(content.position.x - tx);
            const dur = Math.max(0.1, dist / snapSpeed);
            activeTween = tween(content)
                .to(dur, { position: new Vec3(tx, 0, 0) })
                .call(() => { activeTween = null; })
                .start();
        };

        panel.onScrollToPage = (colorIdx: number) => navigateToPage(colorIdx + 1);

        // ── Touch handling (single-finger, whole bar) ───────────
        let trackingId: number | null = null;
        let startX = 0;
        let swiping = false;
        let contentStartX = 0;

        bar.on(Node.EventType.TOUCH_START, (ev: EventTouch) => {
            const t = ev.touch;
            if (!t) return;
            if (trackingId !== null) return;
            trackingId = t.getID();
            if (activeTween) { activeTween.stop(); activeTween = null; }
            const loc = ev.getUILocation();
            startX = loc.x;
            swiping = false;
            contentStartX = content.position.x;
        });

        bar.on(Node.EventType.TOUCH_MOVE, (ev: EventTouch) => {
            const t = ev.touch;
            if (!t || t.getID() !== trackingId) return;
            const loc = ev.getUILocation();
            const dx = loc.x - startX;
            if (!swiping && Math.abs(dx) > DRAG_DETECT_PX) swiping = true;
            if (!swiping) return;
            let nx = contentStartX + dx;
            const minX = pageX(totalPages - 1);
            const maxX = pageX(0);
            if (nx > maxX) nx = maxX + (nx - maxX) * 0.3;
            if (nx < minX) nx = minX + (nx - minX) * 0.3;
            content.setPosition(nx, 0, 0);
        });

        const onEnd = (ev: EventTouch) => {
            const t = ev.touch;
            if (!t || t.getID() !== trackingId) return;
            trackingId = null;
            const dx = ev.getUILocation().x - startX;

            if (Math.abs(dx) >= swipeThreshold) {
                navigateToPage(dx < 0 ? currentPage + 1 : currentPage - 1);
            } else if (swiping) {
                navigateToPage(currentPage);
            } else {
                this._handleTap(ev, content, currentPage, viewW, panel, toolHandle, onToolClick);
            }
        };

        bar.on(Node.EventType.TOUCH_END, onEnd);
        bar.on(Node.EventType.TOUCH_CANCEL, (ev: EventTouch) => {
            const t = ev.touch;
            if (!t || t.getID() !== trackingId) return;
            trackingId = null;
            navigateToPage(currentPage);
        });

        return panel;
    }

    // ── Tap hit-test ────────────────────────────────────────────
    private static _handleTap(
        ev: EventTouch,
        content: Node,
        currentPage: number,
        viewW: number,
        panel: PalettePanel,
        toolHandle: ToolPanelHandle,
        onToolClick: (type: ToolType) => void,
    ): void {
        const loc = ev.getUILocation();
        const contentUt = content.getComponent(UITransform)!;
        const cl = contentUt.convertToNodeSpaceAR(new Vec3(loc.x, loc.y, 0));
        const pageNodeX = currentPage * viewW;
        const plx = cl.x - pageNodeX;
        const ply = cl.y;

        if (currentPage === 0) {
            const type = toolHandle.hitTest(plx, ply);
            if (type !== ToolType.None) onToolClick(type);
        } else {
            const idx = panel.hitTest(currentPage - 1, plx, ply);
            if (idx >= 0) panel.select(idx);
        }
    }

    // ── Dot indicator ───────────────────────────────────────────
    private static _buildDots(
        bar: Node, barH: number, total: number, active: number, sf: SpriteFrame,
    ): Sprite[] {
        const container = new Node('PageIndicator');
        bar.addChild(container);
        container.setPosition(0, barH / 2 - INDICATOR_H / 2, 0);
        const totalW = total * DOT_SIZE + (total - 1) * DOT_GAP;
        container.addComponent(UITransform).setContentSize(totalW, INDICATOR_H);

        const dots: Sprite[] = [];
        for (let i = 0; i < total; i++) {
            const x = -totalW / 2 + DOT_SIZE / 2 + i * (DOT_SIZE + DOT_GAP);
            const dn = new Node(`Dot_${i}`);
            container.addChild(dn);
            dn.setPosition(x, 0, 0);
            dn.addComponent(UITransform).setContentSize(DOT_SIZE, DOT_SIZE);
            const sp = dn.addComponent(Sprite);
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
            sp.spriteFrame = sf;
            sp.color = i === active ? new Color(60, 60, 60, 255) : new Color(200, 200, 200, 255);
            dots.push(sp);
        }
        return dots;
    }

    private static _updateDots(dots: Sprite[], active: number): void {
        const on = new Color(60, 60, 60, 255);
        const off = new Color(200, 200, 200, 255);
        for (let i = 0; i < dots.length; i++) dots[i].color = i === active ? on : off;
    }
}
