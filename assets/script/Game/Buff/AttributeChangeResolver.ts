import { _decorator, Component, Node } from 'cc';
import { BuffRuntimeInfo } from './BuffRuntimeInfo';
import { AttributeChange } from './types';
import { PropertyAddModifier, PropertyClampModifier, PropertyMulModifier, PropertyOverrideModifier } from '../Base/Property/IPropertyInterface';
const { ccclass, property } = _decorator;
/**
 * AttributeChangeResolver
 * - 将 BuffEffect 的声明式 AttributeChange 转换成你属性系统可识别的 modifier（并添加/移除）
 * - 这里是“桥接”层：把声明式变化映射为具体的 addModifier/removeModifier 的调用
 */
@ccclass('AttributeChangeResolver')
export class AttributeChangeResolver  {

    /**
     * 将 BuffEffect 的声明式 getChanges() 转化为属性系统的 modifier，并应用到属性上
     * 每个生成的 modifier 会记录在 runtime._appliedModifiers 中，用于后续移除
     */
    static applyChanges(runtime: BuffRuntimeInfo) {

        /** 取得 buff 挂载的对象（人物/怪物等） */
        const owner = runtime.owner as any;

        /**
         * 从 owner 获取属性系统 PropertyManager
         * 需要 owner 实现 getPropertyManager()
         */
        const pm = owner.getPropertyManager ? owner.getPropertyManager() : null;

        if (!pm) {
            console.warn("[AttributeChangeResolver] owner 未提供 PropertyManager");
            return;
        }

        /**
         * 获取 buff 声明的属性变化列表
         * 由具体 BuffEffect.getChanges() 提供
         */
        const changes = runtime.effect.getChanges();

        /**
         * 初始化存储已添加 modifier 的数组
         * 如果之前已经有，就用原来的；没有就创建新数组
         */
        runtime['_appliedModifiers'] = runtime['_appliedModifiers'] || [];

        const dirtyAttrIds = new Set<string>();

        /** 遍历每一条声明式属性变化 */
        for (const ch of changes) {

            /** 获取具体属性对象（例如 MoveSpeed、Attack 等） */
            const prop = pm.getProperty(ch.attrId);
            if (!prop) {
                console.warn(`[AttributeChangeResolver] 属性 ${ch.attrId} 未注册，忽略变化`);
                continue;
            }

            const mod = AttributeChangeResolver.createModifier(ch);
            if (!mod) {
                console.warn(`[AttributeChangeResolver] 无法根据类型 ${ch.type} 创建 modifier`);
                continue;
            }

            /** 向属性系统添加 modifier（属性系统需提供 addModifier） */
            prop.addModifier(mod);

            /** 记录用于后续 removeChanges */
            runtime['_appliedModifiers'].push({ prop, mod });
            dirtyAttrIds.add(ch.attrId);
        }

        if (owner?.refreshPropertyDirty) {
            owner.refreshPropertyDirty(Array.from(dirtyAttrIds));
        } else {
            owner?.refreshSpeedDirty?.();
        }
    }

    /**
     * 从属性系统中移除 applyChanges() 加过的所有 modifier
     * 当 Buff 结束、被驱散、被覆盖时调用
     */
    static removeChanges(runtime: BuffRuntimeInfo) {
        /** 取出之前保存的 modifier 列表 */
        const list = runtime['_appliedModifiers'] as Array<{ prop: any, mod: any }>;

        /** 如果没有记录，直接返回 */
        if (!list || list.length === 0) return;

        /** 遍历列表，逐个移除 modifier */
        const dirtyAttrIds = new Set<string>();
        for (const item of list) {
            item.prop.removeModifier(item.mod);
            dirtyAttrIds.add(item.prop.propertyId);
        }

        const owner = runtime.owner as any;
        if (owner?.refreshPropertyDirty) {
            owner.refreshPropertyDirty(Array.from(dirtyAttrIds));
        } else {
            owner?.refreshSpeedDirty?.();
        }
    }

    private static createModifier(change: AttributeChange) {
        const priority = change.meta?.priority ?? 0;
        switch (change.type) {
            case 'ADD':
                return new PropertyAddModifier(change.value ?? 0, priority);
            case 'MUL':
                return new PropertyMulModifier(change.value ?? 1, priority);
            case 'OVERRIDE':
                return new PropertyOverrideModifier(change.value ?? 0, priority);
            case 'CLAMP': {
                const min = change.meta?.min ?? Number.NEGATIVE_INFINITY;
                const max = change.meta?.max ?? Number.POSITIVE_INFINITY;
                return new PropertyClampModifier(min, max, priority);
            }
            default:
                console.warn(`[AttributeChangeResolver] 未支持的变化类型 ${change.type}`);
                return null;
        }
    }
}
