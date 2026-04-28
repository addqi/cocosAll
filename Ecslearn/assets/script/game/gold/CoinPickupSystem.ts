import type { ISystem } from '../../baseSystem/ecs';
import { emit } from '../../baseSystem/util';
import { GameEvt, type GoldPickupEndEvent } from '../events/GameEvents';
import { PlayerControl } from '../player/PlayerControl';
import { EPropertyId } from '../config/enum/propertyEnum';
import { CoinFactory } from './CoinFactory';
import { GoldSystem } from './GoldSystem';
import { LevelRun } from '../level/LevelRun';
import { LevelPhase } from '../level/LevelPhase';

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
        if (!CoinFactory.isReady()) return;

        const coins = CoinFactory.active;
        if (coins.length === 0) return;

        const playerNode = player.node;
        const playerPos = playerNode.worldPosition;
        const pickupRange = player.playerProp.getValue(EPropertyId.PickupRange);
        const pickupRangeSq = pickupRange * pickupRange;

        // Collecting 阶段：所有 idle 金币强制吸附（无视距离）
        // 防止 phase 卡死在 Collecting：玩家走得远 → 金币留在原地 → coinOnField > 0 → 永不进 Upgrading。
        // Linus 实用主义：与其加 timeout 强行推进，不如让金币一定会被收（玩家不用赶路）。
        const inCollecting = LevelRun.current?.phase === LevelPhase.Collecting;

        // 倒序：释放时直接 splice 不影响当前迭代
        for (let i = coins.length - 1; i >= 0; i--) {
            const coin = coins[i];
            if (!coin.node || !coin.node.isValid) {
                CoinFactory.release(coin);
                continue;
            }

            if (coin.state === 'idle') {
                if (inCollecting) {
                    coin.startAttracting(playerNode);
                    continue;
                }
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
                    CoinFactory.release(coin);
                }
                continue;
            }
        }
    }
}
