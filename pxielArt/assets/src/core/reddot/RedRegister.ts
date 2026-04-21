import { IRed } from './IRed';

type RedCtor = new () => IRed;

const RED_REGISTRY = new Map<string, RedCtor>();

const RED_FACTORY = new Map<string, RedFactory>();
type RedFactory = () => IRed;
/**
 * 注册红点类
 * @param key 
 * @returns 
 */
export function regRed(key: string) {
    return function <T extends RedCtor>(ctor: T): T {
        if (RED_REGISTRY.has(key)) {
            console.warn(`[RedDot] duplicate key '${key}', overriding.`);
        }
        RED_REGISTRY.set(key, ctor);
        return ctor;
    };
}
export function regRedFactory(key: string, factory: RedFactory): void {
    if (RED_FACTORY.has(key) || RED_REGISTRY.has(key)) {
        console.warn(`[RedDot] duplicate key '${key}', overriding.`);
    }
    RED_FACTORY.set(key, factory);
}
/**
 * 按 key 查找类
 * @param key 
 * @returns 
 */
export function getRed(key: string): (new () => IRed) | null {
    const factory = RED_FACTORY.get(key);
    if (factory) {
        return class { constructor() { return factory(); } } as any;
    }
    return RED_REGISTRY.get(key) ?? null;
}

export function listReds(): string[] {
    return Array.from(RED_REGISTRY.keys());
}

export function listRedFactories(): string[] {
    return Array.from(RED_FACTORY.keys());
}