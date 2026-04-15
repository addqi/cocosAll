import { EPropertyId, EPropertyConfigId } from '../enum/propertyEnum';

// 由 tools/auto/create-property-config.js 自动生成，请勿直接手动编辑

/**
 * 属性语义 → 节点 ID 映射表（所有实体共用）
 * EPropertyId + EPropertyConfigId → 具体 valueNode id（与 propertyConfig/*.json 对应）
 */
export const PROP_CONFIG_MAP: Record<EPropertyId, Record<EPropertyConfigId, string>> = {
    [EPropertyId.Hp]: {
        [EPropertyConfigId.BaseValueConfig]: 'Hp-Value-Config',
        [EPropertyConfigId.BaseValueBuff]:   'Hp-Value-Buff',
        [EPropertyConfigId.BaseValueOther]:  'Hp-Value-Other',
        [EPropertyConfigId.MulBuff]:         'Hp-Mul-Buff',
        [EPropertyConfigId.MulOther]:        'Hp-Mul-Other',
    },
    [EPropertyId.Attack]: {
        [EPropertyConfigId.BaseValueConfig]: 'Attack-Value-Config',
        [EPropertyConfigId.BaseValueBuff]:   'Attack-Value-Buff',
        [EPropertyConfigId.BaseValueOther]:  'Attack-Value-Other',
        [EPropertyConfigId.MulBuff]:         'Attack-Mul-Buff',
        [EPropertyConfigId.MulOther]:        'Attack-Mul-Other',
    },
    [EPropertyId.Defense]: {
        [EPropertyConfigId.BaseValueConfig]: 'Defense-Value-Config',
        [EPropertyConfigId.BaseValueBuff]:   'Defense-Value-Buff',
        [EPropertyConfigId.BaseValueOther]:  'Defense-Value-Other',
        [EPropertyConfigId.MulBuff]:         'Defense-Mul-Buff',
        [EPropertyConfigId.MulOther]:        'Defense-Mul-Other',
    },
    [EPropertyId.CritRate]: {
        [EPropertyConfigId.BaseValueConfig]: 'CritRate-Value-Config',
        [EPropertyConfigId.BaseValueBuff]:   'CritRate-Value-Buff',
        [EPropertyConfigId.BaseValueOther]:  'CritRate-Value-Other',
        [EPropertyConfigId.MulBuff]:         'CritRate-Mul-Buff',
        [EPropertyConfigId.MulOther]:        'CritRate-Mul-Other',
    },
    [EPropertyId.CritDmg]: {
        [EPropertyConfigId.BaseValueConfig]: 'CritDmg-Value-Config',
        [EPropertyConfigId.BaseValueBuff]:   'CritDmg-Value-Buff',
        [EPropertyConfigId.BaseValueOther]:  'CritDmg-Value-Other',
        [EPropertyConfigId.MulBuff]:         'CritDmg-Mul-Buff',
        [EPropertyConfigId.MulOther]:        'CritDmg-Mul-Other',
    },
    [EPropertyId.AttackSpeed]: {
        [EPropertyConfigId.BaseValueConfig]: 'AttackSpeed-Value-Config',
        [EPropertyConfigId.BaseValueBuff]:   'AttackSpeed-Value-Buff',
        [EPropertyConfigId.BaseValueOther]:  'AttackSpeed-Value-Other',
        [EPropertyConfigId.MulBuff]:         'AttackSpeed-Mul-Buff',
        [EPropertyConfigId.MulOther]:        'AttackSpeed-Mul-Other',
    },
    [EPropertyId.MoveSpeed]: {
        [EPropertyConfigId.BaseValueConfig]: 'MoveSpeed-Value-Config',
        [EPropertyConfigId.BaseValueBuff]:   'MoveSpeed-Value-Buff',
        [EPropertyConfigId.BaseValueOther]:  'MoveSpeed-Value-Other',
        [EPropertyConfigId.MulBuff]:         'MoveSpeed-Mul-Buff',
        [EPropertyConfigId.MulOther]:        'MoveSpeed-Mul-Other',
    },
    [EPropertyId.LifestealRate]: {
        [EPropertyConfigId.BaseValueConfig]: 'LifestealRate-Value-Config',
        [EPropertyConfigId.BaseValueBuff]:   'LifestealRate-Value-Buff',
        [EPropertyConfigId.BaseValueOther]:  'LifestealRate-Value-Other',
        [EPropertyConfigId.MulBuff]:         'LifestealRate-Mul-Buff',
        [EPropertyConfigId.MulOther]:        'LifestealRate-Mul-Other',
    },
    [EPropertyId.ExtraProjectiles]: {
        [EPropertyConfigId.BaseValueConfig]: 'ExtraProjectiles-Value-Config',
        [EPropertyConfigId.BaseValueBuff]:   'ExtraProjectiles-Value-Buff',
        [EPropertyConfigId.BaseValueOther]:  'ExtraProjectiles-Value-Other',
        [EPropertyConfigId.MulBuff]:         'ExtraProjectiles-Mul-Buff',
        [EPropertyConfigId.MulOther]:        'ExtraProjectiles-Mul-Other',
    },
    [EPropertyId.PierceCount]: {
        [EPropertyConfigId.BaseValueConfig]: 'PierceCount-Value-Config',
        [EPropertyConfigId.BaseValueBuff]:   'PierceCount-Value-Buff',
        [EPropertyConfigId.BaseValueOther]:  'PierceCount-Value-Other',
        [EPropertyConfigId.MulBuff]:         'PierceCount-Mul-Buff',
        [EPropertyConfigId.MulOther]:        'PierceCount-Mul-Other',
    },
    [EPropertyId.BounceCount]: {
        [EPropertyConfigId.BaseValueConfig]: 'BounceCount-Value-Config',
        [EPropertyConfigId.BaseValueBuff]:   'BounceCount-Value-Buff',
        [EPropertyConfigId.BaseValueOther]:  'BounceCount-Value-Other',
        [EPropertyConfigId.MulBuff]:         'BounceCount-Mul-Buff',
        [EPropertyConfigId.MulOther]:        'BounceCount-Mul-Other',
    },
    [EPropertyId.SpreadAngle]: {
        [EPropertyConfigId.BaseValueConfig]: 'SpreadAngle-Value-Config',
        [EPropertyConfigId.BaseValueBuff]:   'SpreadAngle-Value-Buff',
        [EPropertyConfigId.BaseValueOther]:  'SpreadAngle-Value-Other',
        [EPropertyConfigId.MulBuff]:         'SpreadAngle-Mul-Buff',
        [EPropertyConfigId.MulOther]:        'SpreadAngle-Mul-Other',
    },
    [EPropertyId.HomingStrength]: {
        [EPropertyConfigId.BaseValueConfig]: 'HomingStrength-Value-Config',
        [EPropertyConfigId.BaseValueBuff]:   'HomingStrength-Value-Buff',
        [EPropertyConfigId.BaseValueOther]:  'HomingStrength-Value-Other',
        [EPropertyConfigId.MulBuff]:         'HomingStrength-Mul-Buff',
        [EPropertyConfigId.MulOther]:        'HomingStrength-Mul-Other',
    },
    [EPropertyId.ArrowSpeed]: {
        [EPropertyConfigId.BaseValueConfig]: 'ArrowSpeed-Value-Config',
        [EPropertyConfigId.BaseValueBuff]:   'ArrowSpeed-Value-Buff',
        [EPropertyConfigId.BaseValueOther]:  'ArrowSpeed-Value-Other',
        [EPropertyConfigId.MulBuff]:         'ArrowSpeed-Mul-Buff',
        [EPropertyConfigId.MulOther]:        'ArrowSpeed-Mul-Other',
    },
    [EPropertyId.AttackRange]: {
        [EPropertyConfigId.BaseValueConfig]: 'AttackRange-Value-Config',
        [EPropertyConfigId.BaseValueBuff]:   'AttackRange-Value-Buff',
        [EPropertyConfigId.BaseValueOther]:  'AttackRange-Value-Other',
        [EPropertyConfigId.MulBuff]:         'AttackRange-Mul-Buff',
        [EPropertyConfigId.MulOther]:        'AttackRange-Mul-Other',
    },
    [EPropertyId.StaggerDuration]: {
        [EPropertyConfigId.BaseValueConfig]: 'StaggerDuration-Value-Config',
        [EPropertyConfigId.BaseValueBuff]:   'StaggerDuration-Value-Buff',
        [EPropertyConfigId.BaseValueOther]:  'StaggerDuration-Value-Other',
        [EPropertyConfigId.MulBuff]:         'StaggerDuration-Mul-Buff',
        [EPropertyConfigId.MulOther]:        'StaggerDuration-Mul-Other',
    },
};
