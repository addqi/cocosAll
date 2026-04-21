import type { AttributeConfig } from '../../../baseSystem/properties';

// 由 tools/auto/create-property-config.js 自动生成，请勿直接手动编辑

import attackConfig           from './attack.json';
import hpConfig               from './hp.json';
import defenseConfig          from './defense.json';
import critRateConfig         from './crit_rate.json';
import critDmgConfig          from './crit_dmg.json';
import attackSpeedConfig      from './attack_speed.json';
import moveSpeedConfig        from './move_speed.json';
import lifestealRateConfig    from './lifesteal_rate.json';
import extraProjectilesConfig from './extra_projectiles.json';
import pierceCountConfig      from './pierce_count.json';
import bounceCountConfig      from './bounce_count.json';
import spreadAngleConfig      from './spread_angle.json';
import homingStrengthConfig   from './homing_strength.json';
import arrowSpeedConfig       from './arrow_speed.json';
import attackRangeConfig      from './attack_range.json';
import staggerDurationConfig from './stagger_duration.json';
import pickupRangeConfig     from './pickup_range.json';

/**
 * 共享属性结构配置（所有实体通用）
 * 仅定义节点拓扑和计算表达式，初始值统一为 0
 * 实体的初始基础值由各自的 player.json 通过 setInitialValues() 注入
 */
export const SHARED_ATTRIBUTE_CONFIGS: AttributeConfig[] = [
    hpConfig               as AttributeConfig,
    attackConfig           as AttributeConfig,
    defenseConfig          as AttributeConfig,
    critRateConfig         as AttributeConfig,
    critDmgConfig          as AttributeConfig,
    attackSpeedConfig      as AttributeConfig,
    moveSpeedConfig        as AttributeConfig,
    lifestealRateConfig    as AttributeConfig,
    extraProjectilesConfig as AttributeConfig,
    pierceCountConfig      as AttributeConfig,
    bounceCountConfig      as AttributeConfig,
    spreadAngleConfig      as AttributeConfig,
    homingStrengthConfig   as AttributeConfig,
    arrowSpeedConfig       as AttributeConfig,
    attackRangeConfig      as AttributeConfig,
    staggerDurationConfig  as AttributeConfig,
    pickupRangeConfig      as AttributeConfig,
];
