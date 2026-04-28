import { HitEffectFactory } from './HitEffectFactory';
import type { HitEffectCtor } from './HitEffectFactory';

/**
 * 类装饰器（带名字参数）：自动将 HitEffect 子类注册到 HitEffectFactory。
 *
 * 用法：
 *   @hitEffect('ChainLightningEffect')
 *   export class ChainLightningEffect extends HitEffectBase { ... }
 *
 * 为什么必须显式传名字（不能用 ctor.name）：见 baseSystem/buff/buffEffect.ts 注释。
 */
export function hitEffect(name: string) {
    return (ctor: HitEffectCtor): void => {
        HitEffectFactory.register(name, ctor);
    };
}
