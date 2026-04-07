/**
 * Buff 系统类型定义
 */

import { EChangeType } from './buffEnum';

/**
 * 声明式属性变化描述
 * BuffEffect 通过 getChanges() 返回此数组，由 AttributeChangeResolver 转为实际 Modifier
 */
export interface AttributeChange {
    /** 属性节点 ID，必须与属性配置中 valueNodes 的 id 一致 */
    attrId: string;
    /** 变化类型 */
    type: EChangeType;
    /** 数值（ADD 为加数，MUL 为乘数等） */
    value?: number;
    /** 元数据（如 priority、min、max，CLAMP 类型需要 min/max） */
    meta?: any;
}

/**
 * Buff 配置数据
 * 通常来自 JSON/表格，策划可配置
 */
export interface BuffData {
    /** Buff 唯一 ID，用于 addBuff/removeBuff/hasBuff */
    id: number;
    /** 名称（可显示在 UI） */
    name: string;
    /**
     * 持续时间（秒）
     * 0 表示永久 Buff，不会因时间过期
     */
    duration: number;
    /**
     * 最大叠加层数
     * 默认 1，超过后 addStack 不再增加
     */
    maxStack?: number;
    /**
     * Tick 间隔（秒）
     * 用于 DOT/HoT 等周期性效果，0 表示不 tick
     */
    tickInterval?: number;
    /**
     * tick 时是否掉落一层
     * true = 每次 tick 减少 1 层，归零时自动移除
     * false / 不填 = tick 不影响层数
     */
    stackDecayOnTick?: boolean;
    /**
     * 效果类名
     * 对应 BuffFactory.register 的第一个参数，工厂据此创建 effect 实例
     */
    effectClass?: string;
    /** 额外配置（如 addValue、mulFactor、targetAttr 等，由具体 Effect 读取） */
    [key: string]: any;
}

/**
 * Buff 挂载目标接口
 * 可挂 Buff 的对象（角色、怪物、建筑等）必须实现此接口
 */
export interface IBuffOwner {
    /**
     * 返回属性管理器
     * 必须返回管理器本身（有 getProperty(id) 方法），不能返回单个属性
     */
    getPropertyManager(): any;
    /** 可选，用于日志/调试的唯一标识 */
    uid?: string | number;
}
