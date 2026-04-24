import classDefsRaw from './classes.json';
import { getSkillDef } from '../skillConfig/SkillConfigLoader';
import { getBuffDef } from '../buffConfig/BuffConfigLoader';

/**
 * 流派射击模式定义：
 * - hold:   长按持续射击（默认）
 * - click:  点击单发
 * - charge: 按下蓄力 / 抬起发射（蓄力流专用）
 */
export type ShootModeType = 'hold' | 'click' | 'charge';

export interface ShootModeHold {
    readonly type: 'hold';
}

export interface ShootModeClick {
    readonly type: 'click';
}

export interface ShootModeCharge {
    readonly type: 'charge';
    /** 达到最大伤害所需蓄力秒数；超过此时长不再增益 */
    readonly maxChargeSec: number;
    /** 满蓄力时的伤害倍率（基础 1.0，推荐 2.0 = +100%）*/
    readonly maxDamageRatio: number;
    /** 蓄力中的移速衰减（1.0 = 不衰减；0.5 = 半速；0 = 完全静止）*/
    readonly moveSpeedRatio: number;
}

export type ShootModeDef = ShootModeHold | ShootModeClick | ShootModeCharge;

export interface PlayerClassSkillSlot {
    readonly skillId: string;
    readonly slot?: number;
}

export interface PlayerClassPassiveBuff {
    readonly buffKey: string;
}

export interface PlayerClassDef {
    readonly id: string;
    readonly name: string;
    readonly desc: string;
    readonly shoot: ShootModeDef;
    readonly startSkills: readonly PlayerClassSkillSlot[];
    readonly passiveBuffs: readonly PlayerClassPassiveBuff[];
}

const VALID_SHOOT_TYPES = new Set<ShootModeType>(['hold', 'click', 'charge']);

function fail(classId: string, msg: string): never {
    throw new Error(`[ClassConfigLoader] "${classId}": ${msg}`);
}

function validateShoot(classId: string, shoot: any): ShootModeDef {
    if (!shoot || typeof shoot !== 'object') fail(classId, `shoot 缺失或非对象`);
    if (!VALID_SHOOT_TYPES.has(shoot.type))
        fail(classId, `shoot.type "${shoot.type}" 非法，合法值: ${[...VALID_SHOOT_TYPES]}`);

    if (shoot.type === 'charge') {
        const nums: Array<[string, number]> = [
            ['maxChargeSec',   shoot.maxChargeSec],
            ['maxDamageRatio', shoot.maxDamageRatio],
            ['moveSpeedRatio', shoot.moveSpeedRatio],
        ];
        for (const [name, v] of nums) {
            if (typeof v !== 'number' || v <= 0 || !isFinite(v))
                fail(classId, `shoot.${name} 必须是正数（当前: ${v}）`);
        }
        if (shoot.maxDamageRatio < 1)
            fail(classId, `shoot.maxDamageRatio 应 ≥ 1（当前: ${shoot.maxDamageRatio}）`);
    }
    return shoot as ShootModeDef;
}

function validateOne(raw: any): PlayerClassDef {
    const id = raw?.id ?? '<unknown>';
    for (const f of ['id', 'name', 'desc', 'shoot', 'startSkills', 'passiveBuffs']) {
        if (!(f in raw)) fail(id, `缺少必填字段 "${f}"`);
    }
    if (typeof raw.id !== 'string') fail(id, `id 必须是 string`);

    validateShoot(id, raw.shoot);

    if (!Array.isArray(raw.startSkills)) fail(id, `startSkills 必须是数组`);
    for (let i = 0; i < raw.startSkills.length; i++) {
        const s = raw.startSkills[i];
        if (!s || typeof s.skillId !== 'string')
            fail(id, `startSkills[${i}].skillId 必须是 string`);
        if (!getSkillDef(s.skillId))
            fail(id, `startSkills[${i}].skillId "${s.skillId}" 在 skills.json 未找到`);
        if (s.slot !== undefined && (typeof s.slot !== 'number' || s.slot < 0))
            fail(id, `startSkills[${i}].slot 必须是非负整数`);
    }

    if (!Array.isArray(raw.passiveBuffs)) fail(id, `passiveBuffs 必须是数组`);
    for (let i = 0; i < raw.passiveBuffs.length; i++) {
        const p = raw.passiveBuffs[i];
        if (!p || typeof p.buffKey !== 'string')
            fail(id, `passiveBuffs[${i}].buffKey 必须是 string`);
        if (!getBuffDef(p.buffKey))
            fail(id, `passiveBuffs[${i}].buffKey "${p.buffKey}" 在 buffs.json 未找到`);
    }

    return raw as PlayerClassDef;
}

const _rawMap = classDefsRaw as Record<string, any>;
const _classes = new Map<string, PlayerClassDef>();
for (const key of Object.keys(_rawMap)) {
    const def = validateOne(_rawMap[key]);
    if (def.id !== key)
        throw new Error(`[ClassConfigLoader] key "${key}" 与 def.id "${def.id}" 不一致`);
    _classes.set(def.id, def);
}

export function getPlayerClassDef(id: string): PlayerClassDef | null {
    return _classes.get(id) ?? null;
}

export function allPlayerClassDefs(): readonly PlayerClassDef[] {
    return Array.from(_classes.values());
}

export function allPlayerClassIds(): readonly string[] {
    return Array.from(_classes.keys());
}
