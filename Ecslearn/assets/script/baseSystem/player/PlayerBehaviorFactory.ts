import type { PlayerBehaviorBase } from './PlayerBehaviorBase';

export type PlayerBehaviorCtor = new () => PlayerBehaviorBase;

export class PlayerBehaviorFactory {
    private static _registry = new Map<string, PlayerBehaviorCtor>();

    static register(id: string, ctor: PlayerBehaviorCtor): void {
        if (this._registry.has(id)) {
            throw new Error(`[PlayerBehaviorFactory] "${id}" 已注册，不允许重复注册`);
        }
        this._registry.set(id, ctor);
    }

    static create<T extends PlayerBehaviorBase = PlayerBehaviorBase>(id: string): T {
        const ctor = this._registry.get(id);
        if (!ctor) throw new Error(`[PlayerBehaviorFactory] "${id}" 未注册`);
        return new ctor() as T;
    }

    static has(id: string): boolean {
        return this._registry.has(id);
    }

    static registeredIds(): string[] {
        return [...this._registry.keys()];
    }
}
