import { HitEffectBase, HitEffectFactory, type HitEffectData } from '../../baseSystem/hitEffect';
import type {
    GameHitContext,
    ShootEventContext,
    TakenDamageContext,
} from '../hitEffects/types';

export class HitEffectMgr {
    private _effects = new Map<string, HitEffectBase>();
    private _sorted: HitEffectBase[] = [];
    private _dirty = false;

    add(data: HitEffectData): boolean {
        if (this._effects.has(data.id)) return false;
        const effect = HitEffectFactory.create(data);
        if (!effect) return false;
        this._effects.set(data.id, effect);
        this._dirty = true;
        return true;
    }

    remove(id: string): boolean {
        const ok = this._effects.delete(id);
        if (ok) this._dirty = true;
        return ok;
    }

    has(id: string): boolean {
        return this._effects.has(id);
    }

    get count(): number {
        return this._effects.size;
    }

    /** 执行所有 effect 的 onHit —— 箭命中敌人时 */
    execute(ctx: GameHitContext): void {
        this._ensureSorted();
        for (const eff of this._sorted) {
            eff.onHit(ctx);
        }
    }

    /** 执行所有 effect 的 onShoot —— 玩家每次发射时 */
    executeOnShoot(ctx: ShootEventContext): void {
        this._ensureSorted();
        for (const eff of this._sorted) {
            eff.onShoot?.(ctx);
        }
    }

    /** 执行所有 effect 的 onTakenDamage —— 玩家被伤害前（可改 ctx.rawDamage）*/
    executeOnTakenDamage(ctx: TakenDamageContext): void {
        this._ensureSorted();
        for (const eff of this._sorted) {
            eff.onTakenDamage?.(ctx);
        }
    }

    private _ensureSorted(): void {
        if (!this._dirty) return;
        this._sorted = [...this._effects.values()].sort(
            (a, b) => (a.data.priority ?? 0) - (b.data.priority ?? 0),
        );
        this._dirty = false;
    }
}
