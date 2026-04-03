import { Color, Node, SpriteFrame, Widget } from 'cc';
import { BrushState } from '../core/data/BrushState';
import { PalettePanel, PalettePanelOptions } from '../ui/palette/PalettePanel';

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
}

/** 在指定父节点（HudLayer）底部创建调色条 */
export class PaletteInstaller {
    static install(
        parent: Node,
        palette: string[],
        brushState: BrushState,
        itemSprite: SpriteFrame,
        style: PaletteInstallerOptions,
    ): void {
        const bar = new Node('PaletteBar');
        parent.addChild(bar);

        const widget = bar.addComponent(Widget);
        widget.isAlignBottom = true;
        widget.isAlignLeft = true;
        widget.isAlignRight = true;
        widget.bottom = 0;
        widget.left = 0;
        widget.right = 0;
        widget.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;

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
        };
        panel.setup(palette, brushState, itemSprite, opts);
    }
}
