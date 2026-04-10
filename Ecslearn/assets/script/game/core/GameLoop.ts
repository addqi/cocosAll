import { _decorator, Component } from 'cc';
import { World } from './World';
import {
    RawInputSystem,
    ActionMapSystem,
    PlayerControlSystem,
    MoveSyncSystem,
} from '../system';

const { ccclass } = _decorator;

/**
 * ECS 主循环
 *
 * 挂在场景根节点上（需在 Player 节点的父级或同级靠前位置，
 * 以保证 onLoad 先于 PlayerControl 执行）。
 *
 * 职责：创建 World、注册所有 System、每帧按顺序驱动管线。
 */
@ccclass('GameLoop')
export class GameLoop extends Component {
    private _world!:          World;
    private _rawInput!:       RawInputSystem;
    private _actionMap!:      ActionMapSystem;
    private _playerControl!:  PlayerControlSystem;
    private _moveSync!:       MoveSyncSystem;

    get world(): World { return this._world; }

    onLoad() {
        this._world         = new World();
        this._rawInput      = new RawInputSystem();
        this._actionMap     = new ActionMapSystem();
        this._playerControl = new PlayerControlSystem();
        this._moveSync      = new MoveSyncSystem();
    }

    update(dt: number) {
        const entities = this._world.all();
        this._rawInput.update(entities);          // ① 键盘 → 原始数据
        this._actionMap.update(entities);          // ② 原始数据 → 语义动作
        this._playerControl.update(entities);      // ③ 语义动作 → 速度
        this._moveSync.update(entities, dt);       // ④ 速度 → 节点位置
    }
}
