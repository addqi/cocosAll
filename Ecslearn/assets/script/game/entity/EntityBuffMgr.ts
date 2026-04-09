import { BuffFactory, BuffRuntimeInfo } from '../../baseSystem/buff';
import type { BuffData, IBuffOwner } from '../../baseSystem/buff';
import { AttributeChangeResolver } from './AttributeChangeResolver';
import type { EntityPropertyMgr, ModifierHandle } from './EntityPropertyMgr';

/** 单条 Buff 的完整运行时记录 */
interface BuffRecord {
    /** Buff 运行时实例（含 data / owner / effect / stack / remainTime） */
    runtime: BuffRuntimeInfo;
    /** 此 Buff 应用的 Modifier 句柄列表，移除时用于回退 */
    handles: ModifierHandle[];
}

/**
 * 公共实体 Buff 管理器
 *
 * 职责：
 * 1. addBuff    — 创建运行时、应用 Modifier、触发 onAdd（支持叠加）
 * 2. removeBuff — 回退 Modifier、触发 onRemove
 * 3. update     — 每帧推进计时：tick 触发 / 持续时间递减 / 过期自动移除
 * 4. removeAll  — 场景切换或实体死亡时清理所有 Buff
 *
 * 使用方式：
 *   const buffMgr = new EntityBuffMgr(this.propMgr);
 *   buffMgr.addBuff(speedBuffData, this);  // this 实现 IBuffOwner
 *   buffMgr.update(dt);                    // 在组件 update 中调用
 */
export class EntityBuffMgr {
    /** buffId → BuffRecord，每个 buffId 最多一条（叠加层数通过 stack 管理） */
    private activeBuffs = new Map<number, BuffRecord>();

    /**
     * @param propMgr 挂载实体的属性管理器，Resolver 用此应用 Modifier
     */
    constructor(private propMgr: EntityPropertyMgr) {}

    /**
     * 添加 Buff
     * - 若同 ID Buff 已存在：尝试叠加层数（受 maxStack 限制），刷新持续时间
     * - 若不存在：创建运行时，应用 Modifier，触发 onAdd
     *
     * @param data  Buff 静态配置（来自 JSON / 表格）
     * @param owner 挂载目标，实现 IBuffOwner（通常就是调用方 this）
     * @returns     运行时实例
     */
    addBuff(data: BuffData, owner: IBuffOwner): BuffRuntimeInfo {
        const existing = this.activeBuffs.get(data.id);
        if (existing) {
            existing.runtime.addStack();
            existing.runtime.tickTimer = existing.runtime.data.tickInterval ?? 0;
            existing.runtime.effect?.onStack?.(
                existing.runtime.stack,
                existing.runtime.data.maxStack ?? 1
            );
            AttributeChangeResolver.revert(existing.handles, this.propMgr);
            existing.handles = existing.runtime.effect
            ? AttributeChangeResolver.apply(existing.runtime.effect.getChanges(), this.propMgr)
            : [];
            return existing.runtime;
        }

        const runtime = BuffFactory.createRuntime(data, owner);
        const handles = runtime.effect
            ? AttributeChangeResolver.apply(runtime.effect.getChanges(), this.propMgr)
            : [];

        runtime.effect?.onAdd?.();
        this.activeBuffs.set(data.id, { runtime, handles });
        return runtime;
    }

    /**
     * 移除 Buff（立即移除，不等过期）
     * @param buffId  BuffData.id
     * @returns       是否找到并移除
     */
    removeBuff(buffId: number): boolean {
        const record = this.activeBuffs.get(buffId);
        if (!record) return false;

        record.runtime.effect?.onRemove?.();
        AttributeChangeResolver.revert(record.handles, this.propMgr);
        this.activeBuffs.delete(buffId);
        return true;
    }

    /**
     * 查询 Buff 是否存在
     */
    hasBuff(buffId: number): boolean {
        return this.activeBuffs.has(buffId);
    }

    /**
     * 获取运行时实例（用于读取当前层数、剩余时间等）
     */
    getRuntime(buffId: number): BuffRuntimeInfo | undefined {
        return this.activeBuffs.get(buffId)?.runtime;
    }

    /**
     * 每帧更新，需在组件 update(dt) 中调用
     * - 推进 tick 计时，到达 tickInterval 则触发 onTick 并重置
     * - 推进持续时间倒计时，过期则自动移除
     *
     * @param dt 帧间隔（秒）
     */
    update(dt: number): void {
        const toRemove: number[] = [];

        this.activeBuffs.forEach((record, buffId) => {
            const { runtime } = record;

            // Tick 推进（DOT / HoT 等周期效果）
            if (runtime.data.tickInterval && runtime.data.tickInterval > 0) {
                runtime.tickTimer -= dt;
                if (runtime.tickTimer <= 0) {
                    runtime.effect?.onTick?.(dt);
                    runtime.tickTimer = runtime.data.tickInterval;

                    // 层数衰减：每次 tick 减 1 层，归零时标记移除
                    if (runtime.data.stackDecayOnTick) {
                        runtime.removeStack();
                        AttributeChangeResolver.revert(record.handles, this.propMgr);
                        record.handles = runtime.effect
                            ? AttributeChangeResolver.apply(runtime.effect.getChanges(), this.propMgr)
                            : [];
                        if (runtime.stack <= 0) {
                            toRemove.push(buffId);
                        }
                    }
                }
            }

            // 持续时间倒计时（duration > 0 才有限时）
            if (runtime.data.duration > 0) {
                runtime.remainTime -= dt;
                if (runtime.expired) {
                    toRemove.push(buffId);
                }
            }
        });

        toRemove.forEach((buffId) => this.removeBuff(buffId));
    }

    /**
     * 移除所有 Buff（实体死亡 / 场景切换时调用）
     */
    removeAll(): void {
        this.activeBuffs.forEach((record) => {
            record.runtime.effect?.onRemove?.();
            AttributeChangeResolver.revert(record.handles, this.propMgr);
        });
        this.activeBuffs.clear();
    }
}
