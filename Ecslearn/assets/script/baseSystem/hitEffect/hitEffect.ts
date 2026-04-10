import { HitEffectFactory } from './HitEffectFactory';
import type { HitEffectCtor } from './HitEffectFactory';

export function hitEffect(ctor: HitEffectCtor): void {
    HitEffectFactory.register(ctor.name, ctor);
}
