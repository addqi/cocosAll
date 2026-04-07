/**
 * Buff 效果工厂
 *
 * 根据 BuffData.effectClass 字符串创建具体 BuffEffect 实例。
 * 效果类通过 @buffEffect 装饰器自动注册，注册 key 为类名。
 */
import type { BuffData } from './types';
import { BuffRuntimeInfo } from './BuffRuntimeInfo';
import type { BuffEffectBase } from './BuffEffectBase';

/** BuffEffect 构造函数签名，用于工厂注册 */
export type BuffEffectCtor = new (runtime: BuffRuntimeInfo) => BuffEffectBase;

export class BuffFactory {
    /** effectClass 字符串 -> 构造函数 的映射 */
    private static registry: Map<string, BuffEffectCtor> = new Map();

    /**
     * 注册效果类
     * @param name 字符串名，与 BuffData.effectClass 对应
     * @param ctor 构造函数
     */
    static register(name: string, ctor: BuffEffectCtor): void {
        this.registry.set(name, ctor);
    }

    /**
     * 创建 Buff 运行时实例
     * @param data Buff 配置
     * @param owner 挂载目标
     * @returns BuffRuntimeInfo，若配置了 effectClass 则已注入 effect 实例
     */
    static createRuntime(data: BuffData, owner: any): BuffRuntimeInfo {
        const runtime = new BuffRuntimeInfo(data, owner);

        if (data.effectClass) {
            const ctor = this.registry.get(data.effectClass);
            if (ctor) {
                runtime.effect = new ctor(runtime);
            } else {
                console.warn(`[BuffFactory] effectClass "${data.effectClass}" 未注册，Buff 将无效果`);
            }
        }

        return runtime;
    }
}
