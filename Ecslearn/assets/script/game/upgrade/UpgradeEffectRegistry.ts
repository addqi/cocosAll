import type { UpgradeEffectType } from './types';

export interface EffectApplyResult {
    buffIds?: number[];
    hitEffectIds?: string[];
}

export type EffectHandler = {
    apply(data: any, ctx: any): EffectApplyResult;
    remove(data: any, ctx: any, record: EffectApplyResult): void;
};

export class UpgradeEffectRegistry {
    private static _handlers = new Map<string, EffectHandler>();

    static register(type: UpgradeEffectType, handler: EffectHandler): void {
        if (this._handlers.has(type)) {
            throw new Error(`[UpgradeEffectRegistry] 重复注册 type="${type}"`);
        }
        this._handlers.set(type, handler);
    }

    static get(type: string): EffectHandler | undefined {
        return this._handlers.get(type);
    }

    static has(type: string): boolean {
        return this._handlers.has(type);
    }

    static registeredTypes(): string[] {
        return [...this._handlers.keys()];
    }
}
