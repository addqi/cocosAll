import { TestRegistry } from './TestRegistry';
import { HitEffectFactory } from '../../baseSystem/hitEffect';
import '../../game/hitEffects';

// ── Step 2.4 ApplyBuffOnHitEffect ──

TestRegistry.register('[Step2.4][ApplyBuffOnHitEffect.ts] 工厂可创建实例', () => {
    const inst = HitEffectFactory.create({
        id: 'test-apply-buff',
        effectClass: 'ApplyBuffOnHitEffect',
        buff: { id: 77001, name: 'test-buff', duration: 3, effectClass: 'PeriodicDamageEffect', damagePerStack: 5 },
    });
    if (!inst) throw new Error('创建失败');
    if (typeof inst.onHit !== 'function') throw new Error('缺少 onHit');
});

TestRegistry.register('[Step2.4][ApplyBuffOnHitEffect.ts] onHit 挂 Buff 到目标', () => {
    let addedBuff: any = null;
    const mockBuffMgr = { addBuff(data: any, _owner: any) { addedBuff = data; return {} as any; } } as any;
    const inst = HitEffectFactory.create({
        id: 'test-apply-buff-2',
        effectClass: 'ApplyBuffOnHitEffect',
        buff: { id: 77002, name: 'poison', duration: 4, effectClass: 'PeriodicDamageEffect', damagePerStack: 3 },
    })!;
    inst.onHit({
        targetBuffMgr: mockBuffMgr,
        targetBuffOwner: {} as any,
        baseDamage: 100,
    } as any);
    if (!addedBuff) throw new Error('未调用 addBuff');
    if (addedBuff.id !== 77002) throw new Error(`buff id 应为 77002, 实际: ${addedBuff.id}`);
});

TestRegistry.register('[Step2.4][ApplyBuffOnHitEffect.ts] scaleWithBaseDamage 缩放', () => {
    let addedBuff: any = null;
    const mockBuffMgr = { addBuff(data: any) { addedBuff = data; return {} as any; } } as any;
    const inst = HitEffectFactory.create({
        id: 'test-apply-buff-3',
        effectClass: 'ApplyBuffOnHitEffect',
        scaleWithBaseDamage: 0.5,
        buff: { id: 77003, name: 'scaled', duration: 5, tickInterval: 1, effectClass: 'PeriodicDamageEffect' },
    })!;
    inst.onHit({ targetBuffMgr: mockBuffMgr, targetBuffOwner: {} as any, baseDamage: 200 } as any);
    if (addedBuff.damagePerStack !== 100) throw new Error(`damagePerStack 应为 100, 实际: ${addedBuff.damagePerStack}`);
});
