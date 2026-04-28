import type { IComponent } from '../ecsbase';

/**
 * 实体 - 组件的容器
 *
 * Linus 式设计：用类构造器引用本身做 key（不用 `.name` 字符串）。
 *
 * 原因：打包发布时 Cocos 构建链会做代码混淆，多个类的 `.name` 可能被压缩成相同短名
 *      （`"t"` / `"r"` 等），用 `constructor.name` 做 key 会导致**第二次 addComponent
 *      静默覆盖第一次**，进而 `getComponent(SomeComp)` 拿到的是别的类型实例 →
 *      访问字段时 undefined 报错。
 *
 *      用类引用做 key，混淆后类引用对象本身仍然唯一（同一引用 ===），Map 用引用判等，
 *      永远正确。
 */
export class Entity {
    private components = new Map<Function, IComponent>();

    /** 添加组件 */
    addComponent(component: IComponent) {
        this.components.set(component.constructor as Function, component);
    }

    /** 移除组件 */
    removeComponent(cls: new (...args: any[]) => IComponent): void {
        this.components.delete(cls);
    }

    /** 获取组件 */
    getComponent<T extends IComponent>(cls: new (...args: any[]) => T): T | null {
        return (this.components.get(cls) as T) || null;
    }

    /** 是否拥有某组件 */
    hasComponent(cls: new (...args: any[]) => IComponent): boolean {
        return this.components.has(cls);
    }
}
