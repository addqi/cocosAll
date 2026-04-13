import { playerConfig } from '../player/config/playerConfig';
import type { IActiveSkill, SkillContext } from './SkillTypes';

/**
 * 技能系统 —— 管理主动技能列表、冷却 tick、栏位绑定
 *
 * 栏位规则：
 *   - 最多 maxSkillSlots 个槽（playerConfig.maxSkillSlots，默认 3）
 *   - equip 时自动分配最小空槽；也可指定 slot
 *   - tryUseBySlot(0/1/2, ctx) 对应 1/2/3 键
 */
export class SkillSystem {
    private _slots: (IActiveSkill | null)[];
    private _all = new Map<string, IActiveSkill>();

    constructor() {
        this._slots = new Array(playerConfig.maxSkillSlots).fill(null);
    }

    get maxSlots(): number { return this._slots.length; }

    /** 获取指定栏位技能（0-based） */
    getSlot(index: number): IActiveSkill | null {
        return this._slots[index] ?? null;
    }

    /** 获取技能所在栏位，未找到返回 -1 */
    slotOf(id: string): number {
        return this._slots.findIndex(s => s?.id === id);
    }

    /**
     * 装备技能到栏位
     * @param skill 技能实例
     * @param slot  指定栏位（不传则自动分配最小空槽）
     * @returns 实际分配的栏位索引，-1 表示栏位已满
     */
    equip(skill: IActiveSkill, slot?: number): number {
        if (this._all.has(skill.id)) {
            return this.slotOf(skill.id);
        }

        let idx = slot ?? -1;
        if (idx < 0 || idx >= this._slots.length || this._slots[idx] !== null) {
            idx = this._slots.indexOf(null);
        }
        if (idx < 0) return -1;

        this._slots[idx] = skill;
        this._all.set(skill.id, skill);
        return idx;
    }

    unequip(id: string, ctx: SkillContext): void {
        const skill = this._all.get(id);
        if (!skill) return;
        skill.dispose?.(ctx);
        const idx = this._slots.indexOf(skill);
        if (idx >= 0) this._slots[idx] = null;
        this._all.delete(id);
    }

    has(id: string): boolean {
        return this._all.has(id);
    }

    getSkill(id: string): IActiveSkill | null {
        return this._all.get(id) ?? null;
    }

    get allSkills(): IActiveSkill[] {
        return [...this._all.values()];
    }

    get count(): number {
        return this._all.size;
    }

    tick(dt: number): void {
        for (const skill of this._all.values()) {
            skill.tick(dt);
        }
    }

    /** 按技能 ID 释放 */
    tryUse(id: string, ctx: SkillContext): boolean {
        const skill = this._all.get(id);
        if (!skill?.canUse()) return false;
        skill.execute(ctx);
        return true;
    }

    /** 按栏位索引释放（0 = 1键, 1 = 2键, 2 = 3键） */
    tryUseBySlot(slotIndex: number, ctx: SkillContext): boolean {
        const skill = this._slots[slotIndex];
        if (!skill?.canUse()) return false;
        skill.execute(ctx);
        return true;
    }
}
