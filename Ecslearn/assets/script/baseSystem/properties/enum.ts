/**
 * 属性修饰器操作类型
 * 对应 Modifier 的合并方式，属于基础设施层枚举
 * 业务层枚举（EPropertyId / EPropertyConfigId）见 game/shared/enum/propertyEnum.ts
 */
export enum EPropertyAddType {
    /** 加法修饰器（绝对值增加，Mul 节点也使用此类型） */
    Add = 'Add',
    /** 百分比加法（value 0.5 = +50%，适用于 Mul 系节点） */
    Mul = 'Mul',
    /** 覆盖，直接替换属性值 */
    Override = 'Override',
    /** 限制范围 [value, maxValue] */
    Clamp = 'Clamp',
}

/** 属性节点类型枚举（基础设施用，标识节点角色） */
export enum EPropertyType {
    Base = 'Base',
    Buff = 'Buff',
    Other = 'Other',
}