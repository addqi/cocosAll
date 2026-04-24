import { _decorator, Component, Prefab } from 'cc';
import { World } from './World';
import { bootstrap, type GameSystems } from './GameBootstrap';
import { preloadAllResources, PREFAB_PATHS } from './ResourcePreloader';
import { ResourceState } from './ResourceState';
import { ResourceMgr } from '../../baseSystem/resource';
import { GoldSystem } from '../gold/GoldSystem';

const { ccclass } = _decorator;

/**
 * GameLoop — 纯帧驱动 + 最小生命周期协调。
 *
 * 启动流程（异步）：
 *   1. onLoad 只做 ResourceState.reset()，不做同步 bootstrap
 *   2. preloadAllResources 跑完（含 arrow/coin prefab、动画帧、shader 等）
 *   3. 拿到预加载的 prefab，调 bootstrap(node, arrow, coin) 建 World / Pool / Systems
 *   4. markReady，下游监听方（PlayerControl 等）被通知
 *
 * 所有资源走 ResourceMgr，节点上不再挂 @property(Prefab)。
 * 新场景只需挂一个挂载脚本（如 LevelBootstrap）即可启动，无需拖任何 prefab。
 */
@ccclass('GameLoop')
export class GameLoop extends Component {

    /** @deprecated 使用 ResourceState.onReady */
    static onReady(fn: () => void) { ResourceState.onReady(fn); }
    /** @deprecated 使用 ResourceState.ready */
    static get resourcesReady(): boolean { return ResourceState.ready; }

    private _world!: World;
    private _systems!: GameSystems;
    private _ready = false;

    get world(): World { return this._world; }

    onLoad() {
        ResourceState.reset();

        preloadAllResources()
            .then(() => this._bootstrapAfterPreload())
            .catch((err) => {
                console.error(
                    '%c[GameLoop] preloadAllResources FAILED — 动画/特效/prefab 资源缺失，游戏不会进入就绪状态。请检查上方 [ResourceMgr] / [ResourcePreloader] 报错。',
                    'color:#ff5252;font-weight:bold',
                    err,
                );
                // 不兜底 markReady()：宁可画面停在未初始化状态，
                // 也比"带病启动 + 静默渲染空帧"更容易发现问题。
            });
    }

    private _bootstrapAfterPreload(): void {
        const arrow = ResourceMgr.inst.get<Prefab>(PREFAB_PATHS.arrow);
        if (!arrow) {
            console.error(
                `[GameLoop] 关键 prefab "${PREFAB_PATHS.arrow}" 加载后仍取不到，中止启动。`,
            );
            return;
        }

        const { world, systems } = bootstrap(this.node, arrow);
        this._world = world;
        this._systems = systems;
        this._ready = true;

        ResourceState.markReady();
    }

    update(dt: number) {
        if (!this._ready) return;
        const entities = this._world.all();
        this._systems.rawInput.update(entities);
        this._systems.actionMap.update(entities);
        this._systems.playerControl.update(entities);
        this._systems.moveSync.update(entities, dt);
        this._systems.coinPickup.update(entities, dt);
        GoldSystem.inst.tick(dt);
    }
}
