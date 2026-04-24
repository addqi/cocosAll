import type { UpgradeConfig, UpgradeEffect } from './types';

const VALID_RARITY     = new Set(['common', 'rare', 'epic', 'legendary']);
const VALID_CATEGORY   = new Set(['attr', 'proj', 'onhit', 'policy']);
const VALID_EFF_TYPE   = new Set(['buff', 'hit_effect', 'shoot_policy']);
const REQUIRED         = ['id', 'name', 'desc', 'tier', 'rarity', 'category', 'effects'] as const;

function fail(id: string, msg: string): never {
    throw new Error(`[UpgradeValidator] "${id}": ${msg}`);
}

function validateEffect(id: string, eff: any, idx: number): void {
    if (!eff || typeof eff !== 'object')
        fail(id, `effects[${idx}] 不是对象`);
    if (!VALID_EFF_TYPE.has(eff.type))
        fail(id, `effects[${idx}].type "${eff.type}" 非法，合法值: ${[...VALID_EFF_TYPE]}`);
    if (!eff.data || typeof eff.data !== 'object')
        fail(id, `effects[${idx}].data 缺失或不是对象`);

    if (eff.type === 'buff') {
        if (typeof eff.data.id !== 'number') fail(id, `buff effect 缺少数字 id`);
        if (!eff.data.effectClass)            fail(id, `buff effect 缺少 effectClass`);
    }
    if (eff.type === 'hit_effect') {
        if (!eff.data.id)          fail(id, `hit_effect 缺少 id`);
        if (!eff.data.effectClass) fail(id, `hit_effect 缺少 effectClass`);
    }
    if (eff.type === 'shoot_policy') {
        if (!eff.data.policyClass) fail(id, `shoot_policy 缺少 policyClass`);
    }
}

export function validateUpgrade(raw: any): UpgradeConfig {
    const id = raw?.id ?? '<unknown>';
    for (const f of REQUIRED) {
        if (!(f in raw)) fail(id, `缺少必填字段 "${f}"`);
    }
    if (typeof raw.id !== 'string')  fail(id, `id 必须是 string`);
    if (typeof raw.tier !== 'number') fail(id, `tier 必须是 number`);
    if (!VALID_RARITY.has(raw.rarity))
        fail(id, `rarity "${raw.rarity}" 非法，合法值: ${[...VALID_RARITY]}`);
    if (!VALID_CATEGORY.has(raw.category))
        fail(id, `category "${raw.category}" 非法，合法值: ${[...VALID_CATEGORY]}`);
    if (!Array.isArray(raw.effects) || raw.effects.length === 0)
        fail(id, `effects 必须是非空数组`);

    raw.effects.forEach((eff: any, i: number) => validateEffect(id, eff, i));

    if (raw.evolvesFrom !== undefined) {
        if (!Array.isArray(raw.evolvesFrom) || raw.evolvesFrom.length === 0)
            fail(id, `evolvesFrom 必须是非空字符串数组`);
        for (const dep of raw.evolvesFrom) {
            if (typeof dep !== 'string') fail(id, `evolvesFrom 中包含非字符串值`);
        }
    }
    if (raw.classIds !== undefined) {
        if (!Array.isArray(raw.classIds) || raw.classIds.length === 0)
            fail(id, `classIds 若提供则必须是非空字符串数组（省略即视为通用升级）`);
        for (const c of raw.classIds) {
            if (typeof c !== 'string') fail(id, `classIds 中包含非字符串值`);
        }
    }
    return raw as UpgradeConfig;
}

export function validateAll(rawArray: any[], source: string): UpgradeConfig[] {
    if (!Array.isArray(rawArray))
        throw new Error(`[UpgradeValidator] ${source}: 顶层必须是数组`);

    const ids = new Set<string>();
    const result: UpgradeConfig[] = [];

    for (const raw of rawArray) {
        const cfg = validateUpgrade(raw);
        if (ids.has(cfg.id))
            throw new Error(`[UpgradeValidator] ${source}: id "${cfg.id}" 重复`);
        ids.add(cfg.id);
        result.push(cfg);
    }
    return result;
}
