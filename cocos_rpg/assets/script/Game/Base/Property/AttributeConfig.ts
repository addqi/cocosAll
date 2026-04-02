import moveSpeedConfig from './config/move_speed.json';
import hpConfig from './config/hp.json';
import attackConfig from './config/attack.json';
import defenseConfig from './config/defense.json';
import critRateConfig from './config/crit_rate.json';
import critDamageConfig from './config/crit_damage.json';

export interface ValueNodeConfig {
    id: string;
    value: number;
    tag?: string;
}

export interface ComputeNodeConfig {
    id: string;
    expression: string;
}

export interface AttributeConfig {
    attribute: string;
    valueNodes: ValueNodeConfig[];
    computeNodes: ComputeNodeConfig[];
}

export const ATTRIBUTE_CONFIGS: AttributeConfig[] = [
    moveSpeedConfig as AttributeConfig,
    hpConfig as AttributeConfig,
    attackConfig as AttributeConfig,
    defenseConfig as AttributeConfig,
    critRateConfig as AttributeConfig,
    critDamageConfig as AttributeConfig,
];

