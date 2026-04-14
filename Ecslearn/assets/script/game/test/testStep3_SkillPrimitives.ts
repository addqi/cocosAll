import { TestRegistry } from './TestRegistry';
import { SkillFactory } from '../skill/SkillFactory';
import type { SkillDef, SkillContext, IBehaviorCommandSink } from '../skill/SkillTypes';
import type { PlayerServices } from '../player/runtime/PlayerServices';
import { SpawnProjectileSkill } from '../skill/primitives/SpawnProjectileSkill';
import { AreaDamageSkill } from '../skill/primitives/AreaDamageSkill';
import { ApplySelfBuffSkill } from '../skill/primitives/ApplySelfBuffSkill';
import { DashAttackSkill } from '../skill/primitives/DashAttackSkill';
import { SummonSkill } from '../skill/primitives/SummonSkill';
import { Vec3 } from 'cc';
import '../skill';

function mockBehavior(): IBehaviorCommandSink & { lastCmd: string; lastArgs: unknown[] } {
    return {
        lastCmd: '', lastArgs: [],
        onBehaviorCommand(cmd: string, ...args: unknown[]) {
            this.lastCmd = cmd;
            this.lastArgs = args;
        },
    };
}

function mockServices(): PlayerServices {
    return { buffMgr: {} as any, hitEffectMgr: {} as any, upgradeMgr: {} as any, skillSystem: {} as any };
}

function mockCtx(bh?: ReturnType<typeof mockBehavior>): SkillContext & { _bh: ReturnType<typeof mockBehavior> } {
    const behavior = bh ?? mockBehavior();
    return {
        playerProp: {} as any, playerCombat: {} as any,
        playerNode: { worldPosition: new Vec3(0, 0, 0) } as any,
        hitEffectMgr: {} as any,
        buffMgr: { addBuff: () => {}, removeBuff: () => {} } as any,
        buffOwner: { uid: 'test', getPropertyManager: () => ({} as any), heal: () => {} },
        mouseWorldPos: new Vec3(100, 100, 0),
        behavior, services: mockServices(),
        _bh: behavior,
    };
}

// ── SpawnProjectileSkill ──

TestRegistry.register('[Step3.3][SpawnProjectileSkill] 创建并执行', () => {
    const def: SkillDef = { id: 'sp-test', name: 'test', skillClass: 'SpawnProjectileSkill',
        cooldown: 5, params: { projectileCount: 3 }, payloadRef: 'payload.normal_arrow' };
    const skill = new SpawnProjectileSkill(def);
    if (skill.projectileCount !== 3) throw new Error('projectileCount 错误');
    const ctx = mockCtx();
    skill.execute(ctx);
    if (skill.currentCd !== 5) throw new Error('CD 未设置');
    if (ctx._bh.lastCmd !== 'execute_attack') throw new Error(`cmd 错误: ${ctx._bh.lastCmd}`);
    const spec = ctx._bh.lastArgs[0] as any;
    if (spec.attackType !== 'projectile') throw new Error(`attackType 错误: ${spec.attackType}`);
    if (spec.payloadRef !== 'payload.normal_arrow') throw new Error('payloadRef 错误');
});

TestRegistry.register('[Step3.3][SpawnProjectileSkill] 箭雨与火球共享原语', () => {
    const arrowDef: SkillDef = { id: 'arrow', name: 'A', skillClass: 'SpawnProjectileSkill',
        cooldown: 8, params: { projectileCount: 10, scatter: 200 }, payloadRef: 'payload.arrow_storm' };
    const fireDef: SkillDef = { id: 'fire', name: 'F', skillClass: 'SpawnProjectileSkill',
        cooldown: 6, params: { projectileCount: 1, speed: 600 }, payloadRef: 'payload.burn' };
    const a = SkillFactory.create(arrowDef);
    const f = SkillFactory.create(fireDef);
    if (a.constructor !== f.constructor) throw new Error('应为相同类');
    if (a.id === f.id) throw new Error('id 应不同');
});

// ── AreaDamageSkill ──

TestRegistry.register('[Step3.3][AreaDamageSkill] 创建并执行', () => {
    const def: SkillDef = { id: 'area-test', name: 'area', skillClass: 'AreaDamageSkill',
        cooldown: 10, params: { radius: 200, damageRatio: 1.5, centered: true }, payloadRef: 'payload.frost' };
    const skill = new AreaDamageSkill(def);
    if (skill.radius !== 200) throw new Error('radius 错误');
    const ctx = mockCtx();
    skill.execute(ctx);
    const spec = ctx._bh.lastArgs[0] as any;
    if (spec.attackType !== 'area') throw new Error(`attackType 错误: ${spec.attackType}`);
    if (spec.radius !== 200) throw new Error('spec.radius 错误');
});

