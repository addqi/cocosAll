import { EPropertyAddType } from '../../baseSystem/properties';
import { EChangeType } from '../../baseSystem/buff';
import type { AttributeChange } from '../../baseSystem/buff';
import type { EntityPropertyMgr, ModifierHandle } from './EntityPropertyMgr';

/**
 * EChangeType（Buff 系统）→ EPropertyAddType（属性系统）映射表
 * 两个系统枚举独立维护，此处统一转换，避免互相依赖
 */
const CHANGE_TYPE_MAP: Readonly<Record<EChangeType, EPropertyAddType | null>> = {
    [EChangeType.ADD]:      EPropertyAddType.Add,
    [EChangeType.MUL]:      EPropertyAddType.Mul,
    [EChangeType.OVERRIDE]: EPropertyAddType.Override,
    [EChangeType.CLAMP]:    EPropertyAddType.Clamp,
    [EChangeType.EVENT]:    null, // 事件类型，不产生 Modifier，交由上层处理
};

/**
 * Buff 与属性系统的桥接层
 *
 * 职责：
 * - 将 BuffEffect.getChanges() 返回的声明式 AttributeChange[] 转为 Modifier 并应用
 * - 返回 ModifierHandle[] 供 BuffMgr 在 Buff 移除时回退
 *
 * 设计原则：
 * - AttributeChange.attrId 直接对应属性 JSON 中 valueNode 的 id（如 "Hp-Value-Buff"）
 *   Effect 负责通过 this.data 或 owner 的上下文决定 attrId，Resolver 不做语义翻译
 * - CLAMP 类型需要 min/max，通过 meta.min / meta.max 传递
 */
export class AttributeChangeResolver {
    /**
     * 应用属性变化，返回句柄列表（用于后续 revert）
     * @param changes  Effect.getChanges() 的返回值
     * @param propMgr  目标实体的属性管理器
     * @returns        ModifierHandle[]，与 changes 一一对应（EVENT 类型跳过）
     */
    static apply(changes: AttributeChange[], propMgr: EntityPropertyMgr): ModifierHandle[] {
        const handles: ModifierHandle[] = [];

        for (const change of changes) {
            const addType = CHANGE_TYPE_MAP[change.type];
            if (addType === null) {
                // EVENT 类型由外部逻辑处理，此处跳过
                continue;
            }

            const handle = propMgr.addModifier(
                change.attrId,
                addType,
                change.value ?? 0,
                change.meta?.max
            );
            handles.push(handle);
        }

        return handles;
    }

    /**
     * 回退（撤销）已应用的属性变化
     * @param handles  apply() 返回的句柄列表
     * @param propMgr  目标实体的属性管理器
     */
    static revert(handles: ModifierHandle[], propMgr: EntityPropertyMgr): void {
        handles.forEach((handle) => propMgr.remove(handle));
    }
}
