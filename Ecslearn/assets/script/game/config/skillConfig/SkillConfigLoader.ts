import type { SkillDef } from '../../skill/SkillTypes';
import skillDefs from './skills.json';

const _skills = skillDefs as Record<string, SkillDef>;

export function getSkillDef(id: string): SkillDef | null {
    return _skills[id] ?? null;
}

export function allSkillIds(): string[] {
    return Object.keys(_skills);
}

export function getSkillsByTag(tag: string): SkillDef[] {
    return Object.values(_skills).filter(s => s.tags?.includes(tag));
}

export function getSkillsByClass(skillClass: string): SkillDef[] {
    return Object.values(_skills).filter(s => s.skillClass === skillClass);
}
