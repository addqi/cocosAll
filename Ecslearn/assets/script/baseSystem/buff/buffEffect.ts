import { BuffFactory } from './BuffFactory';
import type { BuffEffectCtor } from './BuffFactory';

/**
 * 类装饰器：自动将 BuffEffect 子类注册到 BuffFactory
 *
 * 用法：
 *   @buffEffect
 *   export class AddHpBuffEffect extends BuffEffectBase { ... }
 *
 * 注册 key 直接取 ctor.name（即类名），必须与 JSON 中 effectClass 字段完全一致。
 * 不再需要手写 BuffFactory.register(...)。
 */
export function buffEffect(ctor: BuffEffectCtor): void {
    BuffFactory.register(ctor.name, ctor);
}
