import type { Node, Prefab } from 'cc';
import { PhysicsSystem2D } from 'cc';
import { World } from './World';
import { ProjectilePool } from '../projectile/ProjectilePool';
import {
    RawInputSystem,
    ActionMapSystem,
    PlayerControlSystem,
    MoveSyncSystem,
} from '../system';
import { CoinPool } from '../gold/CoinPool';
import { GoldSystem } from '../gold/GoldSystem';
import { CoinPickupSystem } from '../gold/CoinPickupSystem';
import '../skill/effects';

export interface GameSystems {
    rawInput: RawInputSystem;
    actionMap: ActionMapSystem;
    playerControl: PlayerControlSystem;
    moveSync: MoveSyncSystem;
    coinPickup: CoinPickupSystem;
}

export function bootstrap(rootNode: Node, arrowPrefab: Prefab): { world: World; systems: GameSystems } {
    PhysicsSystem2D.instance.enable = true;

    const world = new World();
    const systems: GameSystems = {
        rawInput: new RawInputSystem(),
        actionMap: new ActionMapSystem(),
        playerControl: new PlayerControlSystem(),
        moveSync: new MoveSyncSystem(),
        coinPickup: new CoinPickupSystem(),
    };
    ProjectilePool.init(rootNode, arrowPrefab);

    // 占位期：金币物件复用 arrowPrefab 视觉
    CoinPool.init(rootNode, arrowPrefab);
    GoldSystem.inst.init();

    return { world, systems };
}
