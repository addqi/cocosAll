import type { HitEffectData } from './types';

export abstract class HitEffectBase {
    constructor(public readonly data: HitEffectData) {}
    abstract onHit(ctx: any): void;
}
