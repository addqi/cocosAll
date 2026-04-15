import { _decorator, Component, Prefab } from 'cc';
import { World } from './World';
import { bootstrap, type GameSystems } from './GameBootstrap';
import { preloadAllResources } from './ResourcePreloader';
import { ResourceState } from './ResourceState';

const { ccclass, property } = _decorator;

/**
 * GameLoop — 纯帧驱动 + 最小生命周期协调。
 *
 * 资源就绪通知已迁移到 ResourceState。
 * 静态 onReady/resourcesReady 保留为向后兼容代理。
 */
@ccclass('GameLoop')
export class GameLoop extends Component {
    @property(Prefab)
    arrowPrefab: Prefab = null!;

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

        const { world, systems } = bootstrap(this.node, this.arrowPrefab);
        this._world = world;
        this._systems = systems;
        this._ready = true;

        preloadAllResources()
            .then(() => ResourceState.markReady())
            .catch((err) => {
                console.error('[GameLoop] preloadAllResources failed:', err);
                ResourceState.markReady();
            });
    }

    update(dt: number) {
        if (!this._ready) return;
        const entities = this._world.all();
        this._systems.rawInput.update(entities);
        this._systems.actionMap.update(entities);
        this._systems.playerControl.update(entities);
        this._systems.moveSync.update(entities, dt);
    }
}
