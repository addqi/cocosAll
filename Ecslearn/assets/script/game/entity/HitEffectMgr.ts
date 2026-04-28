import { HitEffectBase, HitEffectFactory, type HitEffectData } from '../../baseSystem/hitEffect';
import type {
    GameHitContext,
    ShootEventContext,
    TakenDamageContext,
} from '../hitEffects/types';

/**
 * HitEffect 管理器
 *
 * 守卫策略（与 HitEffectFactory 对称，防御性双保险）：
 *   - add 时再次校验 effect.onHit 是函数，工厂如果绕过则在这里拦
 *   - execute hot path 上跳过坏 effect 而不抛错（"degraded but alive"）
 *   - 同一个坏 effect 只 warn 一次，避免日志风暴
 */
export class HitEffectMgr {
    private _effects = new Map<string, HitEffectBase>();
    private _sorted: HitEffectBase[] = [];
    private _dirty = false;
    private _warnedBad = new Set<string>();

    add(data: HitEffectData): boolean {
        if (this._effects.has(data.id)) return false;
        const effect = HitEffectFactory.create(data);
        if (!effect) return false;
        if (typeof effect.onHit !== 'function') {
            console.error(
                `[HitEffectMgr.add] effect onHit 不是函数，拒绝。data=`,
                data, 'inst=', effect,
            );
            return false;
        }
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
            if (typeof eff?.onHit !== 'function') {
                this._warnBadEffect(eff, 'onHit');
                continue;
            }
            eff.onHit(ctx);
        }
    }

    /** 执行所有 effect 的 onShoot —— 玩家每次发射时 */
    executeOnShoot(ctx: ShootEventContext): void {
        this._ensureSorted();
        for (const eff of this._sorted) {
            if (!eff) continue;
            eff.onShoot?.(ctx);
        }
    }

    /** 执行所有 effect 的 onTakenDamage —— 玩家被伤害前（可改 ctx.rawDamage）*/
    executeOnTakenDamage(ctx: TakenDamageContext): void {
        this._ensureSorted();
        for (const eff of this._sorted) {
            if (!eff) continue;
            eff.onTakenDamage?.(ctx);
        }
    }

    private _ensureSorted(): void {
        if (!this._dirty) return;
        // 显式 forEach 收集，绕开 iterator spread —— Cocos 3.8.x Rollup 在某些 target 配置下
        // 会把 [...map.values()] 错误转换为 [map.values()]（包了一层），导致 _sorted 元素是 MapIterator。
        // forEach 是 Map 的实例方法，不依赖 iterator 协议，打包工具不会破坏它。
        const arr: HitEffectBase[] = [];
        this._effects.forEach((eff) => arr.push(eff));
        arr.sort((a, b) => (a.data.priority ?? 0) - (b.data.priority ?? 0));
        this._sorted = arr;
        this._dirty = false;
    }

    private _warnBadEffect(eff: any, hook: string): void {
        const tag = `${eff?.data?.effectClass ?? '?'}:${eff?.data?.id ?? '?'}:${hook}`;
        if (this._warnedBad.has(tag)) return;
        this._warnedBad.add(tag);
        // 打印 typeof / ctor.name / keys —— 下次再出问题能直接看到真凶（MapIterator / 普通 Object / 其他）
        const ctorName = eff?.constructor?.name ?? '?';
        const keys = eff && typeof eff === 'object' ? Object.keys(eff).join(',') : '?';
        console.error(
            `[HitEffectMgr] 跳过坏 effect (${hook} 不是函数): ${tag}\n` +
            `  type=${typeof eff}, ctor=${ctorName}, keys=[${keys}]`,
            eff,
        );
    }
}
