import { HitEffectBase, HitEffectFactory, type HitEffectData } from '../../baseSystem/hitEffect';
import type { GameHitContext } from '../hitEffects/types';

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

    execute(ctx: GameHitContext): void {
        if (this._dirty) {
            this._sorted = [...this._effects.values()].sort(
                (a, b) => (a.data.priority ?? 0) - (b.data.priority ?? 0),
            );
            this._dirty = false;
        }
        for (const eff of this._sorted) {
            eff.onHit(ctx);
        }
    }
}
