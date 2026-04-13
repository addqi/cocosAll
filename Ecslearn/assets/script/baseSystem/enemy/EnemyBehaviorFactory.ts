import type { EnemyBehaviorBase } from './EnemyBehaviorBase';

export type EnemyBehaviorCtor = new () => EnemyBehaviorBase;

export class EnemyBehaviorFactory {
    private static _registry = new Map<string, EnemyBehaviorCtor>();

    static register(id: string, ctor: EnemyBehaviorCtor): void {
        this._registry.set(id, ctor);
    }

    static create<T extends EnemyBehaviorBase = EnemyBehaviorBase>(id: string): T {
        const ctor = this._registry.get(id);
        if (!ctor) throw new Error(`[EnemyBehaviorFactory] "${id}" 未注册`);
        return new ctor() as T;
    }

    static has(id: string): boolean {
        return this._registry.has(id);
    }
}
