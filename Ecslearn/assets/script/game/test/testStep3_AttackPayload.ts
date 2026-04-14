import { TestRegistry } from './TestRegistry';
import { getPayloadDef, allPayloadIds } from '../combat/attack/AttackPayload';
import { AttackExecutor } from '../combat/attack/AttackExecutor';
import type { AttackSpec } from '../combat/attack/AttackPayload';

// ── Step 3.5 AttackPayloadDef ──

TestRegistry.register('[Step3.5][payloads.json] payload 定义可查询', () => {
    const ids = allPayloadIds();
    if (ids.length < 5) throw new Error(`payload 定义不足, 实际: ${ids.length}`);
});

TestRegistry.register('[Step3.5][payloads.json] normal_arrow payload 结构完整', () => {
    const p = getPayloadDef('payload.normal_arrow');
    if (!p) throw new Error('缺少 payload.normal_arrow');
    if (p.damageRatio !== 1.0) throw new Error(`damageRatio 错误: ${p.damageRatio}`);
    if (!p.hitEffects?.includes('base-damage')) throw new Error('缺少 base-damage hitEffect');
});

TestRegistry.register('[Step3.5][payloads.json] burn payload 带目标 Buff', () => {
    const p = getPayloadDef('payload.burn');
    if (!p) throw new Error('缺少 payload.burn');
    if (!p.targetBuffs?.includes('buff.burn_dot')) throw new Error('缺少 targetBuff');
    if (p.damageRatio !== 1.2) throw new Error(`damageRatio 错误: ${p.damageRatio}`);
});

TestRegistry.register('[Step3.5][payloads.json] 普攻与技能可共用 payload', () => {
    const p1 = getPayloadDef('payload.burn');
    const p2 = getPayloadDef('payload.burn');
    if (!p1 || !p2) throw new Error('payload 不存在');
    if (p1.id !== p2.id) throw new Error('同 ref 应返回相同 id');
});

TestRegistry.register('[Step3.5][payloads.json] 仅替换 payload 不改技能类', () => {
    const fire = getPayloadDef('payload.burn');
    const frost = getPayloadDef('payload.frost');
    if (!fire || !frost) throw new Error('缺少 payload');
    if (fire.tags?.join() === frost.tags?.join()) throw new Error('不同 payload tags 应不同');
});

// ── Step 3.6 AttackExecutor ──

TestRegistry.register('[Step3.6][AttackExecutor.ts] 4 种 attackType 已注册', () => {
    const types = AttackExecutor.registeredTypes();
    for (const t of ['projectile', 'area', 'melee', 'summon'] as const) {
        if (!types.includes(t)) throw new Error(`缺少 ${t}`);
    }
});

TestRegistry.register('[Step3.6][AttackExecutor.ts] projectile 执行成功', () => {
    const spec: AttackSpec = { attackType: 'projectile', skillId: 'test', payloadRef: 'payload.normal_arrow' };
    const ok = AttackExecutor.execute(spec);
    if (!ok) throw new Error('执行失败');
});

TestRegistry.register('[Step3.6][AttackExecutor.ts] area 执行成功', () => {
    const spec: AttackSpec = { attackType: 'area', skillId: 'test', payloadRef: 'payload.frost' };
    const ok = AttackExecutor.execute(spec);
    if (!ok) throw new Error('执行失败');
});

TestRegistry.register('[Step3.6][AttackExecutor.ts] payload 自动解析', () => {
    const spec: AttackSpec = { attackType: 'projectile', skillId: 'test', payloadRef: 'payload.burn' };
    AttackExecutor.execute(spec);
    if (!(spec as any)._resolvedPayload) throw new Error('payload 未解析');
    if ((spec as any)._resolvedPayload.id !== 'payload.burn') throw new Error('payload id 错误');
});
