import { SkillFactory } from './SkillFactory';
import { ArrowStormSkill } from './ArrowStormSkill';
import { DashShotSkill } from './DashShotSkill';
import type { SkillDef } from './SkillTypes';

SkillFactory.register('ArrowStormSkill', (def: SkillDef) => {
    const p = def.params as Record<string, any>;
    return new ArrowStormSkill({
        cooldown:        def.cooldown,
        arrowMultiplier: p.arrowMultiplier,
        skyHeight:       p.skyHeight,
        scatter:         p.scatter,
    });
});

SkillFactory.register('DashShotSkill', (def: SkillDef) => {
    const p = def.params as Record<string, any>;
    return new DashShotSkill({
        cooldown:     def.cooldown,
        duration:     p.duration,
        atkSpeedBoost: p.atkSpeedBoost ?? p.valuePerStack,
    });
});
