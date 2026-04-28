import type { HitEffectData } from './types';
import type { HitEffectBase } from './HitEffectBase';

export type HitEffectCtor = new (data: HitEffectData) => HitEffectBase;

/**
 * 工厂层守卫 —— 防止打包混淆 / tree-shake 引发运行时崩溃。
 *
 * 关键策略：
 *   - register 时检查 ctor.prototype.onHit 必须是函数；否则拒绝注册并打日志
 *   - create 时如果 effectClass 未注册，把所有已注册 key 列出来，方便定位"是配置错还是漏 import"
 *   - create 后再次校验实例 onHit 是函数；防御原型链丢失这种"理论上不该发生但发生了"的情况
 *
 * 任何一处失败都返回 null，由上层（HitEffectMgr.add）丢弃。
 */
export class HitEffectFactory {
    private static _registry = new Map<string, HitEffectCtor>();
    private static _registeredKeys: string[] = [];

    static register(name: string, ctor: HitEffectCtor): void {
        if (typeof ctor !== 'function') {
            console.error(`[HitEffectFactory] register("${name}") 收到非函数 ctor`, ctor);
            return;
        }
        if (typeof ctor.prototype?.onHit !== 'function') {
            console.error(
                `[HitEffectFactory] register("${name}") 拒绝注册：` +
                `ctor.prototype.onHit 不是函数。检查类是否继承 HitEffectBase 并实现 onHit()`,
                ctor,
            );
            return;
        }
        if (this._registry.has(name)) {
            console.warn(`[HitEffectFactory] "${name}" 重复注册，后者覆盖前者`);
        } else {
            this._registeredKeys.push(name);
        }
        this._registry.set(name, ctor);
    }

    static create(data: HitEffectData): HitEffectBase | null {
        const ctor = this._registry.get(data.effectClass);
        if (!ctor) {
            console.error(
                `[HitEffectFactory] effectClass "${data.effectClass}" 未注册。` +
                `已注册的有: [${this._registeredKeys.join(', ')}]。` +
                `多半是该 effect 类没被静态 import 进 bundle，或 JSON 写错了类名。`,
            );
            return null;
        }
        const inst = new ctor(data);
        if (typeof (inst as any).onHit !== 'function') {
            console.error(
                `[HitEffectFactory] create("${data.effectClass}") 实例 onHit 不是函数。` +
                `通常是混淆/打包导致原型链异常。data=`, data, 'inst=', inst,
            );
            return null;
        }
        return inst;
    }

    /** 调试用：导出已注册类名列表 */
    static getRegisteredKeys(): readonly string[] {
        return this._registeredKeys;
    }
}
