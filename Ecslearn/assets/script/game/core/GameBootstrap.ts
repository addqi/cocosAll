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
import '../skill/effects';

export interface GameSystems {
    rawInput: RawInputSystem;
    actionMap: ActionMapSystem;
    playerControl: PlayerControlSystem;
    moveSync: MoveSyncSystem;
}

export function bootstrap(rootNode: Node, arrowPrefab: Prefab): { world: World; systems: GameSystems } {
    PhysicsSystem2D.instance.enable = true;

    const world = new World();
    const systems: GameSystems = {
        rawInput: new RawInputSystem(),
        actionMap: new ActionMapSystem(),
        playerControl: new PlayerControlSystem(),
        moveSync: new MoveSyncSystem(),
    };
    ProjectilePool.init(rootNode, arrowPrefab);

    return { world, systems };
}
