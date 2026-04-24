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
import { GoldSystem } from '../gold/GoldSystem';
import { CoinPickupSystem } from '../gold/CoinPickupSystem';
import { SpriteNodeFactory } from '../fx/SpriteNodeFactory';
import { on } from '../../baseSystem/util';
import { GameEvt, type GoldGainedEvent } from '../events/GameEvents';
import '../skill/effects';

export interface GameSystems {
    rawInput: RawInputSystem;
    actionMap: ActionMapSystem;
    playerControl: PlayerControlSystem;
    moveSync: MoveSyncSystem;
    coinPickup: CoinPickupSystem;
}

export function bootstrap(
    rootNode: Node,
    arrowPrefab: Prefab,
): { world: World; systems: GameSystems } {
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

    // 通用图片节点工厂 —— 为 spriteAssets.json 里所有条目建池
    // 业务工厂（CoinFactory 等）acquire 时按 id 从这里拿节点
    SpriteNodeFactory.init(rootNode);
    GoldSystem.inst.init();

    on(GameEvt.GoldGained, (e: GoldGainedEvent) => {
        console.log(`[Gold] +${e.final}  total=${GoldSystem.inst.gold}  source=${e.source}`);
    });

    return { world, systems };
}
