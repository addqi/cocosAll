import type { ISystem } from '../../baseSystem/ecs';
import { emit } from '../../baseSystem/util';
import { GameEvt, type GoldPickupEndEvent } from '../events/GameEvents';
import { PlayerControl } from '../player/PlayerControl';
import { EPropertyId } from '../config/enum/propertyEnum';
import { CoinPool } from './CoinPool';
import { GoldSystem } from './GoldSystem';

const ATTRACT_ACCEL = 2400;
const ATTRACT_MAX_SPEED = 1200;
const ARRIVE_RADIUS = 20;

/**
 * 金币拾取系统
 *
 * - idle       金币：每帧做玩家距离平方判定，进入 PickupRange → 进入 attracting
 * - attracting 金币：施加加速度向玩家飞行，到达 ARRIVE_RADIUS 内即入账
 *
 * 设计要点：
 *   用 `dx*dx + dy*dy <= rangeSq` 消除 sqrt，200 枚金币每帧无压力
 *   PickupRange 每帧从 playerProp 读，Buff 生效即刻生效
 *   玩家引用丢失（死亡/销毁）时，coin 保持 idle 等待下一帧玩家重现
 */
export class CoinPickupSystem implements ISystem {

    update(_entities: unknown[], dt?: number): void {
        if (dt === undefined || dt <= 0) return;

        const player = PlayerControl.instance;
        if (!player || player.isDead) return;
        if (!CoinPool.isReady()) return;

        const coins = CoinPool.active;
        if (coins.length === 0) return;

        const playerNode = player.node;
        const playerPos = playerNode.worldPosition;
        const pickupRange = player.playerProp.getValue(EPropertyId.PickupRange);
        const pickupRangeSq = pickupRange * pickupRange;

        // 倒序：释放时直接 splice 不影响当前迭代
        for (let i = coins.length - 1; i >= 0; i--) {
            const coin = coins[i];
            if (!coin.node || !coin.node.isValid) {
                CoinPool.release(coin);
                continue;
            }

            if (coin.state === 'idle') {
                const cp = coin.node.worldPosition;
                const dx = cp.x - playerPos.x;
                const dy = cp.y - playerPos.y;
                if (dx * dx + dy * dy <= pickupRangeSq) {
                    coin.startAttracting(playerNode);
                }
                continue;
            }

            if (coin.state === 'attracting') {
                const arrived = coin.tickAttracting(dt, ATTRACT_ACCEL, ATTRACT_MAX_SPEED, ARRIVE_RADIUS);
                if (arrived) {
                    const endPos = coin.node.worldPosition.clone();
                    coin.markPickedUp();
                    GoldSystem.inst.commitPickup(coin.denomination, endPos);
                    const endPayload: GoldPickupEndEvent = {
                        amount: coin.denomination,
                        worldPos: endPos,
                    };
                    emit(GameEvt.GoldPickupEnd, endPayload);
                    CoinPool.release(coin);
                }
                continue;
            }
        }
    }
}
