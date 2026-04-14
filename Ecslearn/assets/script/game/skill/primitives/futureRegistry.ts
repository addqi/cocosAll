/**
 * 未来扩展原语注册表 — 预留类型，尚未实现。
 *
 * 新需求出现时优先往已有原语归类，无法归类时在此新增原语。
 *
 * ── 预留技能原语 ──
 * - ChannelSkill       持续引导（激光、吸血光束）
 * - OrbitalSkill       环绕飞行物（飞剑、球体护盾）
 * - TrapSkill          放置陷阱（地雷、捕兽夹）
 * - TransformSkill     变身（狼形态、暴走形态）
 *
 * ── 预留命中效果原语 ──
 * - SpawnAreaOnHitEffect         命中后生成范围场
 * - SpawnProjectileOnHitEffect   命中后触发二次投射
 * - BonusDamageOnConditionEffect 条件伤害加成
 * - HealOnHitEffect              命中回血
 * - ApplyStackOnHitEffect        命中叠层
 *
 * ── 预留 Buff 原语 ──
 * - ShieldEffect        护盾（吸收伤害）
 * - StateControlEffect  状态控制（眩晕/定身）
 * - StackTriggerEffect  满层触发效果
 * - AuraEmitterEffect   光环（周围友军增益）
 */

export const FUTURE_SKILL_CLASSES = [
    'ChannelSkill',
    'OrbitalSkill',
    'TrapSkill',
    'TransformSkill',
] as const;

export const FUTURE_HIT_EFFECTS = [
    'SpawnAreaOnHitEffect',
    'SpawnProjectileOnHitEffect',
    'BonusDamageOnConditionEffect',
    'HealOnHitEffect',
    'ApplyStackOnHitEffect',
] as const;

export const FUTURE_BUFF_EFFECTS = [
    'ShieldEffect',
    'StateControlEffect',
    'StackTriggerEffect',
    'AuraEmitterEffect',
] as const;

/**
 * 设计归类辅助 — 拿一个新需求描述，返回建议原语。
 */
export function classifySkill(description: string): string {
    const d = description.toLowerCase();
    if (d.includes('投射') || d.includes('火球') || d.includes('箭') || d.includes('飞刀'))
        return 'SpawnProjectileSkill';
    if (d.includes('范围') || d.includes('爆炸') || d.includes('冰环') || d.includes('雷'))
        return 'AreaDamageSkill';
    if (d.includes('buff') || d.includes('狂暴') || d.includes('护盾') || d.includes('加速'))
        return 'ApplySelfBuffSkill';
    if (d.includes('冲锋') || d.includes('闪') || d.includes('dash'))
        return 'DashAttackSkill';
    if (d.includes('召唤') || d.includes('summon'))
        return 'SummonSkill';
    if (d.includes('引导') || d.includes('channel'))
        return 'ChannelSkill (未实现)';
    if (d.includes('环绕') || d.includes('orbital'))
        return 'OrbitalSkill (未实现)';
    if (d.includes('陷阱') || d.includes('trap'))
        return 'TrapSkill (未实现)';
    return 'UNKNOWN — 需新增原语';
}
