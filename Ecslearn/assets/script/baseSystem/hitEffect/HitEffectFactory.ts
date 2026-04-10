import type { HitEffectData } from './types';
import type { HitEffectBase } from './HitEffectBase';

export type HitEffectCtor = new (data: HitEffectData) => HitEffectBase;

export class HitEffectFactory {
    private static _registry = new Map<string, HitEffectCtor>();

    static register(name: string, ctor: HitEffectCtor): void {
        this._registry.set(name, ctor);
    }

    static create(data: HitEffectData): HitEffectBase | null {
        const ctor = this._registry.get(data.effectClass);
        if (!ctor) {
            console.error(`[HitEffectFactory] effectClass "${data.effectClass}" 未注册`);
            return null;
        }
        return new ctor(data);
    }
}
