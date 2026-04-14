import { TestRegistry } from './TestRegistry';
import { SkillSystem } from '../skill/SkillSystem';
import { SkillFactory } from '../skill/SkillFactory';
import { getSkillDef } from '../config/skillConfig/SkillConfigLoader';
import { AttackExecutor } from '../combat/attack/AttackExecutor';
import { getPayloadDef, allPayloadIds } from '../combat/attack/AttackPayload';
import type { SkillContext, IBehaviorCommandSink } from '../skill/SkillTypes';
import type { PlayerServices } from '../player/runtime/PlayerServices';
import { Vec3 } from 'cc';
import { classifySkill } from '../skill/primitives/futureRegistry';
import '../skill';

function mockBehavior(): IBehaviorCommandSink & { cmds: { cmd: string; args: unknown[] }[] } {
    return {
        cmds: [],
        onBehaviorCommand(cmd: string, ...args: unknown[]) {
            this.cmds.push({ cmd, args });
        },
    };
}

function mockCtx(bh?: ReturnType<typeof mockBehavior>): SkillContext & { _bh: ReturnType<typeof mockBehavior> } {
    const behavior = bh ?? mockBehavior();
    return {
        playerProp: { getValue: () => 0 } as any, playerCombat: {} as any,
        playerNode: { worldPosition: new Vec3(0, 0, 0) } as any,
        hitEffectMgr: {} as any,
        buffMgr: { addBuff: () => {}, removeBuff: () => {} } as any,
        buffOwner: { uid: 'test', getPropertyManager: () => ({} as any), heal: () => {} },
        mouseWorldPos: new Vec3(100, 100, 0),
        behavior, services: { buffMgr: {} as any, hitEffectMgr: {} as any,
            upgradeMgr: {} as any, skillSystem: {} as any },
        _bh: behavior,
    };
}

// ── Step 3.10 全链路 ──

TestRegistry.register('[Step3.10] 从 JSON 装备技能 → SkillSystem', () => {
    const sys = new SkillSystem();
    const def = getSkillDef('fireball')!;
    const skill = SkillFactory.create(def);
    const slot = sys.equip(skill);
    if (slot < 0) throw new Error('装备失败');
    if (!sys.has('fireball')) throw new Error('技能未注册');
});

TestRegistry.register('[Step3.10] 技能 CD + tick', () => {
    const def = getSkillDef('fireball')!;
    const skill = SkillFactory.create(def);
    const ctx = mockCtx();
    skill.execute(ctx);
    if (skill.currentCd !== 6) throw new Error(`CD 应为 6, 实际: ${skill.currentCd}`);
    skill.tick(3);
    let cd = skill.currentCd;
    if (cd !== 3) throw new Error(`CD 应为 3, 实际: ${cd}`);
    skill.tick(4);
    cd = skill.currentCd;
    if (cd !== 0) throw new Error(`CD 应为 0, 实际: ${cd}`);
});

TestRegistry.register('[Step3.10] 技能释放产生 AttackSpec', () => {
    const def = getSkillDef('ice-ring')!;
    const skill = SkillFactory.create(def);
    const ctx = mockCtx();
    skill.execute(ctx);
    if (ctx._bh.cmds.length === 0) throw new Error('未收到命令');
    const spec = ctx._bh.cmds[0].args[0] as any;
    if (spec.attackType !== 'area') throw new Error(`attackType 错误: ${spec.attackType}`);
    if (spec.payloadRef !== 'payload.frost') throw new Error('payloadRef 错误');
});

TestRegistry.register('[Step3.10] AttackSpec → AttackExecutor 落地', () => {
    const spec = { attackType: 'projectile' as const, skillId: 'fireball', payloadRef: 'payload.burn' };
    const ok = AttackExecutor.execute(spec);
    if (!ok) throw new Error('执行失败');
    if (!(spec as any)._resolvedPayload) throw new Error('payload 未解析');
});

TestRegistry.register('[Step3.10] 同原语不同参数回归: projectile', () => {
    const arrow = SkillFactory.create(getSkillDef('arrow-storm')!);
    const fire = SkillFactory.create(getSkillDef('fireball')!);
    if (arrow.constructor !== fire.constructor) throw new Error('应为相同原语类');
    const ctx1 = mockCtx();
    const ctx2 = mockCtx();
    arrow.execute(ctx1);
    fire.execute(ctx2);
    const s1 = ctx1._bh.cmds[0].args[0] as any;
    const s2 = ctx2._bh.cmds[0].args[0] as any;
    if (s1.payloadRef === s2.payloadRef) throw new Error('payload 应不同');
});

TestRegistry.register('[Step3.10] payload 替换回归', () => {
    const burnPayload = getPayloadDef('payload.burn');
    const frostPayload = getPayloadDef('payload.frost');
    if (!burnPayload || !frostPayload) throw new Error('payload 缺失');
    if (burnPayload.id === frostPayload.id) throw new Error('id 应不同');
    if (burnPayload.targetBuffs?.[0] === frostPayload.targetBuffs?.[0])
        throw new Error('targetBuffs 应不同');
});

TestRegistry.register('[Step3.10] 技能卸下', () => {
    const sys = new SkillSystem();
    const def = getSkillDef('berserk')!;
    const skill = SkillFactory.create(def);
    sys.equip(skill);
    const ctx = mockCtx();
    sys.unequip('berserk', ctx);
    if (sys.has('berserk')) throw new Error('技能应已卸下');
});

TestRegistry.register('[Step3.10] maxSlots 限制', () => {
    const sys = new SkillSystem();
    const ids = ['fireball', 'ice-ring', 'berserk', 'shield'];
    let failed = false;
    for (const id of ids) {
        const def = getSkillDef(id)!;
        const skill = SkillFactory.create(def);
        const slot = sys.equip(skill);
        if (slot < 0) { failed = true; break; }
    }
    if (!failed) throw new Error('应超出栏位限制');
});

TestRegistry.register('[Step3.10] 未来技能归类: 火球 → SpawnProjectileSkill', () => {
    const cls = classifySkill('投射火球');
    if (cls !== 'SpawnProjectileSkill') throw new Error(`归类错误: ${cls}`);
});

TestRegistry.register('[Step3.10] 未来技能归类: 召唤狼 → SummonSkill', () => {
    const cls = classifySkill('召唤战狼');
    if (cls !== 'SummonSkill') throw new Error(`归类错误: ${cls}`);
});

TestRegistry.register('[Step3.10] 未来技能归类: 冰环 → AreaDamageSkill', () => {
    const cls = classifySkill('范围冰环');
    if (cls !== 'AreaDamageSkill') throw new Error(`归类错误: ${cls}`);
});

TestRegistry.register('[Step3.10] combat 目录新增不散落', () => {
    const payloadIds = allPayloadIds();
    if (payloadIds.length < 5) throw new Error('payload 应在 combat/attack 统一管理');
    if (!AttackExecutor.has('projectile')) throw new Error('executor 应在 combat/attack 统一管理');
});
