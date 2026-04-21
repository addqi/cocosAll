import { Vec3 } from 'cc';
import { on, off, emit } from '../../baseSystem/util';
import {
    GameEvt,
    type EnemyDeathEvent,
    type GoldDropEvent,
    type GoldGainedEvent,
    type GoldSpentEvent,
} from '../events/GameEvents';
import { CoinPool } from './CoinPool';
import { GoldSource, type GoldGainContext } from './GoldTypes';
import type { GoldModifier } from './GoldModifier';
import { ComboKillModifier } from './modifiers/ComboKillModifier';

const COMBO_RESET_SEC = 5;

/**
 * 金币系统总控
 *
 * 职责：
 *   1. 监听 EnemyDeath，跑 Modifier 链
 *   2. 击杀来源 → 生成 Coin 物件（走拾取流程）；其他来源 → 直接入账
 *   3. 托管 Modifier 注册表（升级系统可动态 add/remove）
 *   4. 维护本局金币总数、连杀计数（RunSession 建好后迁移）
 */
export class GoldSystem {
    private static _inst: GoldSystem | null = null;
    static get inst(): GoldSystem {
        if (!this._inst) this._inst = new GoldSystem();
        return this._inst;
    }

    private _mods: GoldModifier[] = [];
    private _gold = 0;
    private _combo = 0;
    private _timeSinceLastKill = 0;

    get gold(): number { return this._gold; }
    get combo(): number { return this._combo; }

    /** 由 bootstrap 或 RunOrchestrator 调用一次 */
    init(): void {
        on(GameEvt.EnemyDeath, this._onEnemyDeath);
        this.addModifier(new ComboKillModifier(() => this._combo));
    }

    destroy(): void {
        off(GameEvt.EnemyDeath, this._onEnemyDeath);
        this._mods.length = 0;
        this._gold = 0;
        this._combo = 0;
        this._timeSinceLastKill = 0;
    }

    /** 每帧调用（由 GameLoop 驱动），维护连杀超时清零 */
    tick(dt: number): void {
        if (this._combo === 0) return;
        this._timeSinceLastKill += dt;
        if (this._timeSinceLastKill >= COMBO_RESET_SEC) {
            this._combo = 0;
            this._timeSinceLastKill = 0;
        }
    }

    addModifier(mod: GoldModifier): void {
        this._mods.push(mod);
        this._mods.sort((a, b) => a.priority - b.priority);
    }

    removeModifier(id: string): void {
        this._mods = this._mods.filter(m => m.id !== id);
    }

    findModifier<T extends GoldModifier>(id: string): T | null {
        return (this._mods.find(m => m.id === id) as T | undefined) ?? null;
    }

    /**
     * 外部加金入口（击杀/任务/宝箱/调试）
     * 击杀来源会生成 Coin 物件，由拾取系统最终调用 commitPickup 入账
     */
    gainGold(ctx: GoldGainContext): number {
        const final = this._runChain(ctx);
        if (final <= 0) return 0;

        if (ctx.source === GoldSource.Kill && ctx.worldPos) {
            const pos = this._cloneVec(ctx.worldPos);
            CoinPool.spawn(pos, final);
            const drop: GoldDropEvent = { worldPos: pos, amount: final };
            emit(GameEvt.GoldDrop, drop);
        } else {
            this._commit(final, ctx.source, ctx.worldPos);
        }
        return final;
    }

    /** 金币物件到手时调用，已是最终面值，不再跑 Modifier */
    commitPickup(amount: number, worldPos?: Readonly<Vec3>): void {
        this._commit(amount, GoldSource.Pickup, worldPos);
    }

    /** 消费金币（商店等），返回是否成功 */
    spendGold(amount: number, reason: string): boolean {
        if (amount <= 0) return true;
        if (this._gold < amount) return false;
        this._gold -= amount;
        const payload: GoldSpentEvent = { amount, reason };
        emit(GameEvt.GoldSpent, payload);
        return true;
    }

    private _onEnemyDeath = (e: EnemyDeathEvent) => {
        this._combo += 1;
        this._timeSinceLastKill = 0;

        if (e.goldDrop <= 0) return;

        this.gainGold({
            source: GoldSource.Kill,
            baseAmount: e.goldDrop,
            enemyId: e.enemyId,
            killerId: e.killerId,
            worldPos: e.worldPos,
        });
    };

    private _runChain(ctx: GoldGainContext): number {
        let amount = ctx.baseAmount;
        for (const m of this._mods) amount = m.apply(amount, ctx);
        return Math.max(0, Math.floor(amount));
    }

    private _commit(amount: number, source: GoldSource, worldPos?: Readonly<Vec3>): void {
        this._gold += amount;
        const payload: GoldGainedEvent = { final: amount, source, worldPos };
        emit(GameEvt.GoldGained, payload);
    }

    private _cloneVec(v: Readonly<Vec3>): Vec3 {
        return new Vec3(v.x, v.y, v.z);
    }
}
