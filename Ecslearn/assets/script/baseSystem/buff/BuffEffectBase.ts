/**
 * Buff 效果基类
 *
 * 所有具体 Buff 效果需继承此类，实现 getChanges() 声明属性变化。
 * 设计原则：只"声明"要改变什么，不直接操作属性系统；
 * 实际应用由 AttributeChangeResolver 统一处理。
 */
import type { BuffRuntimeInfo } from './BuffRuntimeInfo';
import type { AttributeChange, BuffData } from './types';

export abstract class BuffEffectBase {
    /** Buff 运行时实例（层数、剩余时间、owner 等） */
    public runtime: BuffRuntimeInfo;

    /** 配置数据（与 runtime.data 相同） */
    public data: BuffData;

    constructor(runtime: BuffRuntimeInfo) {
        this.runtime = runtime;
        this.data = runtime.data;
    }

    /**
     * 声明式：返回本 Buff 会对哪些属性产生变化
     * 由 AttributeChangeResolver 转为 Modifier 并 apply/remove
     * @abstract 子类必须实现
     */
    abstract getChanges(): AttributeChange[];

    /**
     * Buff 首次添加时触发
     * 可选，用于播放特效、显示 UI 等
     */
    onAdd?(): void;

    /**
     * Buff 被移除时触发
     * 可选，用于停止特效、清理等
     */
    onRemove?(): void;

    /**
     * 每次 tick 触发（需配置 tickInterval > 0）
     * 可选，用于 DOT、HoT 等周期性效果
     */
    onTick?(dt?: number): void;

    /**
     * Buff 叠加层数时触发（仅叠加路径，首次添加不触发）
     * 可选，用于"N 层满时触发衍生效果"等业务逻辑
     * @param currentStack 叠加后的当前层数
     * @param maxStack     最大层数上限
     */
    onStack?(currentStack: number, maxStack: number): void;
}
