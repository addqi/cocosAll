import type { IComponent } from '../ecsbase';

/** 实体 - 组件的容器 */
export class Entity {
    private components: Map<string, IComponent> = new Map();

    /** 添加组件 */
    addComponent(component: IComponent) {
        this.components.set(component.constructor.name, component);
    }

    /** 获取组件 */
    getComponent<T extends IComponent>(cls: new (...args: any[]) => T): T | null {
        return (this.components.get(cls.name) as T) || null;
    }

    /** 是否拥有某组件 */
    hasComponent(cls: new (...args: any[]) => IComponent): boolean {
        return this.components.has(cls.name);
    }
}
