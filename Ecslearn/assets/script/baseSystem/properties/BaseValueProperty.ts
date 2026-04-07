import { EModifierMergeType } from './ModifierType';
import type { IPropertyModifier } from './Modifier';
import {
    PropertyAddModifier,
    PropertyMulModifier,
    PropertyOverrideModifier,
    PropertyClampModifier,
} from './Modifier';
import type { IProperty } from './IProperty';

/**
 * 基础属性（可附加修饰器）
 * 例如：MoveSpeed-Base = 100，可加各种 Add/Mul/Override/Clamp 修饰器
 */
export class BaseValueProperty implements IProperty<number> {
    private isDirty = true;
    private cachedValue = 0;
    private modifiers: IPropertyModifier<number>[] = [];

    constructor(
        /** 初始基础值 */
        private baseValue: number,
        /** 属性 ID（必须唯一） */
        public propertyId: string
    ) {
        this.cachedValue = baseValue;
    }

    /** 设置基础值 */
    setBase(value: number) {
        this.baseValue = value;
        this.makeDirty();
    }

    /** 获取基础值 */
    getBase() {
        return this.baseValue;
    }

    addModifier(mod: IPropertyModifier<number>) {
        this.modifiers.push(mod);
        this.makeDirty();
    }

    removeModifier(mod: IPropertyModifier<number>) {
        const idx = this.modifiers.indexOf(mod);
        if (idx !== -1) {
            this.modifiers.splice(idx, 1);
            this.makeDirty();
        }
    }

    makeDirty() {
        this.isDirty = true;
    }

    /** 是否启用修饰器（enabled 不为 false 即参与计算） */
    private isModifierEnabled(mod: IPropertyModifier<number>): boolean {
        return mod.enabled !== false;
    }

    getValue(): number {
        if (!this.isDirty) return this.cachedValue;

        let v = this.baseValue;
        const mods = this.modifiers.filter((m) => this.isModifierEnabled(m));

        // 1. 加法
        mods
            .filter((m) => m.mergeType === EModifierMergeType.Additive)
            .sort((a, b) => a.priority - b.priority)
            .forEach((m) => {
                v += (m as PropertyAddModifier).value;
            });

        // 2. 乘法
        mods
            .filter((m) => m.mergeType === EModifierMergeType.Multiplicative)
            .sort((a, b) => a.priority - b.priority)
            .forEach((m) => {
                v *= (m as PropertyMulModifier).value;
            });

        // 3. Clamp 限制
        mods
            .filter((m) => m.mergeType === EModifierMergeType.Clamp)
            .sort((a, b) => a.priority - b.priority)
            .forEach((m) => {
                const c = m as PropertyClampModifier;
                v = Math.min(Math.max(v, c.min), c.max);
            });

        // 4. Override 覆盖（取优先级最高者，即排序后最后一个）
        const overrides = mods
            .filter((m) => m.mergeType === EModifierMergeType.Override)
            .sort((a, b) => a.priority - b.priority);

        if (overrides.length > 0) {
            v = (overrides[overrides.length - 1] as PropertyOverrideModifier).value;
        }

        this.cachedValue = v;
        this.isDirty = false;
        return v;
    }
}
