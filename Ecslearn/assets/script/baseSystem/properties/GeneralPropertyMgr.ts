import { PropertyManager } from './PropertyManager';
import type { AttributeConfig } from './AttributeConfig';
import { PropertyAddModifier, PropertyClampModifier, PropertyOverrideModifier, type IPropertyModifier } from './Modifier';
import { BaseValueProperty } from './BaseValueProperty';
import { ComputeValueProperty } from './ComputeValueProperty';
import { EPropertyAddType } from './enum';

type DependencyGraph = Map<string, Set<string>>;

/**
 * 通用属性管理器：支持从 JSON 配置初始化
 * 支持表达式计算、依赖追踪、markDirty 级联刷新
 */
export class GeneralPropertyMgr extends PropertyManager {
    private dependencyGraph: DependencyGraph = new Map();
    private computeIds: Set<string> = new Set();
    private initialized = false;

    /**
     * 从配置列表初始化属性，自动注册 Value 和 Compute 节点
     */
    initializeFromConfigs(configs: AttributeConfig[], force = false) {
        if (this.initialized && !force) return;

        if (force) {
            this.dependencyGraph.clear();
            this.computeIds.clear();
            this.clear();
        }

        configs.forEach((cfg) => this.registerAttribute(cfg));
        this.initialized = true;
    }

    /** 注册单个属性配置 */
    registerAttribute(config: AttributeConfig) {
        config.valueNodes?.forEach((node) => {
            this.register(new BaseValueProperty(node.value, node.id));
        });

        config.computeNodes?.forEach((node) => {
            const getter = this.buildExpressionGetter(node.expression);
            this.register(new ComputeValueProperty(getter, node.id));
            this.computeIds.add(node.id);
            this.trackDependencies(node.expression, node.id);
        });
    }

    /**
     * 添加修饰器并级联标记依赖为脏
     */
    addModifierAndRefresh(propId: string, modifier: IPropertyModifier<number>): void {
        this.getProperty(propId)?.addModifier(modifier);
        this.markDirty([propId]);
    }

    /**
     * 移除修饰器并级联标记依赖为脏
     */
    removeModifierAndRefresh(propId: string, modifier: IPropertyModifier<number>): void {
        this.getProperty(propId)?.removeModifier(modifier);
        this.markDirty([propId]);
    }

    /**
     * 标记属性为脏，级联刷新依赖它的计算属性
     */
    markDirty(attrIds?: string[]) {
        if (!attrIds || attrIds.length === 0) {
            this.computeIds.forEach((id) => {
                this.getProperty(id)?.makeDirty();
            });
            return;
        }

        const queue = [...attrIds];
        const visited = new Set<string>();

        while (queue.length > 0) {
            const current = queue.shift()!;
            if (visited.has(current)) continue;
            visited.add(current);

            this.getProperty(current)?.makeDirty();

            const dependents = this.dependencyGraph.get(current);
            if (dependents?.size) {
                dependents.forEach((dep) => queue.push(dep));
            }
        }
    }

    /** 将表达式 {{id}} 转为 manager.get('id')，并生成 getter 函数 */
    private buildExpressionGetter(expression: string): () => number {
        const body = expression.replace(/\{\{([^}]+)\}\}/g, (_match, id) => {
            return `manager.get('${id.trim()}')`;
        });
        const factory = new Function('manager', `return () => { return ${body}; };`);
        return factory(this);
    }

    private trackDependencies(expression: string, targetId: string) {
        const deps = this.extractPlaceholders(expression);
        deps.forEach((depId) => {
            if (!this.dependencyGraph.has(depId)) {
                this.dependencyGraph.set(depId, new Set());
            }
            this.dependencyGraph.get(depId)!.add(targetId);
        });
    }

    private extractPlaceholders(expression: string): string[] {
        const regex = /\{\{([^}]+)\}\}/g;
        const result: string[] = [];
        let match: RegExpExecArray | null;
        while ((match = regex.exec(expression)) !== null) {
            const id = match[1]?.trim();
            if (id) result.push(id);
        }
        return result;
    }
    /**
     * Modifier 工厂：EPropertyAddType → 对应修饰器实例，纯函数不修改状态
     */
    static createModifier(
        type: EPropertyAddType,
        value: number,
        maxValue?: number
    ): IPropertyModifier<number> | null {
        switch (type) {
            case EPropertyAddType.Add:
                return new PropertyAddModifier(value);
            case EPropertyAddType.Mul:
                // Mul 节点公式 (1 + MulBuff + MulOther)，value=0.5 表示 +50%
                return new PropertyAddModifier(value);
            case EPropertyAddType.Override:
                return new PropertyOverrideModifier(value);
            case EPropertyAddType.Clamp:
                return new PropertyClampModifier(value, maxValue ?? value);
            default:
                return null;
        }
    }

    /**
     * 向指定节点添加修饰器，返回 modifier 引用供子类记录（eid 由子类管理）
     */
    addByPropId(
        propId: string,
        type: EPropertyAddType,
        value: number,
        maxValue?: number
    ): IPropertyModifier<number> | null {
        const mod = GeneralPropertyMgr.createModifier(type, value, maxValue);
        if (!mod) return null;
        this.addModifierAndRefresh(propId, mod);
        return mod;
    }
}
