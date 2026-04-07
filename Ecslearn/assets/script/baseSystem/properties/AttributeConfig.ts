/**
 * 属性配置类型定义
 */

/** 基础值节点配置 */
export interface ValueNodeConfig {
    id: string;
    value: number;
    tag?: string;
}

/** 计算节点配置 */
export interface ComputeNodeConfig {
    id: string;
    /** 表达式，使用 {{属性ID}} 引用其它属性，例如：{{A}} + {{B}} */
    expression: string;
}

/** 单个属性配置文件结构 */
export interface AttributeConfig {
    attribute: string;
    valueNodes: ValueNodeConfig[];
    computeNodes: ComputeNodeConfig[];
}
