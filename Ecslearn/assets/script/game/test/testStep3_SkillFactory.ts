import { TestRegistry } from './TestRegistry';
import { SkillFactory } from '../skill/SkillFactory';
import type { SkillDef } from '../skill/SkillTypes';
import { getSkillDef, allSkillIds, getSkillsByTag, getSkillsByClass } from '../config/skillConfig/SkillConfigLoader';
import '../skill';

// ── Step 3.2 SkillFactory 注册与创建 ──

TestRegistry.register('[Step3.2][SkillFactory.ts] 内置技能类已注册', () => {
    const classes = SkillFactory.registeredClasses();
    const required = ['ArrowStormSkill', 'DashShotSkill', 'SpawnProjectileSkill',
        'AreaDamageSkill', 'ApplySelfBuffSkill', 'DashAttackSkill', 'SummonSkill'];
    for (const c of required) {
        if (!classes.includes(c)) throw new Error(`缺少注册: ${c}, 已有: [${classes.join(', ')}]`);
    }
});

TestRegistry.register('[Step3.2][SkillFactory.ts] 合法 skillClass 创建成功', () => {
    const def: SkillDef = {
        id: 'test-projectile', name: '测试投射', skillClass: 'SpawnProjectileSkill',
        cooldown: 5, params: { projectileCount: 2 },
    };
    const skill = SkillFactory.create(def);
    if (!skill) throw new Error('创建失败');
    if (skill.id !== 'test-projectile') throw new Error(`id 不匹配: ${skill.id}`);
    if (skill.maxCooldown !== 5) throw new Error(`cooldown 不匹配: ${skill.maxCooldown}`);
});

TestRegistry.register('[Step3.2][SkillFactory.ts] 非法 skillClass 抛异常', () => {
    const def: SkillDef = {
        id: 'bad', name: 'bad', skillClass: 'NonExistent',
        cooldown: 1, params: {},
    };
    let threw = false;
    try { SkillFactory.create(def); } catch { threw = true; }
    if (!threw) throw new Error('应抛异常但未抛');
});

TestRegistry.register('[Step3.2][SkillFactory.ts] 同 skillClass 不同参数生成不同技能', () => {
    const defA: SkillDef = {
        id: 'proj-a', name: 'A', skillClass: 'SpawnProjectileSkill',
        cooldown: 3, params: { projectileCount: 1, speed: 200 },
    };
    const defB: SkillDef = {
        id: 'proj-b', name: 'B', skillClass: 'SpawnProjectileSkill',
        cooldown: 7, params: { projectileCount: 5, speed: 800 },
    };
    const a = SkillFactory.create(defA) as any;
    const b = SkillFactory.create(defB) as any;
    if (a.id === b.id) throw new Error('id 不应相同');
    if (a.projectileCount === b.projectileCount) throw new Error('参数应不同');
});

// ── Step 3.2 skills.json 配置加载 ──

TestRegistry.register('[Step3.2][skills.json] 技能定义可查询', () => {
    const ids = allSkillIds();
    if (ids.length < 5) throw new Error(`技能定义不足, 实际: ${ids.length}`);
});

TestRegistry.register('[Step3.2][skills.json] 按 id 查询 arrow-storm', () => {
    const def = getSkillDef('arrow-storm');
    if (!def) throw new Error('缺少 arrow-storm');
    if (def.skillClass !== 'SpawnProjectileSkill') throw new Error(`skillClass 错误: ${def.skillClass}`);
});

TestRegistry.register('[Step3.2][skills.json] 按 tag 查 archer 技能', () => {
    const archerSkills = getSkillsByTag('archer');
    if (archerSkills.length < 2) throw new Error(`archer 技能不足: ${archerSkills.length}`);
});

TestRegistry.register('[Step3.2][skills.json] 按 skillClass 查 ApplySelfBuffSkill', () => {
    const buffs = getSkillsByClass('ApplySelfBuffSkill');
    if (buffs.length < 2) throw new Error(`ApplySelfBuffSkill 技能不足: ${buffs.length}`);
});

TestRegistry.register('[Step3.2][skills.json] 从 JSON 创建 fireball', () => {
    const def = getSkillDef('fireball');
    if (!def) throw new Error('缺少 fireball');
    const skill = SkillFactory.create(def);
    if (skill.id !== 'fireball') throw new Error(`id 不匹配: ${skill.id}`);
    if (skill.name !== '烈焰弹') throw new Error(`name 不匹配: ${skill.name}`);
});