// ── ApplySelfBuffSkill ──

TestRegistry.register('[Step3.3][ApplySelfBuffSkill] 加 Buff + behavior 命令', () => {
    const def: SkillDef = { id: 'selfbuff', name: 'buff', skillClass: 'ApplySelfBuffSkill',
        cooldown: 10, params: {
            duration: 5, buffId: 9001, buffName: 'test',
            effectClass: 'AttrModifierEffect', targetAttr: 'Attack-Mul-Buff', valuePerStack: 0.5,
            behaviorCmd: 'set_shoot_policy_class', behaviorArgs: ['AutoShoot', 3],
            endBehaviorCmd: 'set_shoot_policy_class', endBehaviorArgs: ['HoldToShoot'],
        } };
    const skill = new ApplySelfBuffSkill(def);
    let buffAdded = false;
    const ctx = mockCtx();
    (ctx as any).buffMgr = { addBuff: () => { buffAdded = true; }, removeBuff: () => {} };
    skill.execute(ctx);
    if (!buffAdded) throw new Error('Buff 未添加');
    if (ctx._bh.lastCmd !== 'set_shoot_policy_class') throw new Error(`cmd 错误: ${ctx._bh.lastCmd}`);
});

TestRegistry.register('[Step3.3][ApplySelfBuffSkill] 狂暴与护盾共享原语', () => {
    const berserk: SkillDef = { id: 'berserk', name: '狂暴', skillClass: 'ApplySelfBuffSkill',
        cooldown: 15, params: { duration: 8, buffId: 9010, effectClass: 'AttrModifierEffect',
            targetAttr: 'Attack-Mul-Buff', valuePerStack: 0.5 } };
    const shield: SkillDef = { id: 'shield', name: '护盾', skillClass: 'ApplySelfBuffSkill',
        cooldown: 20, params: { duration: 10, buffId: 9011, effectClass: 'AttrModifierEffect',
            targetAttr: 'Defense-Value-Buff', valuePerStack: 50 } };
    const a = SkillFactory.create(berserk);
    const b = SkillFactory.create(shield);
    if (a.constructor !== b.constructor) throw new Error('应为相同类');
});

// ── DashAttackSkill ──

TestRegistry.register('[Step3.3][DashAttackSkill] 创建并执行', () => {
    const def: SkillDef = { id: 'dash', name: 'dash', skillClass: 'DashAttackSkill',
        cooldown: 8, params: { dashDistance: 300, dashDuration: 0.3, damageRatio: 2.0 },
        payloadRef: 'payload.melee_base' };
    const skill = new DashAttackSkill(def);
    const ctx = mockCtx();
    skill.execute(ctx);
    const spec = ctx._bh.lastArgs[0] as any;
    if (spec.attackType !== 'melee') throw new Error(`attackType 错误: ${spec.attackType}`);
    if (spec.dashDistance !== 300) throw new Error('dashDistance 错误');
});

// ── SummonSkill ──

TestRegistry.register('[Step3.3][SummonSkill] 创建并执行', () => {
    const def: SkillDef = { id: 'wolf', name: '召唤狼', skillClass: 'SummonSkill',
        cooldown: 25, params: { summonId: 'wolf', maxCount: 2, duration: 30, summonHp: 200, summonAtk: 15 } };
    const skill = new SummonSkill(def);
    if (skill.summonId !== 'wolf') throw new Error('summonId 错误');
    const ctx = mockCtx();
    skill.execute(ctx);
    const spec = ctx._bh.lastArgs[0] as any;
    if (spec.attackType !== 'summon') throw new Error(`attackType 错误: ${spec.attackType}`);
    if (spec.summonId !== 'wolf') throw new Error('spec.summonId 错误');
});

TestRegistry.register('[Step3.3][SummonSkill] 召唤狼与炮台共享原语', () => {
    const wolfDef: SkillDef = { id: 'wolf', name: '狼', skillClass: 'SummonSkill',
        cooldown: 25, params: { summonId: 'wolf', maxCount: 2, duration: 30 } };
    const turretDef: SkillDef = { id: 'turret', name: '炮台', skillClass: 'SummonSkill',
        cooldown: 20, params: { summonId: 'turret', maxCount: 1, duration: 20 } };
    const a = SkillFactory.create(wolfDef);
    const b = SkillFactory.create(turretDef);
    if (a.constructor !== b.constructor) throw new Error('应为相同类');
    if (a.id === b.id) throw new Error('id 应不同');
});
