import { TestRegistry } from './TestRegistry';
import type { SkillContext, IBehaviorCommandSink } from '../skill/SkillTypes';
import type { PlayerServices } from '../player/runtime/PlayerServices';
import { Vec3 } from 'cc';

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

function mockCtx(behavior?: IBehaviorCommandSink): SkillContext {
    return {
        playerProp: {} as any, playerCombat: {} as any,
        playerNode: { worldPosition: new Vec3(0, 0, 0) } as any,
        hitEffectMgr: {} as any, buffMgr: {} as any,
        buffOwner: { uid: 'test', getPropertyManager: () => ({} as any), heal: () => {} },
        mouseWorldPos: new Vec3(100, 100, 0),
        behavior: behavior ?? mockBehavior(),
        services: mockServices(),
    };
}

// ── Step 3.1 SkillContext 无弓箭手私货 ──

TestRegistry.register('[Step3.1][SkillTypes.ts] SkillContext 不含 currentShootPolicy', () => {
    const ctx = mockCtx();
    if ('currentShootPolicy' in ctx) throw new Error('SkillContext 仍包含 currentShootPolicy');
});

TestRegistry.register('[Step3.1][SkillTypes.ts] SkillContext 不含 setShootPolicy', () => {
    const ctx = mockCtx();
    if ('setShootPolicy' in ctx) throw new Error('SkillContext 仍包含 setShootPolicy');
});

TestRegistry.register('[Step3.1][SkillTypes.ts] SkillContext 包含 behavior', () => {
    const ctx = mockCtx();
    if (!ctx.behavior) throw new Error('缺少 behavior');
    if (typeof ctx.behavior.onBehaviorCommand !== 'function')
        throw new Error('behavior.onBehaviorCommand 应为 function');
});

TestRegistry.register('[Step3.1][SkillTypes.ts] SkillContext 包含 services', () => {
    const ctx = mockCtx();
    if (!ctx.services) throw new Error('缺少 services');
});

TestRegistry.register('[Step3.1][SkillTypes.ts] behavior 命令可正常分发', () => {
    const bh = mockBehavior();
    const ctx = mockCtx(bh);
    ctx.behavior.onBehaviorCommand('test_cmd', 1, 'arg2');
    if (bh.lastCmd !== 'test_cmd') throw new Error(`cmd 应为 test_cmd, 实际: ${bh.lastCmd}`);
    if (bh.lastArgs[0] !== 1) throw new Error('参数传递错误');
});

TestRegistry.register('[Step3.1][SkillTypes.ts] 战士/召唤师可复用相同 SkillContext', () => {
    const ctx1 = mockCtx();
    const ctx2 = mockCtx();
    const keys1 = Object.keys(ctx1).sort();
    const keys2 = Object.keys(ctx2).sort();
    if (keys1.join(',') !== keys2.join(','))
        throw new Error('两个 ctx 字段不一致');
});
