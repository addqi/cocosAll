import {
    _decorator,
    Button,
    Color,
    Component,
    JsonAsset,
    Label,
    Material,
    Node,
    resources,
    SpriteFrame,
    UITransform,
    view,
} from 'cc';
import { GameConfig } from '../../config/GameConfig';
import { ToolType, ToolTriggerMode, ToolDefs } from '../../config/ToolConfig';
import { LevelEntry } from '../../config/LevelManifest';
import { BoardBootstrap } from '../../game/BoardBootstrap';
import { PaletteInstaller, PaletteInstallerOptions } from '../../game/PaletteInstaller';
import { BoardRootPanInput } from '../../core/input/BoardRootPanInput';
import { BoardTouchInput } from '../../core/input/BoardTouchInput';
import { BoardViewportInput } from '../../core/input/BoardViewportInput';
import { BoardRuntimeContext } from '../../game/BoardRuntimeContext';
import { ToolState } from '../../core/tool/ToolState';
import { ToolExecutor } from '../../core/tool/ToolExecutor';
import { PuzzleData } from '../../types/types';
import { CompletionPopup } from '../popup/CompletionPopup';
import { ExitConfirmPopup } from '../popup/ExitConfirmPopup';
import { cellFilled } from '../../core/paint/PaintSnapRules';
import { showToast } from '../../util/Toast';
import { ProgressBar, ProgressBarHandle } from './ProgressBar';
import { PalettePanel } from '../palette/PalettePanel';
import { BundleManager } from '../../config/BundleManager';

const { ccclass } = _decorator;

export interface GamePageAssets {
    digitMaterial: Material;
    paletteItemSprite: SpriteFrame;
    cellDisplaySize: number;
    paletteStyle: PaletteInstallerOptions;
}

@ccclass('GamePage')
export class GamePage extends Component {

    private _assets: GamePageAssets | null = null;
    private _onBack: (() => void) | null = null;
    private _toolState: ToolState | null = null;
    private _ctx: BoardRuntimeContext | null = null;
    private _currentLevelId: string | null = null;
    private _currentPuzzle: PuzzleData | null = null;
    private _popupLayer: Node | null = null;
    private _topLayer: Node | null = null;

    init(assets: GamePageAssets, toolState: ToolState, onBack: () => void): void {
        this._assets = assets;
        this._toolState = toolState;
        this._onBack = onBack;
    }

    startLevel(entry: LevelEntry): void {
        this.cleanup();
        this._currentLevelId = entry.id;
        BundleManager.loadPuzzle(entry.jsonPath).then(jsonAsset => {
            this._buildGame(jsonAsset.json as PuzzleData, entry.id);
        }).catch(() => {});
    }

    cleanup(): void {
        if (this._ctx) {
            this._ctx.saveManager.forceFlush();
        }
        this._ctx = null;
        this._currentLevelId = null;
        this._currentPuzzle = null;
        this._popupLayer = null;
        this._topLayer = null;
        this.node.removeAllChildren();
    }

    private _buildGame(puzzle: PuzzleData, levelId: string): void {
        this._currentPuzzle = puzzle;
        const a = this._assets!;
        const vs = view.getVisibleSize();

        const gameLayer = this._createLayer('GameLayer', vs);
        const hudLayer = this._createLayer('HudLayer', vs);
        this._popupLayer = this._createLayer('PopupLayer', vs);
        this._topLayer = this._createLayer('TopLayer', vs);

        const toolState = this._toolState!;
        const paletteBarH = PaletteInstaller.computeBarHeight(a.paletteStyle);
        const hudTopH = GameConfig.hudTopHeight;

        const ctx = BoardBootstrap.run({
            boardRoot: gameLayer,
            puzzle,
            cellDisplaySize: a.cellDisplaySize,
            digitMaterial: a.digitMaterial,
            levelId,
            toolState,
            viewport: {
                zoomStep: GameConfig.viewportZoomStep,
                zoomSpeedPerSecond: GameConfig.viewportZoomSpeedPerSecond,
                autoFitInitial: GameConfig.viewportAutoFit,
                topInset: hudTopH,
                bottomInset: paletteBarH,
            },
        });
        this._ctx = ctx;
        ctx.saveManager.onAllComplete = () => this._showCompletion();
        ctx.onToast = (msg) => { if (this._topLayer) showToast(this._topLayer, msg); };

        const hudUt = hudLayer.getComponent(UITransform)!;
        const progressBar = ProgressBar.create(hudLayer, vs.width, hudUt.height / 2 - 50);

        let palettePanel: PalettePanel | null = null;
        if (a.paletteItemSprite) {
            palettePanel = PaletteInstaller.install(
                hudLayer,
                ctx.boardData.palette,
                ctx.brushState,
                a.paletteItemSprite,
                {
                    ...a.paletteStyle,
                    onBrushIndexChanged: () => ctx.refreshDetailVisibility(),
                },
                toolState,
                (type) => this._handleToolClick(type),
            );
        }

        const sm = ctx.saveManager;
        const isBrushComplete = (i: number) =>
            sm.brushTotalCounts[i] > 0 && sm.brushFilledCounts[i] >= sm.brushTotalCounts[i];

        sm.onProgressChanged = (f, t) => progressBar.update(f, t);
        sm.onBrushComplete = (bi) => {
            palettePanel?.markBrushComplete(bi);
            palettePanel?.autoSelectNextUnfinished(bi, isBrushComplete);
            ctx.refreshDetailVisibility();
        };

        const initP = sm.getProgress();
        progressBar.update(initP.filled, initP.total);
        for (let i = 0; i < sm.brushTotalCounts.length; i++) {
            if (isBrushComplete(i)) palettePanel?.markBrushComplete(i);
        }

        this._buildBackButton(hudLayer, vs.width);

        const touchHost = ctx.brushLayer.node;
        touchHost.addComponent(BoardTouchInput).init(ctx);
        gameLayer.addComponent(BoardViewportInput).init(ctx);
        gameLayer.addComponent(BoardRootPanInput).init(ctx);
    }

