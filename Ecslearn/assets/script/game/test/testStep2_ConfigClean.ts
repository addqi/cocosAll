import { TestRegistry } from './TestRegistry';
import { getBuffDef, getHitEffectDef, allBuffIds, allHitEffectIds } from '../config/buffConfig/BuffConfigLoader';
import { EntityBuffMgr, HitEffectMgr, AttributeChangeResolver } from '../combat/runtime';

// ── Step 2.2 combat runtime re-export ──

TestRegistry.register('[Step2.2][combat/runtime/index.ts] EntityBuffMgr re-export', () => {
    if (typeof EntityBuffMgr !== 'function') throw new Error('EntityBuffMgr 应为 class');
});

TestRegistry.register('[Step2.2][combat/runtime/index.ts] HitEffectMgr re-export', () => {
    if (typeof HitEffectMgr !== 'function') throw new Error('HitEffectMgr 应为 class');
});

TestRegistry.register('[Step2.2][combat/runtime/index.ts] AttributeChangeResolver re-export', () => {
    if (typeof AttributeChangeResolver !== 'function') throw new Error('AttributeChangeResolver 应为 class');
});

// ── Step 2.7 JSON 配置 ──

TestRegistry.register('[Step2.7][buffs.json] buff 定义可查询', () => {
    const ids = allBuffIds();
    if (ids.length < 3) throw new Error(`buff 定义数不足, 实际: ${ids.length}`);
    const atk = getBuffDef('buff.attack_30');
    if (!atk) throw new Error('缺少 buff.attack_30');
    if (atk.id !== 2201) throw new Error(`id 应为 2201, 实际: ${atk.id}`);
});

TestRegistry.register('[Step2.7][hitEffects.json] hitEffect 定义可查询', () => {
    const ids = allHitEffectIds();
    if (ids.length < 2) throw new Error(`hitEffect 定义数不足, 实际: ${ids.length}`);
    const burn = getHitEffectDef('hit.burn_on_hit');
    if (!burn) throw new Error('缺少 hit.burn_on_hit');
});

TestRegistry.register('[Step2.7][hitEffects.json] 中毒只加 JSON 即可', () => {
    const poison = getHitEffectDef('hit.poison_on_hit');
    if (!poison) throw new Error('缺少 hit.poison_on_hit — 新增 debuff 应只改 JSON');
});

TestRegistry.register('[Step2.7][buffs.json] 复用验证: 同一 buff 可被多次引用', () => {
    const b1 = getBuffDef('buff.attack_speed_20');
    const b2 = getBuffDef('buff.attack_speed_20');
    if (!b1 || !b2) throw new Error('buff 定义不存在');
    if (b1.id !== b2.id) throw new Error('同 ref 应返回相同 id');
});
