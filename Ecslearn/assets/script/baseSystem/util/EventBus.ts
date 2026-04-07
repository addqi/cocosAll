/**
 * 事件总线 - ECS、Player、UI 之间通信
 */

type Listener = (...args: any[]) => void;

const listeners: Map<string, Set<Listener>> = new Map();

export function on(event: string, fn: Listener) {
    if (!listeners.has(event)) {
        listeners.set(event, new Set());
    }
    listeners.get(event)!.add(fn);
}

export function off(event: string, fn: Listener) {
    listeners.get(event)?.delete(fn);
}

export function emit(event: string, ...args: any[]) {
    listeners.get(event)?.forEach((fn) => fn(...args));
}
