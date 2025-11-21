import { _decorator, Component, Node } from 'cc';
import { BuffData, IBuffOwner } from './types';
import { BuffEffectBase } from './BuffEffectBase';
const { ccclass, property } = _decorator;
/**
 * BuffRuntimeInfo - 运行时的 Buff 实例
 * - 保存层数/剩余时间/tick 计时
 * - 持有对应的 effect 实例（由工厂创建）
 */
@ccclass('BuffRuntimeInfo')
export class BuffRuntimeInfo {
    /** 
     * Buff 的静态配置数据（通常来自表格或 JSON） 
     * - 包含 id/name/duration/maxStack/tickInterval 等策划配置项
     */
    public data: BuffData;

    /**
     * Buff 的挂载目标（持有者）
     * - 实现 IBuffOwner 接口（至少能提供 getPropertyManager() 等方法）
     * - 表示这个 buff 作用于哪个对象（角色、怪物、建筑等）
     */
    public owner: IBuffOwner;

    /**
     * 对应的逻辑效果实例（由 BuffFactory 创建并注入）
     * - 派生自 BuffEffectBase，负责声明式变化与副作用（播放特效、onTick 等）
     * - 注意：实例可能在构造后由工厂赋值（所以用 `!` 非空断言）
     */
    public effect!: BuffEffectBase;

    /** 
     * buff 叠加层数（当前已经叠了多少层） 
     * - 默认 1（添加 Buff 时初始化为 1）
     * - 叠加时通常受 data.maxStack 限制
     */
    public stack: number = 1;

    /**
     * 剩余持续时间（单位：秒）
     * - 当 data.duration > 0 时使用（>0 表示非永久 Buff）
     * - 每帧或每个 update 周期应减 `remainTime -= dt`
     */
    public remainTime: number;

    /**
     * Tick 计时器（单位：秒）
     * - 用于周期性触发（例如每秒掉血）场景
     * - 初始值通常赋为 data.tickInterval（方便第一次触发或延迟触发）
     */
    public tickTimer: number;

    /**
     * 构造函数
     * @param data - Buff 的静态配置数据（BuffData）
     * @param owner - Buff 的持有者（实现 IBuffOwner）
     *
     * 初始化 remainTime 与 tickTimer（从配置读取默认值）
     */
    constructor(data: BuffData, owner: IBuffOwner) {
        this.data = data;
        this.owner = owner;

        // 初始化剩余时间：如果配置中没有 duration 则使用 0（表示永久或未设置）
        this.remainTime = data.duration || 0;

        // 初始化 tick 计时器：如果配置中没有 tickInterval 则使用 0（表示不 tick）
        this.tickTimer = data.tickInterval || 0;
    }

    /**
     * 添加一层 Buff（叠加逻辑）
     * - 默认策略：
     *    1. 如果未超出 maxStack，则层数 +1
     *    2. 若为有持续时间的 Buff（duration>0），叠加时刷新剩余时间为 data.duration
     *
     * 注意：你可以按需修改此函数实现不同的叠加策略（例如：只刷新时间但不叠加，或达到 maxStack 后不刷新）
     */
    addStack() {
        // 读取配置里的最大叠加层数（如果未配置，默认 1）
        const max = this.data.maxStack ?? 1; // 默认最大是1

        // 如果当前层数小于上限，则允许叠加
        if (this.stack < max) {
            this.stack++; // 层数增加

            // 如果 buff 是有持续时间的（非永久），叠加时刷新剩余持续时间
            if (this.data.duration > 0) // 不是持久 buff
                this.remainTime = this.data.duration; // 刷新持续时间
        } else {
            // 若已达到最大叠加层数，你也可以在这里选择刷新时间或不动
            // 例如：若想在达到 max 时仍刷新时间，可把上面的刷新逻辑移出 if-block
        }
    }

    /**
     * 是否过期（只读属性）
     * - 当配置的 duration <= 0 时，视为永久（不计时），返回 false
     * - 否则，当 remainTime <= 0 说明时间耗尽，返回 true
     *
     * 使用示例（通常由 BuffMgr.update 调用）：
     *   if (runtime.expired) removeBuff();
     */
    get expired(): boolean {
        // 若配置 duration <= 0，说明是永久或未设置持续时间 -> 不会过期
        if (this.data.duration <= 0) {
            return false;
        }

        // 否则如果剩余时间小于等于 0，就认为过期
        // 关键步骤：比较 remainTime 与 0，注意小数误差可按需容忍（例如 <= 0.0001）
        return this.remainTime <= 0;
    }
}


