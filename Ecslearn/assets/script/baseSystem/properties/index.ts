/**
 * 属性系统模块 - 统一导出（纯基础设施，不含业务枚举）
 * 业务枚举（EPropertyId / EPropertyConfigId）见 game/shared/enum/propertyEnum.ts
 */
export { EModifierMergeType } from './ModifierType';
export { EPropertyAddType, EPropertyType } from './enum';
export {
    type IPropertyModifier,
    PropertyAddModifier,
    PropertyMulModifier,
    PropertyOverrideModifier,
    PropertyClampModifier,
} from './Modifier';
export type { IProperty } from './IProperty';
export { BaseValueProperty } from './BaseValueProperty';
export { ComputeValueProperty } from './ComputeValueProperty';
export { PropertyManager } from './PropertyManager';
export { GeneralPropertyMgr } from './GeneralPropertyMgr';
export { PropertyConfigLoader } from './PropertyConfigLoader';
export type { AttributeConfig, ValueNodeConfig, ComputeNodeConfig } from './AttributeConfig';
