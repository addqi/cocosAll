import { _decorator, Color, Component, Material, Node, Sprite, SpriteFrame, UITransform, view, Widget } from 'cc';
import { GameConfig } from './config/GameConfig';
import { LevelEntry } from './config/LevelManifest';
import { HomePage } from './ui/home/HomePage';
import { GamePage, GamePageAssets } from './ui/game/GamePage';
import { MyWorksPage } from './ui/myworks/MyWorksPage';
import { ToolState } from './core/tool/ToolState';

const { ccclass, property } = _decorator;

/**
 * 场景唯一入口 — 总管理器。
 * 持有编辑器拖入的共享资源，创建并管理 HomePage / GamePage / MyWorksPage。
 */
@ccclass('AppRoot')
export class AppRoot extends Component {

    /* ── 编辑器引用（只保留必须拖入的资源） ── */

    @property({ type: Material, displayName: 'Digit 材质' })
    digitMaterial: Material = null!;

    @property({ type: SpriteFrame, displayName: '调色块底图' })
    paletteItemSprite: SpriteFrame = null!;

    /* ── 页面引用 ── */

    private _homeNode: Node = null!;
    private _gameNode: Node = null!;
    private _myWorksNode: Node = null!;

    private _homePage: HomePage = null!;
    private _gamePage: GamePage = null!;
    private _myWorksPage: MyWorksPage = null!;
    private _toolState: ToolState = null!;

    start(): void {
        const vs = view.getVisibleSize();
        const rootUt = this.node.getComponent(UITransform);
        if (rootUt) rootUt.setContentSize(vs.width, vs.height);

        this._toolState = new ToolState();
        this._createBackground(vs);
        this._createPages(vs);
        this.showHome();
    }

    /* ── 页面切换 ── */

    showHome(): void {
        this._gamePage.cleanup();
        this._homeNode.active = true;
        this._gameNode.active = false;
        this._homePage.refreshList();
    }

    showGame(entry: LevelEntry): void {
        this._homeNode.active = false;
        this._gameNode.active = true;
        this._gamePage.startLevel(entry);
    }

    showMyWorks(): void {
        this._myWorksPage.show();
    }

    private _onMyWorksDismissed(): void {
        // this._homePage.refreshList();
    }

    /* ── 内部构建 ── */

    private _createBackground(vs: { width: number; height: number }): void {
        const bg = new Node('Background');
        this.node.addChild(bg);
        const ut = bg.addComponent(UITransform);
        ut.setContentSize(vs.width, vs.height);
        const sp = bg.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.color = Color.WHITE;
        const w = bg.addComponent(Widget);
        w.isAlignTop = true;    w.top = 0;
        w.isAlignBottom = true; w.bottom = 0;
        w.isAlignLeft = true;   w.left = 0;
        w.isAlignRight = true;  w.right = 0;
        w.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;
    }

    private _createPages(vs: { width: number; height: number }): void {
        // HomePage
        this._homeNode = this._createPageNode('HomePage', vs);
        this._homePage = this._homeNode.addComponent(HomePage);
        this._homePage.init(
            (entry) => this.showGame(entry),
            () => this.showMyWorks(),
        );

        // GamePage
        this._gameNode = this._createPageNode('GamePage', vs);
        this._gamePage = this._gameNode.addComponent(GamePage);
        this._gamePage.init(this._buildGameAssets(), this._toolState, () => this.showHome());

        // MyWorksPage — standalone page, slides in from right
        this._myWorksNode = this._createPageNode('MyWorksPage', vs);
        this._myWorksPage = this._myWorksNode.addComponent(MyWorksPage);
        this._myWorksPage.init(() => this._onMyWorksDismissed());
    }

    private _createPageNode(name: string, vs: { width: number; height: number }): Node {
        const node = new Node(name);
        this.node.addChild(node);
        const ut = node.addComponent(UITransform);
        ut.setContentSize(vs.width, vs.height);
        return node;
    }

    private _buildGameAssets(): GamePageAssets {
        const C = GameConfig;
        const hex = (v: number) => new Color((v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff, 255);
        return {
            digitMaterial: this.digitMaterial,
            paletteItemSprite: this.paletteItemSprite,
            cellDisplaySize: C.defaultCellDisplaySize,
            paletteStyle: {
                itemWidth: C.paletteItemWidth,
                itemHeight: C.paletteItemHeight,
                itemSpacing: C.paletteItemSpacing,
                padding: C.palettePadding,
                labelFontSize: C.paletteLabelFontSize,
                ringColor: hex(C.paletteRingColor),
                ringOutset: C.paletteRingOutset,
                itemRootOutset: C.paletteItemRootOutset,
            useContrastLabel: C.paletteUseContrastLabel,
            labelFixedColor: hex(C.paletteLabelFixedColor),
            columnsPerPage: C.paletteColumnsPerPage,
            rowsPerPage: C.paletteRowsPerPage,
            swipeThreshold: C.paletteSwipeThreshold,
            snapSpeed: C.paletteSnapSpeed,
            defaultPage: C.paletteDefaultPage,
        },
        };
    }
}
