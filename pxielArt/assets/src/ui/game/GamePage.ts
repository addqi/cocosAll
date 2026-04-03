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
    Widget,
} from 'cc';
import { GameConfig } from '../../config/GameConfig';
import { LevelEntry } from '../../config/LevelManifest';
import { BoardBootstrap } from '../../game/BoardBootstrap';
import { PaletteInstaller, PaletteInstallerOptions } from '../../game/PaletteInstaller';
import { BoardRootPanInput } from '../../core/input/BoardRootPanInput';
import { BoardTouchInput } from '../../core/input/BoardTouchInput';
import { BoardViewportInput } from '../../core/input/BoardViewportInput';
import { BoardRuntimeContext } from '../../game/BoardRuntimeContext';
import { PuzzleData } from '../../types/types';

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
    private _ctx: BoardRuntimeContext | null = null;

    init(assets: GamePageAssets, onBack: () => void): void {
        this._assets = assets;
        this._onBack = onBack;
    }

    startLevel(entry: LevelEntry): void {
        this.cleanup();
        resources.load(entry.jsonPath, JsonAsset, (err, jsonAsset) => {
            if (err || !jsonAsset) return;
            this._buildGame(jsonAsset.json as PuzzleData);
        });
    }

    cleanup(): void {
        this._ctx = null;
        this.node.removeAllChildren();
    }

    private _buildGame(puzzle: PuzzleData): void {
        const a = this._assets!;
        const vs = view.getVisibleSize();

        const gameLayer = this._createLayer('GameLayer', vs);
        const hudLayer = this._createLayer('HudLayer', vs);
        this._createLayer('PopupLayer', vs);
        this._createLayer('TopLayer', vs);

        const ctx = BoardBootstrap.run({
            boardRoot: gameLayer,
            puzzle,
            cellDisplaySize: a.cellDisplaySize,
            digitMaterial: a.digitMaterial,
            viewport: {
                zoomStep: GameConfig.viewportZoomStep,
                zoomSpeedPerSecond: GameConfig.viewportZoomSpeedPerSecond,
                autoFitInitial: GameConfig.viewportAutoFit,
            },
        });
        this._ctx = ctx;

        if (a.paletteItemSprite) {
            PaletteInstaller.install(
                hudLayer,
                ctx.boardData.palette,
                ctx.brushState,
                a.paletteItemSprite,
                {
                    ...a.paletteStyle,
                    onBrushIndexChanged: () => ctx.refreshDetailVisibility(),
                },
            );
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
        button.node.on(Button.EventType.CLICK, () => this._onBack?.());
    }

    private _createLayer(name: string, vs: { width: number; height: number }): Node {
        const layer = new Node(name);
        this.node.addChild(layer);
        const ut = layer.addComponent(UITransform);
        ut.setContentSize(vs.width, vs.height);
        return layer;
    }
}
