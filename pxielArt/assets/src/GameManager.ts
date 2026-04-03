import { _decorator, Color, Component, JsonAsset, Material, SpriteFrame, UITransform, view } from 'cc';
import { GameConfig } from './config/GameConfig';
import { BoardBootstrap } from './game/BoardBootstrap';
import { PaletteInstaller } from './game/PaletteInstaller';
import { BoardRootPanInput } from './core/input/BoardRootPanInput';
import { BoardTouchInput } from './core/input/BoardTouchInput';
import { BoardViewportInput } from './core/input/BoardViewportInput';
import { PuzzleData } from './types/types';

const { ccclass, property } = _decorator;

/** 场景装配入口：谜题引用 + 调色板样式；盘面见 BoardBootstrap；Brush 上涂色/双指视口；根节点留白上单指平移 */
@ccclass('GameManager')
export class GameManager extends Component {
    @property({ displayName: '格子显示边长', tooltip: '单格在屏幕上的像素边长' })
    cellDisplaySize = GameConfig.defaultCellDisplaySize;

    @property({ type: Material, displayName: 'Digit 材质' })
    digitMaterial: Material = null!;

    @property({ type: JsonAsset, displayName: '谜题数据' })
    puzzleJson: JsonAsset = null!;

    @property({ type: SpriteFrame, displayName: '调色块底图' })
    paletteItemSprite: SpriteFrame | null = null;

    @property({ group: { name: '调色板', id: '1' }, displayName: '色块显示宽' })
    paletteItemWidth = 100;

    @property({ group: { name: '调色板', id: '1' }, displayName: '色块显示高' })
    paletteItemHeight = 100;

    @property({ group: { name: '调色板', id: '1' }, displayName: '色块间距' })
    paletteItemSpacing = 12;

    @property({ group: { name: '调色板', id: '1' }, displayName: '内边距' })
    palettePadding = 14;

    @property({ group: { name: '调色板', id: '1' }, displayName: '序号字号' })
    paletteLabelFontSize = 28;

    @property({ type: Color, group: { name: '调色板', id: '1' }, displayName: '选中描边颜色' })
    paletteRingColor = new Color(48, 48, 48, 255);

    @property({ group: { name: '调色板', id: '1' }, displayName: '描边外扩(px/边)' })
    paletteRingOutset = 4;

    @property({ group: { name: '调色板', id: '1' }, displayName: '点击区外扩(px/边)' })
    paletteItemRootOutset = 6;

    @property({ group: { name: '调色板', id: '1' }, displayName: '序号自动对比色' })
    paletteUseContrastLabel = true;

    @property({ type: Color, group: { name: '调色板', id: '1' }, displayName: '序号固定色' })
    paletteLabelFixedColor = new Color(255, 255, 255, 255);

    start(): void {
        const puzzle = this.puzzleJson.json as PuzzleData;

        const vs = view.getVisibleSize();
        const rootUt = this.node.getComponent(UITransform);
        if (rootUt) {
            rootUt.setContentSize(vs.width, vs.height);
        }

        const ctx = BoardBootstrap.run({
            boardRoot: this.node,
            puzzle,
            cellDisplaySize: this.cellDisplaySize,
            digitMaterial: this.digitMaterial,
            viewport: {
                zoomStep: GameConfig.viewportZoomStep,
                zoomSpeedPerSecond: GameConfig.viewportZoomSpeedPerSecond,
                autoFitInitial: GameConfig.viewportAutoFit,
            },
        });

        const canvas = this.node.parent;
        if (!this.paletteItemSprite) {
            console.warn('[GameManager] 未指定调色块底图 paletteItemSprite');
        } else if (!canvas) {
            console.warn('[GameManager] 未找到 Canvas 父节点，无法创建调色板');
        } else {
            PaletteInstaller.install(canvas, ctx.boardData.palette, ctx.brushState, this.paletteItemSprite, {
                itemWidth: this.paletteItemWidth,
                itemHeight: this.paletteItemHeight,
                itemSpacing: this.paletteItemSpacing,
                padding: this.palettePadding,
                labelFontSize: this.paletteLabelFontSize,
                ringColor: this.paletteRingColor,
                ringOutset: this.paletteRingOutset,
                itemRootOutset: this.paletteItemRootOutset,
                useContrastLabel: this.paletteUseContrastLabel,
                labelFixedColor: this.paletteLabelFixedColor,
                onBrushIndexChanged: () => ctx.refreshDetailVisibility(),
            });
        }

        const legacyTouch = this.node.getComponent(BoardTouchInput);
        if (legacyTouch) {
            legacyTouch.destroy();
        }
        const touchHost = ctx.brushLayer.node;
        const touch = touchHost.getComponent(BoardTouchInput) ?? touchHost.addComponent(BoardTouchInput);
        touch.init(ctx);

        const keys = this.node.getComponent(BoardViewportInput) ?? this.node.addComponent(BoardViewportInput);
        keys.init(ctx);

        const rootPan = this.node.getComponent(BoardRootPanInput) ?? this.node.addComponent(BoardRootPanInput);
        rootPan.init(ctx);
    }
}
