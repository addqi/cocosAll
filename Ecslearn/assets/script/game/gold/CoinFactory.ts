import { Vec3 } from 'cc';
import { SpriteNodeFactory } from '../fx/SpriteNodeFactory';
import { CoinEntity } from './CoinEntity';

/** 对应 spriteAssets.json 的 key，业务层唯一使用这个字符串 */
const COIN_ASSET_ID = 'coin';

/** 自动合并策略的超限阈值。超过后把最老的一批合并成单张大面值金币 */
const AUTO_COMPACT_THRESHOLD = 200;
const AUTO_COMPACT_BATCH = 20;

/**
 * 金币业务工厂（Layer 2）
 *
 * 职责：把"节点 + CoinEntity + 业务状态"组装到一起。
 * 节点生成、对象池、Sprite/UITransform 配置 —— 全部委托给 SpriteNodeFactory。
 *
 * 对外接口和之前保持一致（spawn / release / active / clearAll），
 * 调用方（GoldSystem / CoinPickupSystem / GoldDebugLogger）一字不改。
 */
export class CoinFactory {

    private static _active: CoinEntity[] = [];

    static isReady(): boolean {
        return SpriteNodeFactory.isReady(COIN_ASSET_ID);
    }

    static spawn(worldPos: Readonly<Vec3>, amount: number): CoinEntity | null {
        if (amount <= 0) return null;

        if (this._active.length >= AUTO_COMPACT_THRESHOLD) {
            this._autoCompact();
        }

        const node = SpriteNodeFactory.acquire(COIN_ASSET_ID, worldPos);
        if (!node) return null;

        let coin = node.getComponent(CoinEntity) ?? node.addComponent(CoinEntity);
        coin.reset(worldPos, amount);
        this._active.push(coin);
        return coin;
    }

    static release(coin: CoinEntity): void {
        const i = this._active.indexOf(coin);
        if (i >= 0) this._active.splice(i, 1);
        if (!coin.node || !coin.node.isValid) return;
        SpriteNodeFactory.release(COIN_ASSET_ID, coin.node);
    }

    static get active(): ReadonlyArray<CoinEntity> {
        return this._active;
    }

    static clearAll(): void {
        // 把业务列表清空；节点由 SpriteNodeFactory 统一销毁
        this._active.length = 0;
        SpriteNodeFactory.clear(COIN_ASSET_ID);
    }

    /**
     * 场上金币过多时合并最老的一批为单张大面值金币
     * —— "化整为零"反过来的操作，防止图形/内存爆炸
     */
    private static _autoCompact(): void {
        const victims = this._active.slice(0, AUTO_COMPACT_BATCH);
        if (victims.length === 0) return;

        const last = victims[victims.length - 1];
        const pos = new Vec3(
            last.node.worldPosition.x,
            last.node.worldPosition.y,
            last.node.worldPosition.z,
        );
        let total = 0;
        for (const c of victims) {
            total += c.denomination;
            this.release(c);
        }
        this.spawn(pos, total);
    }
}
