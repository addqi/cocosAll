import { _decorator, Component, Texture2D, EffectAsset, PhysicsSystem2D, Prefab } from 'cc';
import { World } from './World';
import { ResourceMgr } from '../../baseSystem/resource';
import { ProjectilePool } from '../projectile/ProjectilePool';
import { playerConfig } from '../player/config/playerConfig';
import { enemyConfig } from '../enemy/config/enemyConfig';
import '../skill/effects';
import {
    RawInputSystem,
    ActionMapSystem,
    PlayerControlSystem,
    MoveSyncSystem,
} from '../system';

const { ccclass, property } = _decorator;

@ccclass('GameLoop')
export class GameLoop extends Component {
    @property(Prefab)
    arrowPrefab: Prefab = null!;

    private static _readyFns: (() => void)[] = [];
    private static _isReady = false;

    /**
     * 资源就绪回调：已就绪则立即执行，否则排队等预加载完成
     * 组件用此延迟初始化依赖纹理的部分
     */
    static onReady(fn: () => void) {
        if (this._isReady) { fn(); return; }
        this._readyFns.push(fn);
    }

    static get resourcesReady(): boolean { return this._isReady; }

    private _world!:          World;
    private _rawInput!:       RawInputSystem;
    private _actionMap!:      ActionMapSystem;
    private _playerControl!:  PlayerControlSystem;
    private _moveSync!:       MoveSyncSystem;
    private _ready = false;

    get world(): World { return this._world; }

    onLoad() {
        PhysicsSystem2D.instance.enable = true;

        this._world         = new World();
        this._rawInput      = new RawInputSystem();
        this._actionMap     = new ActionMapSystem();
        this._playerControl = new PlayerControlSystem();
        this._moveSync      = new MoveSyncSystem();
        ProjectilePool.init(this.node, this.arrowPrefab);
        this._ready         = true;

        this._preloadResources().then(() => {
            GameLoop._isReady = true;
            for (const fn of GameLoop._readyFns) fn();
            GameLoop._readyFns.length = 0;
        });
    }

    private async _preloadResources(): Promise<void> {
        const texturePaths: string[] = [];

        for (const key of Object.keys(playerConfig.anims)) {
            texturePaths.push(`${playerConfig.anims[key].path}/texture`);
        }
        texturePaths.push(`${playerConfig.arrowTexture}/texture`);
        texturePaths.push(`${playerConfig.rangeTexture}/texture`);

        for (const key of Object.keys(enemyConfig.anims)) {
            texturePaths.push(`${enemyConfig.anims[key].path}/texture`);
        }
        texturePaths.push(`${enemyConfig.rangeTexture}/texture`);

        texturePaths.push('shader/noise/texture');

        await ResourceMgr.inst.preload(texturePaths, Texture2D);
        await ResourceMgr.inst.preload(['shader/dissolve', 'shader/flash-white'], EffectAsset);
    }

    update(dt: number) {
        if (!this._ready) return;
        const entities = this._world.all();
        this._rawInput.update(entities);
        this._actionMap.update(entities);
        this._playerControl.update(entities);
        this._moveSync.update(entities, dt);
    }
}
