import { ProPertyMgr } from './ProPertyMgr';
import { AttributeConfig, ATTRIBUTE_CONFIGS } from './AttributeConfig';
import { BaseValueProperty, ComputeValueProperty } from './BaseValueProperty';

type DependencyGraph = Map<string, Set<string>>;

export class GeneralPropertyMgr extends ProPertyMgr {
    private dependencyGraph: DependencyGraph = new Map();
    private computeIds: Set<string> = new Set();
    private initialized = false;

    /**
     * 载入所有属性配置，自动完成注册。
     * 默认只执行一次，可通过 force=true 重新初始化。
     */
    public initializeFromConfigs(configs: AttributeConfig[] = ATTRIBUTE_CONFIGS, force = false) {
        if (this.initialized && !force) {
            return;
        }

        if (force) {
            this.dependencyGraph.clear();
            this.computeIds.clear();
        }

        configs.forEach(cfg => this.registerAttribute(cfg));
        this.initialized = true;
    }

    public registerAttribute(config: AttributeConfig) {
        config.valueNodes?.forEach(node => {
            this.register(new BaseValueProperty(node.value, node.id));
        });

        config.computeNodes?.forEach(node => {
            const getter = this.buildExpressionGetter(node.expression);
            this.register(new ComputeValueProperty(getter, node.id));
            this.computeIds.add(node.id);
            this.trackDependencies(node.expression, node.id);
        });
    }

    /**
     * 根据属性 ID 列表递归标记依赖的计算属性为 dirty。
     * 如果不传参数，将刷新所有计算属性。
     */
    public markDirty(attrIds?: string[]) {
        if (!attrIds || attrIds.length === 0) {
            this.computeIds.forEach(id => {
                this.getProperty(id)?.makeDirty();
            });
            return;
        }

        const queue = [...attrIds];
        const visited = new Set<string>();

        while (queue.length > 0) {
            const current = queue.shift()!;
            if (visited.has(current)) {
                continue;
            }
            visited.add(current);

            this.getProperty(current)?.makeDirty();

            const dependents = this.dependencyGraph.get(current);
            if (dependents && dependents.size > 0) {
                dependents.forEach(dep => queue.push(dep));
            }
        }
    }

    private buildExpressionGetter(expression: string): () => number {
        const body = expression.replace(/\{\{([^}]+)\}\}/g, (_match, id) => {
            return `manager.get('${id.trim()}')`;
        });

        const factory = new Function('manager', `return () => { return ${body}; };`);
        return factory(this);
    }

    private trackDependencies(expression: string, targetId: string) {
        const deps = this.extractPlaceholders(expression);
        deps.forEach(depId => {
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
            if (id) {
                result.push(id);
            }
        }

        return result;
    }
}

