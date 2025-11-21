import { _decorator, Component, Node } from 'cc';
import { IPropertyModifier, PropertyAddModifier, PropertyClampModifier, PropertyMulModifier, PropertyOverrideModifier } from './IPropertyInterface';
import { EModifierMergeType } from '../../GlobalEnum/Enum';

/**
 * 属性的统一行为接口
 */
export interface IProperty<T> {
    /** 属性 ID（唯一） */
    propertyId: string;

    /** 获取当前最终值 */
    getValue(): T;

    /** 重新计算标记 */
    makeDirty(): void;

    /** 添加修饰器 */
    addModifier(mod: IPropertyModifier<T>): void;

    /** 移除修饰器 */
    removeModifier(mod: IPropertyModifier<T>): void;
}

/**
 * 基础属性（可附加修饰器）
 * 例如：MoveSpeed-Base = 100
 */
export class BaseValueProperty implements IProperty<number> {
    /** 是否需要重新计算 */
    private isDirty = true;

    /** 缓存值，用于优化 */
    private cachedValue = 0;

    /** 全部 modifier（加法 / 乘法 / Clamp / Override） */
    private modifiers: IPropertyModifier<number>[] = [];

    constructor(
        /** 初始基础值 */
        private baseValue: number,

        /** 属性 ID（必须唯一） */
        public propertyId: string
    ) { }

    /** 添加修饰器 */
    addModifier(mod: IPropertyModifier<number>) {
        this.modifiers.push(mod);
        this.makeDirty();
    }

    /** 移除修饰器 */
    removeModifier(mod: IPropertyModifier<number>) {
        const idx = this.modifiers.indexOf(mod);
        if (idx !== -1) this.modifiers.splice(idx, 1);
        this.makeDirty();
    }

    /** 标记 Dirty，下次 getValue 会重新计算 */
    makeDirty() {
        this.isDirty = true;
    }

    /** 获取最终值（自动计算并缓存） */
    getValue(): number {
        if (!this.isDirty) return this.cachedValue;

        let v = this.baseValue;

        // 1. 加法 Modifier
        this.modifiers
            .filter(m => m.mergeType === EModifierMergeType.Additive)
            .sort((a, b) => a.priority - b.priority)
            .forEach(m => {
                v += (m as PropertyAddModifier).value;
            });

        // 2. 乘法 Modifier
        this.modifiers
            .filter(m => m.mergeType === EModifierMergeType.Multiplicative)
            .sort((a, b) => a.priority - b.priority)
            .forEach(m => {
                v *= (m as PropertyMulModifier).value;
            });

        // 3. Clamp 限制
        this.modifiers
            .filter(m => m.mergeType === EModifierMergeType.Clamp)
            .sort((a, b) => a.priority - b.priority)
            .forEach(m => {
                const c = m as PropertyClampModifier;
                v = Math.min(Math.max(v, c.min), c.max);
            });

        // 4. Override 覆盖（只取最后优先级最高的）
        const overrides = this.modifiers
            .filter(m => m.mergeType === EModifierMergeType.Override)
            .sort((a, b) => a.priority - b.priority);

        if (overrides.length > 0) {
            v = (overrides[overrides.length - 1] as PropertyOverrideModifier).value;
        }

        this.cachedValue = v;
        this.isDirty = false;

        return v;
    }
}

export class ComputeValueProperty implements IProperty<number> {
    private isDirty = true;
    private cachedValue = 0;

    constructor(
        /** 计算函数，读取 manager 中的其它属性 */
        private getter: () => number,

        public propertyId: string
    ) { }
    addModifier(): void { }
    removeModifier(): void { }

    makeDirty() {
        this.isDirty = true;
    }

    getValue(): number {
        if (!this.isDirty) return this.cachedValue;

        this.cachedValue = this.getter();
        this.isDirty = false;
        return this.cachedValue;
    }
}

