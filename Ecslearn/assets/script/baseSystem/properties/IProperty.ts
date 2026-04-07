import type { IPropertyModifier } from './Modifier';

/**
 * 属性的统一行为接口
 */
export interface IProperty<T> {
    /** 属性 ID（唯一） */
    propertyId: string;
    /** 获取当前最终值 */
    getValue(): T;
    /** 标记需要重新计算 */
    makeDirty(): void;
    /** 添加修饰器 */
    addModifier(mod: IPropertyModifier<T>): void;
    /** 移除修饰器 */
    removeModifier(mod: IPropertyModifier<T>): void;
}
