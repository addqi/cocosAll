import { _decorator, Color, Component, log, Material, Node, SpriteFrame, UITransform, view } from 'cc';
import { GameConfig } from './config/GameConfig';
import { LevelEntry } from './config/LevelManifest';
import { HomePage } from './ui/home/HomePage';
import { GamePage, GamePageAssets } from './ui/game/GamePage';

const { ccclass, property } = _decorator;

/**
 * 场景唯一入口 — 总管理器。
 * 持有编辑器拖入的共享资源，创建并管理 HomePage / GamePage / MyWorksPage。
 */
@ccclass('AppRoot')
export class AppRoot extends Component {

    /* ── 编辑器属性（从原 GameManager 搬过来） ── */

    @property({ displayName: '格子显示边长', tooltip: '单格在屏幕上的像素边长' })
    cellDisplaySize = GameConfig.defaultCellDisplaySize;

    @property({ type: Material, displayName: 'Digit 材质' })
    digitMaterial: Material = null!;

    @property({ type: SpriteFrame, displayName: '调色块底图' })
    paletteItemSprite: SpriteFrame = null!;

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

    /* ── 页面引用 ── */

    private _homeNode: Node = null!;
    private _gameNode: Node = null!;
    private _myWorksNode: Node = null!;

    private _homePage: HomePage = null!;
    private _gamePage: GamePage = null!;

    start(): void {
        const vs = view.getVisibleSize();
        const rootUt = this.node.getComponent(UITransform);
        if (rootUt) rootUt.setContentSize(vs.width, vs.height);

        this._createPages(vs);
        this.showHome();
    }

    /* ── 页面切换 ── */

    showHome(): void {
        this._gamePage.cleanup();
        this._homeNode.active = true;
        this._gameNode.active = false;
        this._myWorksNode.active = false;
    }

    showGame(entry: LevelEntry): void {
        this._homeNode.active = false;
        this._gameNode.active = true;
        this._myWorksNode.active = false;
        this._gamePage.startLevel(entry);
    }

    showMyWorks(): void {
        log('[AppRoot] MyWorks — 尚未实现');
    }

    /* ── 内部构建 ── */

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
        this._gamePage.init(this._buildGameAssets(), () => this.showHome());

        // MyWorksPage（预留空节点）
        this._myWorksNode = this._createPageNode('MyWorksPage', vs);
    }

    private _createPageNode(name: string, vs: { width: number; height: number }): Node {
        const node = new Node(name);
        this.node.addChild(node);
        const ut = node.addComponent(UITransform);
        ut.setContentSize(vs.width, vs.height);
        return node;
    }

    private _buildGameAssets(): GamePageAssets {
        return {
            digitMaterial: this.digitMaterial,
            paletteItemSprite: this.paletteItemSprite,
            cellDisplaySize: this.cellDisplaySize,
            paletteStyle: {
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
            },
        };
    }
}
