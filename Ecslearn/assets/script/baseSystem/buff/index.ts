/**
 * Buff 系统模块 - 统一导出
 *
 * 已实现：types、BuffRuntimeInfo、BuffEffectBase、BuffFactory
 * 待实现：BuffMgr、AttributeChangeResolver、具体 Effect
 */
export type { AttributeChange, BuffData, IBuffOwner } from './types';
export type { BuffEffectCtor } from './BuffFactory';
export { EChangeType } from './buffEnum';
export { BuffRuntimeInfo } from './BuffRuntimeInfo';
export { BuffEffectBase } from './BuffEffectBase';
export { BuffFactory } from './BuffFactory';
