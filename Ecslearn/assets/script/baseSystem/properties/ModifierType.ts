/**
 * 属性修饰器类型
 * 定义修饰器对数值的影响方式
 */
export enum EModifierMergeType {
    /** 加法，例如：+10 */
    Additive,
    /** 乘法，例如：×1.2 */
    Multiplicative,
    /** 覆盖，多个覆盖时取优先级最高的 */
    Override,
    /** 限制范围（Clamp） */
    Clamp,
}
