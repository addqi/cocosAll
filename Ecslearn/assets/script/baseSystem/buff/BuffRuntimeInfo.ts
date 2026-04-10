/**
 * Buff 运行时实例
 *
 * 每个生效中的 Buff 对应一个 BuffRuntimeInfo，保存：
 * - 配置数据（data）
 * - 挂载目标（owner）
 * - 效果逻辑实例（effect，由 BuffFactory 创建）
 * - 叠加层数、剩余时间、tick 计时
 */
import { BuffEffectBase } from './BuffEffectBase';
import type { BuffData, IBuffOwner } from './types';

export class BuffRuntimeInfo {
    /** Buff 的静态配置数据（来自表格或 JSON） */
    public data: BuffData;

    /** Buff 的挂载目标，实现 IBuffOwner，表示这个 Buff 作用于哪个对象 */
    public owner: IBuffOwner;

    /**
     * 对应的效果逻辑实例（由 BuffFactory 创建并注入）
     * 使用 ! 因为工厂在构造后异步赋值
     */
    public effect!: BuffEffectBase;

    /**
     * 当前叠加层数
     * 添加时初始为 1，叠加时 addStack 增加，受 maxStack 限制
     */
    public stack: number = 1;

    /**
     * 剩余持续时间（秒）
     * 当 duration > 0 时每帧递减，<= 0 时 Buff 过期
     */
    public remainTime: number;

    /**
     * Tick 计时器（秒）
     * 用于 DOT/HoT 等周期性效果，每次归零时触发 onTick 并重置
     */
    public tickTimer: number;

    /**
     * @param data Buff 配置数据
     * @param owner 挂载目标（角色、怪物等）
     */
    constructor(data: BuffData, owner: IBuffOwner) {
        this.data = data;
        this.owner = owner;
        this.remainTime = data.duration ?? 0;
        this.tickTimer = data.tickInterval ?? 0;
    }

    /**
     * 叠加一层 Buff
     * 未超 maxStack 时层数 +1，有持续时间则刷新 remainTime
     */
    addStack(): void {
        const max = this.data.maxStack ?? 1;
        if (this.stack < max) {
            this.stack++;
            if (this.data.duration > 0) {
                this.remainTime = this.data.duration;
            }
        }
    }

    /**
     * 减少一层 Buff
     * stack > 0 时层数 -1
     */
    removeStack(): void {
        if (this.stack > 0) {
            this.stack--;
        }
    }

    /**
     * 是否已过期
     * duration <= 0 视为永久，永不过期；否则 remainTime <= 0 即过期
     */
    get expired(): boolean {
        if (this.data.duration <= 0) return false;
        return this.remainTime <= 0;
    }
}
