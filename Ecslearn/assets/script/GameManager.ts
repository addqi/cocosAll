import { _decorator, Component, Node, Canvas, UITransform, Widget, view, director } from 'cc';
import { GameLoop } from './game/core/GameLoop';
import { ResourceState } from './game/core/ResourceState';
import { PlayerControl } from './game/player/PlayerControl';
import { LevelManager } from './game/level/LevelManager';
import { TileMapRenderer } from './game/map/TileMapRenderer';
import { TestManager } from './game/test/TestManager';
import { UpgradeOfferPanel } from './game/ui/UpgradeOfferPanel';
import { VictoryPanel } from './game/ui/VictoryPanel';
import { GameOverPanel } from './game/ui/GameOverPanel';

const { ccclass, property } = _decorator;

/**
 * GameManager — 场景唯一挂载脚本。
 *
 * 节点层级（后 addChild = 上层）：
 *   GameRoot
 *   ├── Map                ← 1 最底（地形）
 *   ├── GameLoop           ← 2 持有 Projectile/SpriteNodeFactory 层
 *   ├── Enemies            ← 3
 *   ├── Player             ← 4
 *   ├── LevelManager       ← 5
 *   └── UiCanvas           ← 6 最顶（关卡 UI：升级面板/Victory/GameOver）
 *        ├── UpgradeOfferPanel (active=false)
 *        ├── VictoryPanel      (active=false)
 *        └── GameOverPanel     (active=false)
 *
 * 时序：
 *   1. onLoad 建节点骨架 + 挂 GameLoop（异步 preload 开始）
 *   2. 单测立即跑（纯数据，无依赖）
 *   3. ResourceState.onReady → 挂 Map/Player/LevelManager + UI Panels
 */
@ccclass('GameManager')
export class GameManager extends Component {

    @property({ tooltip: '是否自动运行 TestRegistry 里登记的全部单测；发布前关掉' })
    runTests = true;

    private _mapNode!: Node;
    private _gameLoopNode!: Node;
    private _enemiesParent!: Node;
    private _playerNode!: Node;
    private _levelNode!: Node;
    private _uiCanvasNode!: Node;
    private _upgradePanelNode!: Node;
    private _victoryPanelNode!: Node;
    private _gameOverPanelNode!: Node;

    onLoad(): void {
        this._mapNode        = this._addChild('Map');
        this._gameLoopNode   = this._addChild('GameLoop');
        this._enemiesParent  = this._addChild('Enemies');
        this._playerNode     = this._addChild('Player');
        this._levelNode      = this._addChild('LevelManager');
        this._uiCanvasNode   = this._buildUiCanvas();

        this._gameLoopNode.addComponent(GameLoop);

        if (this.runTests) {
            this._addChild('TestManager').addComponent(TestManager);
        }

        ResourceState.onReady(() => this._initAfterReady());
    }

    private _addChild(name: string): Node {
        const n = new Node(name);
        this.node.addChild(n);
        return n;
    }

    /** UI 层必须有 Canvas + UITransform 才能正常渲染 UI */
    private _buildUiCanvas(): Node {
        const n = new Node('UiCanvas');
        this.node.addChild(n);

        const size = view.getVisibleSize();
        const ut = n.addComponent(UITransform);
        ut.setContentSize(size);

        const canvas = n.addComponent(Canvas);
        // 用场景里现有的 cc.Camera —— 运行时才有，UI 一般会自动挂主相机
        const mainCam = director.getScene()?.getComponentInChildren('cc.Camera' as any);
        if (mainCam) canvas.cameraComponent = mainCam as any;

        const widget = n.addComponent(Widget);
        widget.isAlignTop = widget.isAlignBottom = true;
        widget.isAlignLeft = widget.isAlignRight = true;
        widget.top = widget.bottom = widget.left = widget.right = 0;

        // 三个 Panel（初始 inactive，自己 onLoad 里 active=false）
        this._upgradePanelNode  = this._addUiChild(n, 'UpgradeOfferPanel');
        this._victoryPanelNode  = this._addUiChild(n, 'VictoryPanel');
        this._gameOverPanelNode = this._addUiChild(n, 'GameOverPanel');

        return n;
    }

    private _addUiChild(parent: Node, name: string): Node {
        const n = new Node(name);
        parent.addChild(n);
        const ut = n.addComponent(UITransform);
        ut.setContentSize(view.getVisibleSize());
        return n;
    }

    private _initAfterReady(): void {
        this._mapNode.addComponent(TileMapRenderer);
        this._playerNode.addComponent(PlayerControl);

        // UI Panel 组件在资源就绪后挂（白色 SpriteFrame 来自 Canvas Texture2D，
        // 虽然纯代码生成但延后挂更干净，和其他 UI 同时可见）
        const upgradePanel  = this._upgradePanelNode.addComponent(UpgradeOfferPanel);
        const victoryPanel  = this._victoryPanelNode.addComponent(VictoryPanel);
        const gameOverPanel = this._gameOverPanelNode.addComponent(GameOverPanel);

        const lm = this._levelNode.addComponent(LevelManager);
        lm.bind({
            gameRoot:      this.node,
            enemiesParent: this._enemiesParent,
            playerNode:    this._playerNode,
            victoryPanel,
            gameOverPanel,
        });

        // upgradePanel 以事件总线为唯一通信入口，这里仅保留节点引用避免未使用告警
        void upgradePanel;
    }
}
