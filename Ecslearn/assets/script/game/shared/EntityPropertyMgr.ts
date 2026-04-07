import { GeneralPropertyMgr, EPropertyAddType } from '../../baseSystem/properties';
import type { IPropertyModifier, AttributeConfig } from '../../baseSystem/properties';
import { EPropertyId, EPropertyConfigId } from './enum/propertyEnum';
import { SHARED_ATTRIBUTE_CONFIGS } from './config/propertyConfig/attributeConfigs';
import { PROP_CONFIG_MAP } from './config/propertyConfig/propConfigMap';

/**
 * 修饰器句柄，由 add() / addModifier() 返回，用于 remove() 精确移除
 */
export type ModifierHandle = number;

/**
 * 实体初始属性配置格式
 * 来自各实体的 player.json / enemy.json 等单一配置文件
 *
 * @example
 * { "Hp": { "base": 1000 }, "MoveSpeed": { "base": 100, "min": 10, "max": 100 } }
 */
export interface PropertyBaseConfig {
    [key: string]: {
        /** 基础值，写入 xxx-Value-Config 节点 */
        base: number;
        /**
         * 最终属性的最小值（可选）
         * 设置后会在最终计算节点上添加永久 Clamp 修饰器
         */
        min?: number;
        /**
         * 最终属性的最大值（可选）
         * 设置后会在最终计算节点上添加永久 Clamp 修饰器
         */
        max?: number;
    };
}

/**
 * 公共实体属性管理器
 *
 * 职责：
 * 1. 从共享属性结构配置初始化节点图（继承自 GeneralPropertyMgr）
 * 2. 根据实体自己的初始值配置设置基础值（setInitialValues）
 * 3. 通过语义 ID（EPropertyId + EPropertyConfigId）添加/移除修饰器
 * 4. 管理 ModifierHandle → modifier 的生命周期映射
 *
 * 玩家、敌人、NPC 等继承此类，只需在构造时注入自己的初始值配置即可。
 */
export class EntityPropertyMgr extends GeneralPropertyMgr {
    private handleCounter = 0;
    private handleMap = new Map<ModifierHandle, { propId: string; modifier: IPropertyModifier<number> }>();

    /**
     * @param configs 属性结构配置列表，不传则使用共享配置（SHARED_ATTRIBUTE_CONFIGS）
     */
    constructor(configs?: AttributeConfig[]) {
        super();
        this.initializeFromConfigs(configs ?? SHARED_ATTRIBUTE_CONFIGS);
    }

    /**
     * 注入实体初始基础值，并处理 min/max 范围约束
     *
     * 1. 将 base 写入对应的 xxx-Value-Config 节点（BaseValueProperty.setBase）
     * 2. 若配置了 min 或 max，在最终计算节点（与 EPropertyId 同名）上添加永久 Clamp 修饰器
     *    例：MoveSpeed { min: 10, max: 100 } → 给 "MoveSpeed" 节点加 Clamp(10, 100)
     *
     * @param config 初始值配置对象（来自 player.json 等单一配置文件）
     */
    setInitialValues(config: PropertyBaseConfig): void {
        Object.keys(config).forEach((key) => {
            const item = config[key];
            if (!item || typeof item.base !== 'number') return;

            // 写入基础值到 Config 节点
            const nodeId = PROP_CONFIG_MAP[key as EPropertyId]?.[EPropertyConfigId.BaseValueConfig];
            if (!nodeId) {
                console.warn(`[EntityPropertyMgr] 未找到 ${key} 的 BaseValueConfig 节点，请检查 PROP_CONFIG_MAP`);
                return;
            }

            const prop = this.getProperty(nodeId);
            if (prop && 'setBase' in prop) {
                (prop as { setBase: (v: number) => void }).setBase(item.base);
                this.markDirty([nodeId]);
            }

            // 若配置了 min / max，在最终计算节点（propId = key）上添加永久 Clamp 修饰器
            if (item.min !== undefined || item.max !== undefined) {
                const min = item.min ?? -Infinity;
                const max = item.max ?? Infinity;
                // 直接调用基类方法，不走 handleMap（永久约束，不可移除）
                this.addByPropId(key, EPropertyAddType.Clamp, min, max);
            }
        });
    }

    /**
     * 获取属性最终计算值
     * @param id 属性 ID（EPropertyId），对应 JSON 中 computeNodes 的顶层节点
     */
    getValue(id: EPropertyId): number {
        return this.get(id);
    }

    /**
     * 通过语义 ID 添加修饰器
     * @param id     属性 ID，如 EPropertyId.Hp
     * @param part   作用节点，如 EPropertyConfigId.BaseValueBuff
     * @param type   修饰类型，Add/Mul/Override/Clamp
     * @param value  数值。固定加成传绝对值；百分比加成（Mul 节点）传 0~1（0.5 = +50%）
     * @param maxValue 仅 Clamp 类型需要（上限值）
     * @returns ModifierHandle，用于 remove() 精确移除
     */
    add(
        id: EPropertyId,
        part: EPropertyConfigId,
        type: EPropertyAddType,
        value: number,
        maxValue?: number
    ): ModifierHandle {
        const handle = ++this.handleCounter;
        const propId = PROP_CONFIG_MAP[id]?.[part];
        if (!propId) {
            console.warn(`[EntityPropertyMgr] 未找到节点：id=${id}, part=${part}`);
            return handle;
        }
        const mod = this.addByPropId(propId, type, value, maxValue);
        if (mod) this.handleMap.set(handle, { propId, modifier: mod });
        return handle;
    }

    /**
     * 通过节点 ID 直接添加修饰器（供 AttributeChangeResolver 使用）
     * @param propId 具体节点 ID，如 "Hp-Value-Buff"（与 shared/config/*.json 中 id 一致）
     * @returns ModifierHandle
     */
    addModifier(
        propId: string,
        type: EPropertyAddType,
        value: number,
        maxValue?: number
    ): ModifierHandle {
        const handle = ++this.handleCounter;
        const mod = this.addByPropId(propId, type, value, maxValue);
        if (mod) this.handleMap.set(handle, { propId, modifier: mod });
        return handle;
    }

    /**
     * 移除指定句柄对应的修饰器
     * @param handle add() / addModifier() 返回的句柄
     * @returns 是否成功移除
     */
    remove(handle: ModifierHandle): boolean {
        const entry = this.handleMap.get(handle);
        if (!entry) return false;
        this.removeModifierAndRefresh(entry.propId, entry.modifier);
        this.handleMap.delete(handle);
        return true;
    }

    /**
     * 移除所有已添加的修饰器
     */
    removeAll(): void {
        this.handleMap.forEach((entry) => {
            this.removeModifierAndRefresh(entry.propId, entry.modifier);
        });
        this.handleMap.clear();
    }
}
