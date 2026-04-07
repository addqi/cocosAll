import { EModifierMergeType } from './ModifierType';

/**
 * 属性修饰器接口，所有修饰器必须实现
 */
export interface IPropertyModifier<T> {
    /** 修饰器优先级，数值越大越后算 */
    priority: number;
    /** 修饰器类型 */
    mergeType: EModifierMergeType;
    /** 是否生效，false 时不参与计算（用于"屏蔽"效果） */
    enabled?: boolean;
}

/** 加法型修饰器 */
export class PropertyAddModifier implements IPropertyModifier<number> {
    mergeType = EModifierMergeType.Additive;
    enabled = true;

    constructor(
        /** 加多少 */
        public value: number,
        public priority: number = 0
    ) {}
}

/** 乘法型修饰器 */
export class PropertyMulModifier implements IPropertyModifier<number> {
    mergeType = EModifierMergeType.Multiplicative;
    enabled = true;

    constructor(
        /** 乘以多少，例如 1.2 = +20% */
        public value: number,
        public priority: number = 0
    ) {}
}

/** 覆盖型修饰器 */
export class PropertyOverrideModifier implements IPropertyModifier<number> {
    mergeType = EModifierMergeType.Override;
    enabled = true;

    constructor(
        /** 直接覆盖为此值 */
        public value: number,
        public priority: number = 0
    ) {}
}

/** 限制范围型修饰器 */
export class PropertyClampModifier implements IPropertyModifier<number> {
    mergeType = EModifierMergeType.Clamp;
    enabled = true;

    constructor(
        /** 最小值 */
        public min: number,
        /** 最大值 */
        public max: number,
        public priority: number = 0
    ) {}
}
