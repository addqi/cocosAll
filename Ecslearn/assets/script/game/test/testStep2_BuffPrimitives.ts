import { TestRegistry } from './TestRegistry';
import { BuffFactory, BuffRuntimeInfo, EChangeType } from '../../baseSystem/buff';
import type { IBuffOwner, BuffData } from '../../baseSystem/buff';
import '../../game/skill/effects';

function mockOwner(maxHp = 100): IBuffOwner & { healed: number; damaged: number } {
    const propMgr = {
        getValue: () => maxHp,
        addModifier: () => 0,
        removeModifier: () => {},
    } as any;
    return { uid: 'test', getPropertyManager: () => propMgr, healed: 0, damaged: 0,
        heal(amt: number) { this.healed += amt; },
        damage(amt: number) { this.damaged += amt; },
    };
}

// ── Step 2.3 AttrModifierEffect ──

TestRegistry.register('[Step2.3][AttrModifierEffect.ts] 单属性 ADD', () => {
    const owner = mockOwner();
    const data: BuffData = { id: 99001, name: 'test', duration: 0, effectClass: 'AttrModifierEffect',
        targetAttr: 'Attack-Mul-Buff', valuePerStack: 0.5 };
    const rt = BuffFactory.createRuntime(data, owner);
    if (!rt.effect) throw new Error('effect 未创建');
    const changes = rt.effect.getChanges();
    if (changes.length !== 1) throw new Error(`应有 1 条 change, 实际: ${changes.length}`);
    if (changes[0].attrId !== 'Attack-Mul-Buff') throw new Error('attrId 错误');
    if (changes[0].type !== EChangeType.ADD) throw new Error('type 应为 ADD');
    if (changes[0].value !== 0.5) throw new Error(`value 应为 0.5, 实际: ${changes[0].value}`);
});

TestRegistry.register('[Step2.3][AttrModifierEffect.ts] 多属性 changes 数组', () => {
    const owner = mockOwner();
    const data: BuffData = { id: 99002, name: 'test', duration: 0, effectClass: 'AttrModifierEffect',
        changes: [
            { attrId: 'Attack-Mul-Buff', type: 'ADD', valuePerStack: 0.2 },
            { attrId: 'CritRate-Value-Buff', type: 'MUL', valuePerStack: 0.1 },
        ] };
    const rt = BuffFactory.createRuntime(data, owner);
    const changes = rt.effect!.getChanges();
    if (changes.length !== 2) throw new Error(`应有 2 条, 实际: ${changes.length}`);
    if (changes[1].type !== EChangeType.MUL) throw new Error('第二条应为 MUL');
});

// ── Step 2.3 PeriodicDamageEffect ──

TestRegistry.register('[Step2.3][PeriodicDamageEffect.ts] DOT onTick 扣血', () => {
    const owner = mockOwner();
    const data: BuffData = { id: 99003, name: 'dot', duration: 3, tickInterval: 1,
        effectClass: 'PeriodicDamageEffect', damagePerStack: 10 };
    const rt = BuffFactory.createRuntime(data, owner);
    rt.effect!.onTick!();
    if (owner.damaged !== 10) throw new Error(`应扣 10, 实际: ${owner.damaged}`);
});

// ── Step 2.3 PeriodicHealEffect ──

TestRegistry.register('[Step2.3][PeriodicHealEffect.ts] HOT onTick 按百分比回血', () => {
    const owner = mockOwner(200);
    const data: BuffData = { id: 99004, name: 'hot', duration: 5, tickInterval: 1,
        effectClass: 'PeriodicHealEffect', healPercent: 0.1 };
    const rt = BuffFactory.createRuntime(data, owner);
    rt.effect!.onTick!();
    if (owner.healed !== 20) throw new Error(`应回 20, 实际: ${owner.healed}`);
});

TestRegistry.register('[Step2.3][PeriodicHealEffect.ts] HOT 固定值回血', () => {
    const owner = mockOwner();
    const data: BuffData = { id: 99005, name: 'hot2', duration: 5, tickInterval: 1,
        effectClass: 'PeriodicHealEffect', healPerStack: 15 };
    const rt = BuffFactory.createRuntime(data, owner);
    rt.effect!.onTick!();
    if (owner.healed !== 15) throw new Error(`应回 15, 实际: ${owner.healed}`);
});
