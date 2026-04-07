import type { AttributeConfig, ValueNodeConfig, ComputeNodeConfig } from './AttributeConfig';

/**
 * 属性配置加载器
 * 支持解析 JSON 字符串、校验并转换为 AttributeConfig
 */
export class PropertyConfigLoader {
    /**
     * 从 JSON 字符串解析为 AttributeConfig
     */
    static parseFromString(jsonStr: string): AttributeConfig {
        try {
            const obj = JSON.parse(jsonStr) as Record<string, unknown>;
            return this.parseFromObject(obj);
        } catch (e) {
            console.error('[PropertyConfigLoader] JSON 解析失败:', e);
            throw e;
        }
    }

    /**
     * 从普通对象解析为 AttributeConfig
     */
    static parseFromObject(obj: Record<string, unknown>): AttributeConfig {
        const attribute = obj.attribute;
        const valueNodes = obj.valueNodes;
        const computeNodes = obj.computeNodes;

        if (typeof attribute !== 'string') {
            throw new Error('[PropertyConfigLoader] 缺少或无效的 attribute 字段');
        }
        if (!Array.isArray(valueNodes)) {
            throw new Error('[PropertyConfigLoader] valueNodes 必须是数组');
        }
        if (!Array.isArray(computeNodes)) {
            throw new Error('[PropertyConfigLoader] computeNodes 必须是数组');
        }

        const cfg: AttributeConfig = {
            attribute,
            valueNodes: valueNodes.map((n) => this.parseValueNode(n as Record<string, unknown>)),
            computeNodes: computeNodes.map((n) => this.parseComputeNode(n as Record<string, unknown>)),
        };

        return cfg;
    }

    private static parseValueNode(obj: Record<string, unknown>): ValueNodeConfig {
        const id = obj.id;
        const value = obj.value;
        if (typeof id !== 'string' || typeof value !== 'number') {
            throw new Error('[PropertyConfigLoader] ValueNode 需要 id(string) 和 value(number)');
        }
        const node: ValueNodeConfig = { id, value };
        if (obj.tag != null) node.tag = String(obj.tag);
        return node;
    }

    private static parseComputeNode(obj: Record<string, unknown>): ComputeNodeConfig {
        const id = obj.id;
        const expression = obj.expression;
        if (typeof id !== 'string' || typeof expression !== 'string') {
            throw new Error('[PropertyConfigLoader] ComputeNode 需要 id(string) 和 expression(string)');
        }
        return { id, expression };
    }
}
