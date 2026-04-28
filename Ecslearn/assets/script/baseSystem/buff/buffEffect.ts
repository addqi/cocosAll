import { BuffFactory } from './BuffFactory';
import type { BuffEffectCtor } from './BuffFactory';

/**
 * 类装饰器（带名字参数）：自动将 BuffEffect 子类注册到 BuffFactory。
 *
 * 用法：
 *   @buffEffect('AttrModifierEffect')
 *   export class AttrModifierEffect extends BuffEffectBase { ... }
 *
 * 为什么必须显式传名字（不能用 ctor.name）：
 *   打包发布会做代码混淆，`AttrModifierEffect.name` 在压缩后可能变成 `"t"`，
 *   而 JSON 里 effectClass 字段写的仍是 `"AttrModifierEffect"`（字面量保留）。
 *   于是 register("t", ctor) 注册成短名，create 时按 "AttrModifierEffect" 查 → 查不到 → effect 全失效。
 *   显式传名字字符串可保留 → 打包稳定。
 */
export function buffEffect(name: string) {
    return (ctor: BuffEffectCtor): void => {
        BuffFactory.register(name, ctor);
    };
}
