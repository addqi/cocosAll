import {
    _decorator, Component, Node, Canvas, UITransform, Widget, Camera, Color, Layers,
    view, director,
} from 'cc';
import { on, off } from './baseSystem/util';
import { GameLoop } from './game/core/GameLoop';
import { ResourceState } from './game/core/ResourceState';
import { PlayerControl } from './game/player/PlayerControl';
import { LevelManager } from './game/level/LevelManager';
import { TileMapRenderer } from './game/map/TileMapRenderer';
import { TestManager } from './game/test/TestManager';
import { UpgradeOfferPanel } from './game/ui/UpgradeOfferPanel';
import { VictoryPanel } from './game/ui/VictoryPanel';
import { GameOverPanel } from './game/ui/GameOverPanel';
import { ClassSelectPanel } from './game/ui/ClassSelectPanel';
import { VirtualInputPanel } from './game/ui/VirtualInputPanel';
import { GameEvt, type ClassChosenEvent } from './game/events/GameEvents';

const { ccclass, property } = _decorator;

/**
 * GameManager — 场景唯一挂载脚本。
 *
 * 节点层级：
 *   GameRoot
 *   ├── Map / GameLoop / Enemies / Player / LevelManager  ← 世界层（主相机渲染）
 *   ├── UiCamera                                          ← UI 专用相机（不跟随玩家）
 *   └── UiCanvas (Layer=UI_2D)                            ← UI 层（UiCamera 渲染）
 *        ├── UpgradeOfferPanel
 *        ├── VictoryPanel
 *        ├── GameOverPanel
 *        ├── ClassSelectPanel
 *        └── VirtualInputPanel                            ← 摇杆 + 攻击按钮
 *
 * UI 不跟随相机的关键设计（Layer + Camera 分离）：
 *   - 主相机 (visibility 去掉 UI_2D bit)：跟随玩家移动，只看世界节点
 *   - UI 相机 (visibility = UI_2D)：固定不动，只看 UiCanvas 子树
 *   - UiCanvas 整树 layer = UI_2D
 *   - 主相机移动时，UiCanvas 不被它渲染，所以 UI 在屏幕上保持固定
 *
 * 启动时序：
 *   1. onLoad 建节点骨架 + 挂 GameLoop（异步 preload 开始）
 *   2. 单测立即跑（纯数据，无依赖）
 *   3. ResourceState.onReady → 挂 Map/Player + UI Panels
 *   4. ClassSelectPanel.show() 弹出流派选择
 *   5. 监听 GameEvt.ClassChosen：
 *      - PlayerControl.setPlayerClass(id)
 *      - 挂 LevelManager（Wave 1 正式启动）
 *      - off 监听（一次性）
 */
@ccclass('GameManager')
export class GameManager extends Component {

    @property({ tooltip: '是否自动运行 TestRegistry 里登记的全部单测；发布前关掉' })
    runTests = true;

    @property({ tooltip: 'ui摄像机',type: Camera })
    uiCamera!: Camera;

    private _mapNode!: Node;
    private _gameLoopNode!: Node;
    private _enemiesParent!: Node;
    private _playerNode!: Node;
    private _levelNode!: Node;
    private _uiCanvasNode!: Node;
    private _upgradePanelNode!: Node;
    private _victoryPanelNode!: Node;
    private _gameOverPanelNode!: Node;
    private _classPanelNode!: Node;
    private _virtualInputNode!: Node;
    private _uiCameraNode!: Node;

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

