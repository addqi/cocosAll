/**
 * Buff 效果工厂
 *
 * 根据 BuffData.effectClass 字符串创建具体 BuffEffect 实例。
 * 效果类通过 @buffEffect 装饰器自动注册，注册 key 为显式传入的字符串名。
 *
 * 工厂层守卫（与 HitEffectFactory 对称）：
 *   - register 时校验 ctor.prototype.getChanges 是函数，否则拒绝注册
 *   - createRuntime 时若 effectClass 未注册，列出已注册 key 帮助定位
 *   - 实例创建后再次校验 getChanges 是函数；防御原型链丢失
 */
import type { BuffData } from './types';
import { BuffRuntimeInfo } from './BuffRuntimeInfo';
import type { BuffEffectBase } from './BuffEffectBase';

/** BuffEffect 构造函数签名，用于工厂注册 */
export type BuffEffectCtor = new (runtime: BuffRuntimeInfo) => BuffEffectBase;

export class BuffFactory {
    /** effectClass 字符串 -> 构造函数 的映射 */
    private static registry: Map<string, BuffEffectCtor> = new Map();
    private static _registeredKeys: string[] = [];

    /**
     * 注册效果类
     * @param name 字符串名，与 BuffData.effectClass 对应（必须显式传入字面量字符串以抗混淆）
     * @param ctor 构造函数
     */
    static register(name: string, ctor: BuffEffectCtor): void {
        if (typeof ctor !== 'function') {
            console.error(`[BuffFactory] register("${name}") 收到非函数 ctor`, ctor);
            return;
        }
        if (typeof ctor.prototype?.getChanges !== 'function') {
            console.error(
                `[BuffFactory] register("${name}") 拒绝注册：` +
                `ctor.prototype.getChanges 不是函数。检查类是否继承 BuffEffectBase 并实现 getChanges()`,
                ctor,
            );
            return;
        }
        if (this.registry.has(name)) {
            console.warn(`[BuffFactory] "${name}" 重复注册，后者覆盖前者`);
        } else {
            this._registeredKeys.push(name);
        }
        this.registry.set(name, ctor);
    }

    /**
     * 创建 Buff 运行时实例
     * @param data Buff 配置
     * @param owner 挂载目标
     * @returns BuffRuntimeInfo，若配置了合法 effectClass 则已注入 effect 实例
     */
    static createRuntime(data: BuffData, owner: any): BuffRuntimeInfo {
        const runtime = new BuffRuntimeInfo(data, owner);

        if (data.effectClass) {
            const ctor = this.registry.get(data.effectClass);
            if (!ctor) {
                console.error(
                    `[BuffFactory] effectClass "${data.effectClass}" 未注册，Buff 将无效果。` +
                    `已注册: [${this._registeredKeys.join(', ')}]。` +
                    `多半是该 effect 类没被静态 import 进 bundle，或 JSON 写错了类名。`,
                );
            } else {
                const inst = new ctor(runtime);
                if (typeof (inst as any).getChanges !== 'function') {
                    console.error(
                        `[BuffFactory] createRuntime("${data.effectClass}") 实例 getChanges 不是函数。` +
                        `通常是混淆/打包导致原型链异常。data=`, data, 'inst=', inst,
                    );
                } else {
                    runtime.effect = inst;
                }
            }
        }

        return runtime;
    }

    /** 调试用：导出已注册类名列表 */
    static getRegisteredKeys(): readonly string[] {
        return this._registeredKeys;
    }
}
