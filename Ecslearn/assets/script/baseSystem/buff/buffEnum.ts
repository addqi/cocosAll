/**
 * Buff 系统枚举
 */

/**
 * 属性变化类型
 * 与属性系统的 Modifier 类型对应
 */
export enum EChangeType {
    /** 加法，对应 PropertyAddModifier */
    ADD = 'ADD',
    /** 乘法，对应 PropertyMulModifier */
    MUL = 'MUL',
    /** 覆盖，取最高优先级 */
    OVERRIDE = 'OVERRIDE',
    /** 限制范围 [min, max] */
    CLAMP = 'CLAMP',
    /** 事件类型（扩展用） */
    EVENT = 'EVENT',
}
