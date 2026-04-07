import type { IProperty } from './IProperty';

/**
 * 属性管理器：存储、查找、获取属性
 */
export class PropertyManager {
    private properties = new Map<string, IProperty<number>>();

    /** 注册属性 */
    register(prop: IProperty<number>) {
        this.properties.set(prop.propertyId, prop);
    }

    /** 获取属性最终值 */
    get(id: string): number {
        const p = this.properties.get(id);
        return p ? p.getValue() : 0;
    }

    /** 获取属性对象（用于添加 Modifier） */
    getProperty(id: string): IProperty<number> | undefined {
        return this.properties.get(id);
    }

    /** 是否有该属性 */
    has(id: string): boolean {
        return this.properties.has(id);
    }

    /** 清除所有属性 */
    clear() {
        this.properties.clear();
    }
}
