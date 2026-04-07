import type { IPropertyModifier } from './Modifier';
import type { IProperty } from './IProperty';

/**
 * 计算属性：不使用 Modifier，只通过函数动态计算
 * 用于依赖其它属性的场景，例如：MoveSpeed = Value × MulBuff × MulOther
 */
export class ComputeValueProperty implements IProperty<number> {
    private isDirty = true;
    private cachedValue = 0;

    constructor(
        /** 计算函数，可读取外部数据（如其它属性） */
        private getter: () => number,
        /** 属性 ID（必须唯一） */
        public propertyId: string
    ) {}

    addModifier(_mod: IPropertyModifier<number>): void {
        // 计算属性不直接挂修饰器
    }

    removeModifier(_mod: IPropertyModifier<number>): void {
        // 计算属性不直接挂修饰器
    }

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
