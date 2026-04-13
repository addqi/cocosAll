import type { IActiveSkill, SkillContext } from './SkillTypes';

export class SkillSystem {
    private _skills = new Map<string, IActiveSkill>();

    equip(skill: IActiveSkill): void {
        this._skills.set(skill.id, skill);
    }

    unequip(id: string, ctx: SkillContext): void {
        const skill = this._skills.get(id);
        if (!skill) return;
        skill.dispose?.(ctx);
        this._skills.delete(id);
    }

    has(id: string): boolean {
        return this._skills.has(id);
    }

    getSkill(id: string): IActiveSkill | null {
        return this._skills.get(id) ?? null;
    }

    get allSkills(): IActiveSkill[] {
        return [...this._skills.values()];
    }

    get count(): number {
        return this._skills.size;
    }

    tick(dt: number): void {
        for (const skill of this._skills.values()) {
            skill.tick(dt);
        }
    }

    tryUse(id: string, ctx: SkillContext): boolean {
        const skill = this._skills.get(id);
        if (!skill?.canUse()) return false;
        skill.execute(ctx);
        return true;
    }
}
