import type { IActiveSkill, SkillDef } from './SkillTypes';

type SkillCreator = (def: SkillDef) => IActiveSkill;

/**
 * 技能工厂 — 注册表模式。
 * skillClass 字符串 → 构造器，JSON 驱动创建技能实例。
 */
export class SkillFactory {
    private static _creators = new Map<string, SkillCreator>();

    static register(skillClass: string, creator: SkillCreator): void {
        if (this._creators.has(skillClass)) {
            throw new Error(`[SkillFactory] 重复注册 skillClass="${skillClass}"`);
        }
        this._creators.set(skillClass, creator);
    }

    static create(def: SkillDef): IActiveSkill {
        const creator = this._creators.get(def.skillClass);
        if (!creator) {
            throw new Error(`[SkillFactory] 未知 skillClass="${def.skillClass}"，已注册: [${this.registeredClasses().join(', ')}]`);
        }
        return creator(def);
    }

    static has(skillClass: string): boolean {
        return this._creators.has(skillClass);
    }

    static registeredClasses(): string[] {
        return [...this._creators.keys()];
    }
}
