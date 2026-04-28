import {
    _decorator, Component, Node, Canvas, UITransform, Camera, Layers,
    director,
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
import { SkillBarPanel } from './game/ui/SkillBarPanel';
import { RawInputSystem } from './game/system/RawInputSystem';
import { GameEvt, type ClassChosenEvent } from './game/events/GameEvents';

const { ccclass, property } = _decorator;

/**
 * GameManager — 场景唯一挂载脚本。
 *
 * 推荐场景结构（编辑器手动准备，不再代码生成 Canvas / UI Camera）：
 *   test (Scene)
 *   └── Canvas                   ← 主 Canvas（编辑器原有，绑主相机）
 *       ├── Camera               ← 主相机（visibility 不含 UI_2D）
 *       ├── Node                 ← GameManager 挂这里（this.node = 世界根）
 *       │   ├── Map / GameLoop / Enemies / Player / LevelManager
 *       │   └── (代码动态生成，layer = DEFAULT)
 *       └── uiCanvas             ← 独立 UI Canvas（this.uiCanvas，@property 拖入）
 *           ├── Camera           ← UI 相机（visibility=UI_2D, priority>主相机, ClearFlags=DEPTH_ONLY）
 *           └── (代码动态生成的 UI 子节点，layer = UI_2D)
 *               ├── UpgradeOfferPanel / VictoryPanel / GameOverPanel
 *               ├── ClassSelectPanel
 *               └── VirtualInputPanel
 *
 * 双重隔离（物理 + 逻辑）保证 UI 不跟随玩家：
 *   - 物理：UI 节点挂 uiCanvas 子树，世界节点挂 this.node 子树，渲染由不同 Canvas 调度
 *   - 逻辑：UI 节点 layer = UI_2D，世界节点 layer = DEFAULT；
 *     主相机 visibility 排除 UI_2D，UI 相机 visibility 只含 UI_2D
 *
 * 编辑器需要保证的 uiCanvas Camera 配置（代码会兜底强制覆盖以防漏配）：
 *   - ClearFlags = DEPTH_ONLY    （否则后渲染时清屏 → "非此即彼"）
 *   - Priority   > 主相机         （否则被主相机后渲染覆盖）
 *   - Visibility = UI_2D          （只画 UI 子树）
 *
 * 启动时序：
 *   1. onLoad 建世界节点骨架 + 接管 uiCanvas + 挂 GameLoop
 *   2. 单测立即跑（纯数据，无依赖）
 *   3. ResourceState.onReady → 挂 Map/Player + UI Panels
 *   4. ClassSelectPanel.show() 弹出流派选择
 *   5. 监听 GameEvt.ClassChosen：setPlayerClass + 挂 LevelManager + 一次性 off
 */
@ccclass('GameManager')
export class GameManager extends Component {

    @property({ tooltip: '是否自动运行 TestRegistry 里登记的全部单测；发布前关掉' })
    runTests = true;

    @property({ tooltip: '禁用鼠标点击攻击（让虚拟攻击按钮独占；PC 调试虚拟按钮时勾上）' })
    disableMouseClick = true;

    @property({ tooltip: 'UI 专用 Canvas（含 UI Camera 子节点）—— 编辑器手动建好后拖入', type: Canvas })
    uiCanvas!: Canvas;

    private _mapNode!: Node;
    private _gameLoopNode!: Node;
    private _enemiesParent!: Node;
    private _playerNode!: Node;
    private _levelNode!: Node;
    private _uiCanvasNode!: Node;            // 实际指向 this.uiCanvas.node
    private _upgradePanelNode!: Node;
    private _victoryPanelNode!: Node;
    private _gameOverPanelNode!: Node;
    private _classPanelNode!: Node;
    private _virtualInputNode!: Node;
    private _skillBarNode!: Node;

    onLoad(): void {
        // 输入系统全局开关：调试期让虚拟攻击按钮独占，避免鼠标点击双重触发
        RawInputSystem.disableMouseClick = this.disableMouseClick;

        this._mapNode        = this._addWorldChild('Map');
        this._gameLoopNode   = this._addWorldChild('GameLoop');
        this._enemiesParent  = this._addWorldChild('Enemies');
        this._playerNode     = this._addWorldChild('Player');
        this._levelNode      = this._addWorldChild('LevelManager');
        this._uiCanvasNode   = this._setupUiCanvas();

        this._gameLoopNode.addComponent(GameLoop);

        if (this.runTests) {
            this._addWorldChild('TestManager').addComponent(TestManager);
        }

        ResourceState.onReady(() => this._initAfterReady());
    }

    /** 在 GameManager 节点下建一个世界子节点（layer 默认 DEFAULT，主相机渲染）*/
    private _addWorldChild(name: string): Node {
        const n = new Node(name);
        this.node.addChild(n);
        return n;
    }

    /**
     * 接管编辑器预建的 uiCanvas，并在它下面建 5 个 UI Panel 容器节点。
     *
     * 不再代码创建 Canvas / Camera —— 那些都已在编辑器配置好（含 cameraComponent 自动绑定）。
     * 本方法只做：
     *   1. 主相机 visibility 排除 UI_2D（兜底）
     *   2. uiCanvas.cameraComponent 兜底配置 visibility / clearFlags / priority
     *   3. 在 uiCanvas.node 下建 5 个 Panel 容器节点（layer = UI_2D）
     */
    private _setupUiCanvas(): Node {
        if (!this.uiCanvas?.node?.isValid) {
            console.error('[GameManager] uiCanvas 未在 Inspector 绑定 —— UI 将无法渲染');
            return this.node;   // 退化：返回世界根，避免后续空指针
        }

        // 1. 主相机 visibility 排除 UI_2D（layer 隔离的主相机一侧兜底）
        this._excludeMainCamFromUiLayer();

        // 2. UI 相机参数兜底 —— 防止编辑器配置漏改导致渲染异常
        this._enforceUiCameraConfig();

        const n = this.uiCanvas.node;

        // 3. 在 uiCanvas 下建 6 个 Panel 容器（active 状态由各自 Panel.onLoad 管）
        this._upgradePanelNode  = this._addUiChild(n, 'UpgradeOfferPanel');
        this._victoryPanelNode  = this._addUiChild(n, 'VictoryPanel');
        this._gameOverPanelNode = this._addUiChild(n, 'GameOverPanel');
        this._classPanelNode    = this._addUiChild(n, 'ClassSelectPanel');
        // 虚拟输入面板（始终可见的常驻 UI）
        this._virtualInputNode  = this._addUiChild(n, 'VirtualInputPanel');
        // 技能栏（屏幕右下，始终常驻，每帧轮询）
        this._skillBarNode      = this._addUiChild(n, 'SkillBarPanel');

        return n;
    }

    /** 在 uiCanvas 下建一个 UI 容器节点：layer=UI_2D + 全屏 UITransform */
    private _addUiChild(parent: Node, name: string): Node {
        const n = new Node(name);
        parent.addChild(n);
        n.layer = Layers.Enum.UI_2D;
        const parentUt = parent.getComponent(UITransform);
        const ut = n.addComponent(UITransform);
        if (parentUt) ut.setContentSize(parentUt.contentSize);
        return n;
    }

    /**
     * 主相机 visibility 排除 UI_2D bit。
     *
     * 编辑器创建相机时 visibility 默认通常已不含 UI_2D（如 0x40800000 = DEFAULT|UI_3D），
     * 这步是兜底：万一未来手动勾上 UI_2D 也能被代码自动撤回。
     */
    private _excludeMainCamFromUiLayer(): void {
        const mainCam = director.getScene()?.getComponentInChildren(Camera);
        if (!mainCam) {
            console.warn('[GameManager] 找不到主相机；layer 隔离失败');
            return;
        }
        mainCam.visibility = mainCam.visibility & ~Layers.Enum.UI_2D;
    }

    /**
     * 强制兜底 uiCanvas 上 Camera 的关键配置。
     *
     * 为什么强制：这三个参数是"为了让多相机叠加正常工作"的引擎机制要求，
     * 用户每次调场景都要记住改太反人性，代码统一保证。
     *
     * 主相机 priority 在 Cocos 编辑器中默认 66553（很大），所以 UI 相机要更大
     * 才能保证后渲染。我们读主相机当前值后 + 1000 给 UI 相机。
     */
    private _enforceUiCameraConfig(): void {
        const uiCam = this.uiCanvas.cameraComponent;
        if (!uiCam) {
            console.warn('[GameManager] uiCanvas.cameraComponent 为空 —— 编辑器里 Canvas 应自动绑子节点的 Camera');
            return;
        }
        const mainCam = director.getScene()?.getComponentInChildren(Camera);
        const mainPriority = mainCam?.priority ?? 0;

        uiCam.visibility = Layers.Enum.UI_2D;
        uiCam.clearFlags = Camera.ClearFlag.DEPTH_ONLY;
        uiCam.priority = mainPriority + 1000;
    }

    /**
     * 把节点 + 所有子孙节点的 layer 递归设为 UI_2D。
     *
     * Panel.onLoad 里 _build() 创建的子节点 layer 默认 DEFAULT —— 主相机会画它们 →
     * UI 又会跟着相机漂。本方法在所有 Panel addComponent 后兜底批量改 layer。
     */
    private _setLayerDeep(node: Node, layer: number): void {
        node.layer = layer;
        for (const c of node.children) this._setLayerDeep(c, layer);
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
        // 技能栏（右下角；每帧轮询 PlayerControl.skillSystem）
        this._skillBarNode.addComponent(SkillBarPanel);

        // Panel.onLoad 在 addComponent 时已同步执行；它们建出的子节点 layer 默认 DEFAULT，
        // 兜底递归改成 UI_2D，保证 UI Camera 能渲染整棵 UI 子树（layer 隔离的 UI 一侧兜底）。
        this._setLayerDeep(this._uiCanvasNode, Layers.Enum.UI_2D);

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
