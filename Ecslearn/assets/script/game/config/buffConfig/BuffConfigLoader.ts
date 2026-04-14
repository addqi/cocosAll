import type { BuffData } from '../../../baseSystem/buff';
import type { HitEffectData } from '../../../baseSystem/hitEffect';
import buffDefs from './buffs.json';
import hitDefs from './hitEffects.json';

const _buffs = buffDefs as Record<string, BuffData>;
const _hitEffects = hitDefs as Record<string, HitEffectData>;

export function getBuffDef(ref: string): BuffData | null {
    return _buffs[ref] ?? null;
}

export function getHitEffectDef(ref: string): HitEffectData | null {
    return _hitEffects[ref] ?? null;
}

export function allBuffIds(): string[] {
    return Object.keys(_buffs);
}

export function allHitEffectIds(): string[] {
    return Object.keys(_hitEffects);
}
