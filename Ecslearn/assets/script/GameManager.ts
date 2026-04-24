import { _decorator, Component, Node } from 'cc';
import { GameLoop } from './game/core/GameLoop';
import { ResourceState } from './game/core/ResourceState';
import { PlayerControl } from './game/player/PlayerControl';
import { LevelManager } from './game/level/LevelManager';
import { TileMapRenderer } from './game/map/TileMapRenderer';
import { TestManager } from './game/test/TestManager';

const { ccclass, property } = _decorator;

/**
 * GameManager — 场景唯一挂载脚本。
 *
 * 职责（全局启动器）：
 *   1. onLoad 一次性建好所有父节点骨架（顺序即层级：后 addChild = 上层）：
 *        Map → GameLoop → Enemies → Player → LevelManager
 *      Map 最底（地形背景），GameLoop 之上（ProjectileLayer / SpriteNodeFactoryRoot
 *      都挂在 GameLoop 节点下，必须不被 Map 遮挡），然后是战斗对象，UI 最顶。
 *   2. GameLoop 组件在 onLoad 阶段就挂，启动 preloadAllResources。
 *   3. 资源就绪后（ResourceState.onReady）再给 Map/Player/LevelManager 挂业务 Component，
 *      因为这些 Component 的 start() 依赖 ResourceMgr 缓存就绪。
 *
 * 使用方式：
 *   新建空场景 → 右键创建节点 `GameRoot` → 添加 `GameManager` 组件 → 保存运行。
 *   不需要拖任何 prefab / UI 引用，全部代码生成。
 *
 * 为什么用 GameManager + LevelManager 两个层：
 *   - GameManager 关心"引擎就绪"：资源、World、Pool、单例
 *   - LevelManager 关心"一局游戏"：波次、清场、暂停、升级、胜利
 *   分层后更换关卡类型（如 Boss 战/挑战/肉鸽）只替换 LevelManager，GameManager 不动。
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
    private _testNode: Node | null = null;

    onLoad(): void {
        // 一次性建好节点骨架，严格按"底层 → 上层"顺序 addChild
        this._mapNode        = this._addChild('Map');          // 1. 最底（渲染背景）
        this._gameLoopNode   = this._addChild('GameLoop');     // 2. 投射物/金币层挂这里
        this._enemiesParent  = this._addChild('Enemies');      // 3. 敌人
        this._playerNode     = this._addChild('Player');       // 4. 玩家
        this._levelNode      = this._addChild('LevelManager'); // 5. 最顶（UI）

        // GameLoop 必须立刻挂 —— preloadAllResources 要尽早启动
        // 此时 _gameLoopNode 已是 _mapNode 的后兄弟，ProjectileLayer 自然在 Map 之上
        this._gameLoopNode.addComponent(GameLoop);

        // 单测可立即跑 —— 不依赖资源预加载（都是纯数据层用例）
        if (this.runTests) this._mountTests();

        // Map/Player/LevelManager 的 Component 依赖资源预加载完成才能正常 start()，
        // 推迟到 ResourceState.onReady 回调
        ResourceState.onReady(() => this._initAfterReady());
    }

    private _mountTests(): void {
        this._testNode = this._addChild('TestManager');
        this._testNode.addComponent(TestManager);
    }

    private _addChild(name: string): Node {
        const n = new Node(name);
        this.node.addChild(n);
        return n;
    }

    private _initAfterReady(): void {
        this._mapNode.addComponent(TileMapRenderer);
        this._playerNode.addComponent(PlayerControl);

        const lm = this._levelNode.addComponent(LevelManager);
        lm.bind({
            gameRoot:      this.node,
            enemiesParent: this._enemiesParent,
            playerNode:    this._playerNode,
        });
        // 波次刷怪已由 LevelManager / WaveDirector 接管，不再需要调试占位怪
    }
}