    /**
     * UI 层构建。
     *
     * 关键：用独立 UI Camera 渲染 UI，避免主相机跟随玩家时 UI 跟着漂。
     *   - 主相机 visibility 去掉 UI_2D bit → 主相机不画 UI
     *   - UI Camera visibility = UI_2D     → UI Camera 只画 UI
     *   - UiCanvas 子树 layer = UI_2D      → 所有 UI 节点归属 UI 层
     */
    private _buildUiCanvas(): Node {
        // 1. 主相机去掉 UI_2D bit（确保它不会再画 UI 节点跟着玩家漂）
        this._excludeMainCamFromUiLayer();

        // 2. UI 专用相机（独立节点，不跟随玩家）
        this._uiCameraNode = this._buildUiCamera();

        // 3. UiCanvas 节点
        const n = new Node('UiCanvas');
        this.node.addChild(n);
        n.layer = Layers.Enum.UI_2D;

        const size = view.getVisibleSize();
        const ut = n.addComponent(UITransform);
        ut.setContentSize(size);

        const canvas = n.addComponent(Canvas);
        canvas.alignCanvasWithScreen = true;
        const uiCam = this._uiCameraNode.getComponent(Camera);
        canvas.cameraComponent = uiCam;
        console.log(
            `[GameManager] UiCanvas bound to UI Camera; uiCam.visibility=0x${uiCam?.visibility.toString(16)}, priority=${uiCam?.priority}, far=${uiCam?.far}`,
        );

        const widget = n.addComponent(Widget);
        widget.isAlignTop = widget.isAlignBottom = true;
        widget.isAlignLeft = widget.isAlignRight = true;
        widget.top = widget.bottom = widget.left = widget.right = 0;

        // 四个 Panel（初始 inactive，自己 onLoad 里 active=false）
        this._upgradePanelNode  = this._addUiChild(n, 'UpgradeOfferPanel');
        this._victoryPanelNode  = this._addUiChild(n, 'VictoryPanel');
        this._gameOverPanelNode = this._addUiChild(n, 'GameOverPanel');
        this._classPanelNode    = this._addUiChild(n, 'ClassSelectPanel');
        // 虚拟输入面板（始终可见的常驻 UI，不像其他 Panel 要 active=false）
        this._virtualInputNode  = this._addUiChild(n, 'VirtualInputPanel');

        return n;
    }

    private _addUiChild(parent: Node, name: string): Node {
        const n = new Node(name);
        parent.addChild(n);
        n.layer = Layers.Enum.UI_2D;
        const ut = n.addComponent(UITransform);
        ut.setContentSize(view.getVisibleSize());
        return n;
    }

    /**
     * 创建独立 UI Camera。
     *
     * 设计：
     *   - Ortho 投影，orthoHeight = 屏幕半高（标准 UI 视野）
     *   - ClearFlag.DEPTH_ONLY：不重置颜色 buffer，保留主相机已渲染的世界画面
     *   - Visibility = UI_2D：只渲染 UI 层节点
     *   - Priority 高于主相机：保证 UI 在最上层渲染
     */
    private _buildUiCamera(): Node {
        const n = new Node('UiCamera');
        this.node.addChild(n);
        n.layer = Layers.Enum.UI_2D;
        n.setPosition(0, 0, 100);

        const cam = n.addComponent(Camera);
        cam.projection = Camera.ProjectionType.ORTHO;
        cam.orthoHeight = view.getVisibleSize().height / 2;
        cam.near = 1;
        cam.far  = 2000;
        // priority 越大越后渲染。必须比主相机大，否则主相机后画会覆盖 UI。
        // 主相机 priority 在 _excludeMainCamFromUiLayer 时已记录到 _mainCamPriority。
        cam.priority = 1000;
        cam.clearFlags = Camera.ClearFlag.DEPTH_ONLY;
        cam.clearColor = new Color(0, 0, 0, 0);
        cam.visibility = Layers.Enum.UI_2D;
        console.log(
            `[GameManager] UI cam priority set to ${cam.priority} (main cam priority=${this._mainCamPriority})`,
        );
        return n;
    }

