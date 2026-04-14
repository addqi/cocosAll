import { TestRegistry } from './TestRegistry';
import { UpgradeEffectRegistry } from '../upgrade/UpgradeEffectRegistry';
import { UpgradeManager } from '../upgrade/UpgradeManager';
import type { UpgradeConfig, UpgradeTarget } from '../upgrade/types';

function mockTarget(): UpgradeTarget & { buffs: any[]; hits: any[]; cmds: string[] } {
    const t: any = {
        buffs: [] as any[], hits: [] as any[], cmds: [] as string[],
        buffMgr: {
            addBuff(data: any) { t.buffs.push(data); return {} as any; },
            removeBuff(id: number) { t.buffs = t.buffs.filter((b: any) => b.id !== id); return true; },
        },
        buffOwner: { uid: 'test', getPropertyManager: () => ({} as any) },
        hitEffectMgr: {
            add(data: any) { t.hits.push(data); },
            remove(id: string) { t.hits = t.hits.filter((h: any) => h.id !== id); },
        },
        setShootPolicy: () => {},
        sendBehaviorCommand: (cmd: string, ...args: unknown[]) => { t.cmds.push(cmd); },
    };
    return t;
}

// ── Step 2.5 Registry ──

TestRegistry.register('[Step2.5][UpgradeEffectRegistry.ts] buff handler 已注册', () => {
    if (!UpgradeEffectRegistry.has('buff')) throw new Error('缺少 buff handler');
});

TestRegistry.register('[Step2.5][UpgradeEffectRegistry.ts] hit_effect handler 已注册', () => {
    if (!UpgradeEffectRegistry.has('hit_effect')) throw new Error('缺少 hit_effect handler');
});

TestRegistry.register('[Step2.5][UpgradeEffectRegistry.ts] behavior_command handler 已注册', () => {
    if (!UpgradeEffectRegistry.has('behavior_command')) throw new Error('缺少 behavior_command handler');
});

// ── Step 2.5 UpgradeManager apply/remove ──

TestRegistry.register('[Step2.5][UpgradeManager.ts] apply buff 升级', () => {
    const t = mockTarget();
    const mgr = new UpgradeManager(t);
    const cfg: UpgradeConfig = {
        id: 'test-buff-upg', name: '', desc: '', tier: 1, rarity: 'common', category: 'attr',
        effects: [{ type: 'buff', data: { id: 55001, name: 'test', duration: 0 } }],
    };
    mgr.apply(cfg);
    if (t.buffs.length !== 1) throw new Error(`应有 1 buff, 实际: ${t.buffs.length}`);
});

TestRegistry.register('[Step2.5][UpgradeManager.ts] remove buff 升级', () => {
    const t = mockTarget();
    const mgr = new UpgradeManager(t);
    const cfg: UpgradeConfig = {
        id: 'test-rm', name: '', desc: '', tier: 1, rarity: 'common', category: 'attr',
        effects: [{ type: 'buff', data: { id: 55002, name: 'test', duration: 0 } }],
    };
    mgr.apply(cfg);
    mgr.remove('test-rm');
    if (t.buffs.length !== 0) throw new Error('buff 应被移除');
});

TestRegistry.register('[Step2.5][UpgradeManager.ts] apply hit_effect 升级', () => {
    const t = mockTarget();
    const mgr = new UpgradeManager(t);
    const cfg: UpgradeConfig = {
        id: 'test-hit-upg', name: '', desc: '', tier: 1, rarity: 'common', category: 'onhit',
        effects: [{ type: 'hit_effect', data: { id: 'he-test', effectClass: 'KnockbackEffect' } }],
    };
    mgr.apply(cfg);
    if (t.hits.length !== 1) throw new Error(`应有 1 hit, 实际: ${t.hits.length}`);
});

// ── Step 2.6 behavior_command ──

TestRegistry.register('[Step2.6][UpgradeManager.ts] behavior_command 升级', () => {
    const t = mockTarget();
    const mgr = new UpgradeManager(t);
    const cfg: UpgradeConfig = {
        id: 'test-bcmd', name: '', desc: '', tier: 1, rarity: 'common', category: 'policy',
        effects: [{ type: 'behavior_command', data: { command: 'set_shoot_policy', args: ['auto'] } }],
    };
    mgr.apply(cfg);
    if (t.cmds.length !== 1) throw new Error('应调用 1 次 sendBehaviorCommand');
    if (t.cmds[0] !== 'set_shoot_policy') throw new Error(`命令应为 set_shoot_policy, 实际: ${t.cmds[0]}`);
});

// ── Step 2.5 进化检测 ──

TestRegistry.register('[Step2.5][UpgradeManager.ts] checkEvolution 正确', () => {
    const t = mockTarget();
    const mgr = new UpgradeManager(t);
    const base1: UpgradeConfig = { id: 'a', name: '', desc: '', tier: 1, rarity: 'common', category: 'attr', effects: [] };
    const base2: UpgradeConfig = { id: 'b', name: '', desc: '', tier: 1, rarity: 'common', category: 'attr', effects: [] };
    const evo: UpgradeConfig = { id: 'evo', name: '', desc: '', tier: 2, rarity: 'epic', category: 'attr', effects: [], evolvesFrom: ['a', 'b'] };
    mgr.apply(base1);
    const before = mgr.checkEvolution([evo]);
    if (before.length !== 0) throw new Error('前置未满不应解锁');
    mgr.apply(base2);
    const after = mgr.checkEvolution([evo]);
    if (after.length !== 1) throw new Error('前置已满应解锁');
});
