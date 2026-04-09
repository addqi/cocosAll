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
    Sprite,
    SpriteFrame,
    UITransform,
    view,
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
    private _currentLevelId: string | null = null;
    private _popupLayer: Node | null = null;

    init(assets: GamePageAssets, onBack: () => void): void {
        this._assets = assets;
        this._onBack = onBack;
    }

    startLevel(entry: LevelEntry): void {
        this.cleanup();
        this._currentLevelId = entry.id;
        resources.load(entry.jsonPath, JsonAsset, (err, jsonAsset) => {
            if (err || !jsonAsset) return;
            this._buildGame(jsonAsset.json as PuzzleData, entry.id);
        });
    }

    cleanup(): void {
        if (this._ctx) {
            this._ctx.saveManager.forceFlush();
        }
        this._ctx = null;
        this._currentLevelId = null;
        this._popupLayer = null;
        this.node.removeAllChildren();
    }

    private _buildGame(puzzle: PuzzleData, levelId: string): void {
        const a = this._assets!;
        const vs = view.getVisibleSize();

        const gameLayer = this._createLayer('GameLayer', vs);
        const hudLayer = this._createLayer('HudLayer', vs);
        this._popupLayer = this._createLayer('PopupLayer', vs);
        this._createLayer('TopLayer', vs);

        const ctx = BoardBootstrap.run({
            boardRoot: gameLayer,
            puzzle,
            cellDisplaySize: a.cellDisplaySize,
            digitMaterial: a.digitMaterial,
            levelId,
            viewport: {
                zoomStep: GameConfig.viewportZoomStep,
                zoomSpeedPerSecond: GameConfig.viewportZoomSpeedPerSecond,
                autoFitInitial: GameConfig.viewportAutoFit,
            },
        });
        this._ctx = ctx;
        ctx.saveManager.onAllComplete = () => this._showCompletion();

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

    private _showCompletion(): void {
        const layer = this._popupLayer;
        if (!layer) return;
        const vs = view.getVisibleSize();

        const overlay = new Node('BlockInput');
        layer.addChild(overlay);
        overlay.addComponent(UITransform).setContentSize(vs.width, vs.height);
        const oSp = overlay.addComponent(Sprite);
        oSp.sizeMode = Sprite.SizeMode.CUSTOM;
        oSp.color = new Color(0, 0, 0, 150);
        const oBtn = overlay.addComponent(Button);
        oBtn.target = overlay;
        oBtn.transition = Button.Transition.NONE;

        const panel = new Node('Panel');
        layer.addChild(panel);
        panel.addComponent(UITransform).setContentSize(480, 300);
        const pSp = panel.addComponent(Sprite);
        pSp.sizeMode = Sprite.SizeMode.CUSTOM;
        pSp.color = Color.WHITE;

        const title = new Node('Title');
        panel.addChild(title);
        title.setPosition(0, 60, 0);
        title.addComponent(UITransform).setContentSize(400, 80);
        const tLab = title.addComponent(Label);
        tLab.string = '恭喜完成!';
        tLab.fontSize = 48;
        tLab.horizontalAlign = Label.HorizontalAlign.CENTER;
        tLab.verticalAlign = Label.VerticalAlign.CENTER;
        tLab.color = new Color(50, 50, 50, 255);

        const sub = new Node('Sub');
        panel.addChild(sub);
        sub.setPosition(0, 10, 0);
        sub.addComponent(UITransform).setContentSize(400, 40);
        const sLab = sub.addComponent(Label);
        sLab.string = '所有色块已正确填充';
        sLab.fontSize = 24;
        sLab.horizontalAlign = Label.HorizontalAlign.CENTER;
        sLab.verticalAlign = Label.VerticalAlign.CENTER;
        sLab.color = new Color(120, 120, 120, 255);

        const backNode = new Node('BackBtn');
        panel.addChild(backNode);
        backNode.setPosition(0, -70, 0);
        backNode.addComponent(UITransform).setContentSize(220, 60);
        const bSp = backNode.addComponent(Sprite);
        bSp.sizeMode = Sprite.SizeMode.CUSTOM;
        bSp.color = new Color(76, 175, 80, 255);

        const bLab = new Node('Label');
        backNode.addChild(bLab);
        bLab.addComponent(UITransform).setContentSize(220, 60);
        const bl = bLab.addComponent(Label);
        bl.string = '返回首页';
        bl.fontSize = 28;
        bl.horizontalAlign = Label.HorizontalAlign.CENTER;
        bl.verticalAlign = Label.VerticalAlign.CENTER;
        bl.color = Color.WHITE;

        const btn = backNode.addComponent(Button);
        btn.target = backNode;
        btn.transition = Button.Transition.SCALE;
        btn.zoomScale = 0.9;
        btn.node.on(Button.EventType.CLICK, () => this._onBack?.());
    }

    private _createLayer(name: string, vs: { width: number; height: number }): Node {
        const layer = new Node(name);
        this.node.addChild(layer);
        const ut = layer.addComponent(UITransform);
        ut.setContentSize(vs.width, vs.height);
        return layer;
    }
}
