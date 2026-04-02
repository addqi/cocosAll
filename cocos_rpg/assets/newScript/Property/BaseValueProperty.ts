import { _decorator, Component, Node } from 'cc';
import { IPropertyModifier } from './IPropertyInterface';


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
/**属性修饰器基类 */
export abstract class BasePropertyModifier<T> implements IProperty<T> {
    /** 缓存最终值 */
    private cachedValue: T;
    /** 是否需要重新计算 */
    private isDirty = true;
    /** 属性修饰器列表 */
    private modifiers:IPropertyModifier <T>[] = [];
    /** 属性 ID */
    public propertyId: string;
    /** 获取当前最终值 */
    public abstract getValue(
        IPropertyModifier.
    ): T;

    /** 添加修饰器 */
    public abstract addModifier(mod: IPropertyModifier<T>): void;
    /** 移除修饰器 */
    public abstract removeModifier(mod: IPropertyModifier<T>): void;
    /** 获取当前最终值 */
    public getValue(): T {
        /** 缓存最终值 */
        if (this.isDirty) {
            this.cachedValue = this.calculate();
            this.isDirty = false;
        }
        return this.cachedValue;
    }
    public makeDirty() {
        this.isDirty = true;
        /** 递归标记修饰器 */
        for (let mod of this.modifiers) {
            mod.makeDirty();
        }
    }
    protected abstract calculate(): T;
}
/**属性修饰器最终值计算逻辑 */
