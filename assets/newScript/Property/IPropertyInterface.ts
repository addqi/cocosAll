import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;
/**
 * 属性修饰器类型
 * 定义修饰器对数值的影响方式
 */
export enum EModifierMergeType {
    /** 加法，例如：+10 */
    Additive,

    /** 乘法，例如：×1.2 */
    Multiplicative,

    /** 覆盖，当多个覆盖取优先级最高 */
    Override,

    /** 限制范围（Clamp） */
    Clamp,
}
/*
 * 属性修饰器接口
 * 定义属性修饰器对数值的影响方式
 */
export interface IPropertyModifier<T> {
    /** 修饰器优先级，越大越优先处理 */
    priority: number;

    /** 修饰器类型 Add/Mul/Override/Clamp */
    mergeType: EModifierMergeType;
}
/**
 * 属性加法修饰器
 * 用于对属性值进行加法运算
 */
export class PropertyAddModifier implements IPropertyModifier<number> {
    mergeType: EModifierMergeType = EModifierMergeType.Additive;
    constructor(
        /** 修饰器值 */
        public value: number,
        /** 修饰器优先级 */
        public priority: number = 0,
    ){}
}
/**
 * 属性乘法修饰器
 * 用于对属性值进行乘法运算
 */
export class PropertyMulModifier implements IPropertyModifier<number> {
    mergeType: EModifierMergeType = EModifierMergeType.Multiplicative;
    constructor(
        /** 修饰器值 */
        public value: number,
        /** 修饰器优先级 */
        public priority: number = 0,
    ){}
}
/**
 * 属性覆盖修饰器
 * 用于对属性值进行覆盖运算
 */
export class PropertyOverrideModifier implements IPropertyModifier<number> {
    mergeType: EModifierMergeType = EModifierMergeType.Override;
    constructor(
        /** 修饰器值 */
        public value: number,
        /** 修饰器优先级 */
        public priority: number = 0,
    ){}
}
/**
 * 属性限制范围修饰器
 * 用于对属性值进行限制范围运算
 */
export class PropertyClampModifier implements IPropertyModifier<number> {
    mergeType = EModifierMergeType.Clamp;

    constructor(
        /** 最小值 */
        public min: number,
        /** 最大值 */
        public max: number,
        public priority: number = 0
    ) {}
}