    /**
     * 主相机的 visibility 默认包含所有 layer。
     * 我们要把 UI_2D bit 摘掉 —— 主相机不画 UI 节点，UI 才不会跟着玩家漂。
     * 同时记录主相机 priority，UI Camera 设比它更大（保证 UI 最后渲染，在最上层）。
     */
    private _mainCamPriority = 0;
    private _excludeMainCamFromUiLayer(): void {
        const mainCam = director.getScene()?.getComponentInChildren(Camera);
        if (!mainCam) {
            console.warn('[GameManager] 场景里找不到主相机；UI 分离失败');
            return;
        }
        const before = mainCam.visibility;
        mainCam.visibility = before & ~Layers.Enum.UI_2D;
        this._mainCamPriority = mainCam.priority;
        console.log(
            `[GameManager] main cam visibility: 0x${before.toString(16)} → 0x${mainCam.visibility.toString(16)}; UI_2D bit=0x${Layers.Enum.UI_2D.toString(16)}; main cam priority=${mainCam.priority}`,
        );
    }

    /**
     * 把节点 + 所有子孙节点的 layer 递归设为指定值。
     *
     * 用于：UI Panel addComponent 后，组件 onLoad 里建的子节点 layer 可能仍是 DEFAULT，
     * 此方法兜底批量改成 UI_2D。
     */
    private _setLayerDeep(node: Node, layer: number): void {
        node.layer = layer;
        for (const c of node.children) this._setLayerDeep(c, layer);
    }

    /** 调试：打印 UI 子树所有节点的 layer / 渲染组件信息 */
    private _dumpUiTree(node: Node, depth = 0): void {
        const indent = '  '.repeat(depth);
        const layerHex = `0x${node.layer.toString(16)}`;
        const hasSprite = node.getComponent('cc.Sprite' as any) ? 'Sprite' : '';
        const hasLabel  = node.getComponent('cc.Label' as any)  ? 'Label'  : '';
        const renderers = [hasSprite, hasLabel].filter(Boolean).join(',');
        console.log(`[UiTree] ${indent}${node.name} layer=${layerHex} active=${node.active} ${renderers}`);
        for (const c of node.children) this._dumpUiTree(c, depth + 1);
    }

    private _initAfterReady(): void {
        this._mapNode.addComponent(TileMapRenderer);
        const player = this._playerNode.addComponent(PlayerControl);

        // UI Panel 组件在资源就绪后挂
        const upgradePanel  = this._upgradePanelNode.addComponent(UpgradeOfferPanel);
        const victoryPanel  = this._victoryPanelNode.addComponent(VictoryPanel);
        const gameOverPanel = this._gameOverPanelNode.addComponent(GameOverPanel);
        const classPanel    = this._classPanelNode.addComponent(ClassSelectPanel);
        // 虚拟输入面板（手机摇杆 + 攻击按钮）—— 始终常驻
        this._virtualInputNode.addComponent(VirtualInputPanel);

        // Panel 的 onLoad 在 addComponent 时已同步执行；它们建出的子节点 layer 默认 DEFAULT，
        // 兜底递归改成 UI_2D，保证 UI Camera 能渲染整棵 UI 子树。
        this._setLayerDeep(this._uiCanvasNode, Layers.Enum.UI_2D);

        // 调试 dump（确认 UI 树 layer 都 = 0x2000000；定位后请删）
        console.log(`[GameManager] ===== UI tree dump =====`);
        this._dumpUiTree(this._uiCanvasNode);
        // 也 dump 一下 UI Camera 节点（确认它没被错误归到 UI 层）
        console.log(`[GameManager] UI camera node layer=0x${this._uiCameraNode.layer.toString(16)} active=${this._uiCameraNode.active}`);

        // ─── 两阶段启动：等玩家选流派，再挂 LevelManager ─────────────
        // 一次性监听：闭包引用 onChosen 自身，触发后立即 off
        const onChosen = (e: ClassChosenEvent): void => {
            off(GameEvt.ClassChosen, onChosen);
            player.setPlayerClass(e.id);

            const lm = this._levelNode.addComponent(LevelManager);
            lm.bind({
                gameRoot:      this.node,
                enemiesParent: this._enemiesParent,
                playerNode:    this._playerNode,
                victoryPanel,
                gameOverPanel,
            });
        };
        on(GameEvt.ClassChosen, onChosen);

        classPanel.show();

        // upgradePanel 以事件总线为唯一通信入口，这里仅保留节点引用避免未使用告警
        void upgradePanel;
    }
}
