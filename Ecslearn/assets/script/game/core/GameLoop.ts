import { _decorator, Component, Prefab } from 'cc';
import { World } from './World';
import { bootstrap, type GameSystems } from './GameBootstrap';
import { preloadAllResources } from './ResourcePreloader';

const { ccclass, property } = _decorator;

@ccclass('GameLoop')
export class GameLoop extends Component {
    @property(Prefab)
    arrowPrefab: Prefab = null!;

    private static _readyFns: (() => void)[] = [];
    private static _isReady = false;

    static onReady(fn: () => void) {
        if (this._isReady) { fn(); return; }
        this._readyFns.push(fn);
    }

    static get resourcesReady(): boolean { return this._isReady; }

    private _world!: World;
    private _systems!: GameSystems;
    private _ready = false;

    get world(): World { return this._world; }

    onLoad() {
        GameLoop._isReady = false;
        GameLoop._readyFns.length = 0;

        const { world, systems } = bootstrap(this.node, this.arrowPrefab);
        this._world = world;
        this._systems = systems;
        this._ready = true;

        preloadAllResources().then(() => {
            GameLoop._isReady = true;
            for (const fn of GameLoop._readyFns) fn();
            GameLoop._readyFns.length = 0;
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