    private _buildBackButton(parent: Node, viewW: number): void {
        const btn = new Node('BackBtn');
        parent.addChild(btn);
        btn.setPosition(-viewW / 2 + 60, parent.getComponent(UITransform)!.height / 2 - 50, 0);

        const ut = btn.addComponent(UITransform);
        ut.setContentSize(80, 50);

        const lab = btn.addComponent(Label);
        lab.string = '< 返回';
        lab.fontSize = 30;
        lab.horizontalAlign = Label.HorizontalAlign.CENTER;
        lab.verticalAlign = Label.VerticalAlign.CENTER;
        lab.color = new Color(60, 60, 60, 255);

        const button = btn.addComponent(Button);
        button.target = btn;
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 0.9;
        button.node.on(Button.EventType.CLICK, () => this._confirmExit());
    }

    private _confirmExit(): void {
        const layer = this._popupLayer;
        if (!layer) return;
        ExitConfirmPopup.show(layer, () => {}, () => this._onBack?.());
    }

    private _handleToolClick(type: ToolType): void {
        const ctx = this._ctx;
        const ts = this._toolState;
        if (!ctx || !ts) return;
        if (ts.getCount(type) <= 0) {
            if (this._topLayer) showToast(this._topLayer, '道具次数不足');
            return;
        }

        const def = ToolDefs.find(d => d.type === type);
        if (!def) return;

        if (def.triggerMode === ToolTriggerMode.ClickTool) {
            this._executeMagnifier(ctx, ts);
            return;
        }
        ts.activate(type);
    }

    private _executeMagnifier(ctx: BoardRuntimeContext, ts: ToolState): void {
        const isFilled = (r: number, c: number) =>
            cellFilled(ctx.boardData, ctx.brushLayer.pixelBuffer, r, c);

        let region = ToolExecutor.magnifierFind(ctx.brushState.currentIndex, ctx.boardData, isFilled);

        if (region.length === 0) {
            const nextBrush = this._findNextUnfinishedBrush(ctx);
            if (nextBrush >= 0 && nextBrush !== ctx.brushState.currentIndex) {
                ctx.brushState.currentIndex = nextBrush;
                ctx.refreshDetailVisibility();
                region = ToolExecutor.magnifierFind(nextBrush, ctx.boardData, isFilled);
            }
        }
        if (region.length === 0) {
            if (this._topLayer) showToast(this._topLayer, '当前颜色已涂完');
            return;
        }

        if (!ts.consume(ToolType.Magnifier)) return;
        ctx.magnifierEffect.start(region, ctx);
    }

    private _findNextUnfinishedBrush(ctx: BoardRuntimeContext): number {
        const sm = ctx.saveManager;
        const paletteLen = sm.brushTotalCounts.length;
        const cur = ctx.brushState.currentIndex;
        for (let offset = 1; offset < paletteLen; offset++) {
            const idx = (cur + offset) % paletteLen;
            if (sm.brushTotalCounts[idx] > 0 && sm.brushFilledCounts[idx] < sm.brushTotalCounts[idx]) {
                return idx;
            }
        }
        return -1;
    }

    private _showCompletion(): void {
        const layer = this._popupLayer;
        const ctx = this._ctx;
        const puzzle = this._currentPuzzle;
        if (!layer || !ctx || !puzzle) return;
        const vs = view.getVisibleSize();
        const history = [...ctx.saveManager.record.getHistory()];
        CompletionPopup.show(layer, vs.width, vs.height, puzzle, history, () => this._onBack?.());
    }

    private _createLayer(name: string, vs: { width: number; height: number }): Node {
        const layer = new Node(name);
        this.node.addChild(layer);
        const ut = layer.addComponent(UITransform);
        ut.setContentSize(vs.width, vs.height);
        return layer;
    }
}
