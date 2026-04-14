import type { AttackSpec, AttackType } from './AttackPayload';
import { getPayloadDef } from './AttackPayload';

type ExecuteHandler = (spec: AttackSpec) => boolean;

/**
 * 统一攻击执行器 — 注册表模式。
 *
 * 技能只生产 AttackSpec，执行器负责实际落地：
 * - projectile → ProjectileSpawner
 * - area       → AreaExecutor
 * - melee      → MeleeExecutor
 * - summon     → SummonExecutor
 *
 * 当前阶段注册桩实现，后续可逐步替换为真实执行器。
 */
export class AttackExecutor {
    private static _handlers = new Map<AttackType, ExecuteHandler>();

    static register(type: AttackType, handler: ExecuteHandler): void {
        this._handlers.set(type, handler);
    }

    static execute(spec: AttackSpec): boolean {
        const payload = getPayloadDef(spec.payloadRef);
        if (payload) {
            (spec as any)._resolvedPayload = payload;
        }

        const handler = this._handlers.get(spec.attackType);
        if (!handler) {
            console.warn(`[AttackExecutor] 未注册 attackType="${spec.attackType}"`);
            return false;
        }
        return handler(spec);
    }

    static has(type: AttackType): boolean {
        return this._handlers.has(type);
    }

    static registeredTypes(): AttackType[] {
        return [...this._handlers.keys()];
    }
}

AttackExecutor.register('projectile', (spec) => {
    console.log(`[AttackExecutor] projectile: skill=${spec.skillId}, payload=${spec.payloadRef}`);
    return true;
});

AttackExecutor.register('area', (spec) => {
    console.log(`[AttackExecutor] area: skill=${spec.skillId}, payload=${spec.payloadRef}`);
    return true;
});

AttackExecutor.register('melee', (spec) => {
    console.log(`[AttackExecutor] melee: skill=${spec.skillId}, payload=${spec.payloadRef}`);
    return true;
});

AttackExecutor.register('summon', (spec) => {
    console.log(`[AttackExecutor] summon: skill=${spec.skillId}`);
    return true;
});
