import { _decorator, Node } from 'cc';
import { BuffRuntimeInfo } from './BuffRuntimeInfo';
import { AttributeChange, BuffData } from './types';
const { ccclass, property } = _decorator;
/**
 * BuffEffectBase
 *  - 所有具体 Buff 效果应继承此类
 *  - 要求实现 getChanges()（声明式），以及可选的 onAdd/onRemove/onTick 逻辑
 *
 * 设计原则：BuffEffect 只“声明”要改变什么（AttributeChange），不要直接操作属性系统。
 */
@ccclass('BuffEffectBase')
export abstract class BuffEffectBase  {

    /** 
     * Buff 的运行时实例（包含叠加层数、剩余时间、owner 等信息）
     * 每个 Buff 生效时都会创建一个 BuffRuntimeInfo 对象，并传入到这里
     */
    public runtime: BuffRuntimeInfo;

    /**
     * Buff 的配置数据（来自 json/表格）
     * BuffEffect 通过 data 读取策划配置：
     *   - 持续时间
     *   - 叠加上限
     *   - 增加的速度数值等
     */
    public data: BuffData;

    /**
     * 构造函数
     * 由 BuffFactory 创建 BuffEffect 实例时调用
     * @param runtime 本 Buff 的运行时数据
     */
    constructor(runtime: BuffRuntimeInfo) {
        this.runtime = runtime;
        this.data = runtime.data;
    }

    /**
     * 声明式：返回本 Buff 会对哪些属性产生变化
     * 例如：加速 Buff 会声明 "移动速度 +10" 或 "移动速度 ×1.2"
     *
     * 注意：
     * - 这里只“声明”变化内容，不直接修改属性
     * - 实际修改由 AttributeChangeResolver 统一处理
     *
     * 必须由子类实现
     */
    abstract getChanges(): AttributeChange[];

    /**
     * 可选方法：当 Buff “第一次” 被添加到角色身上时触发
     * 典型用途：
     *  - 播放 buff 特效
     *  - 显示 UI 提示
     *  - 初始化一些临时数据
     *
     * 如果子类不需要 onAdd 逻辑，可以不实现（因为有 ?）
     */
    onAdd?(): void;

    /**
     * 可选方法：Buff 被移除时触发
     * 典型用途：
     *  - 停止特效
     *  - 恢复 UI 状态
     *  - 清理临时数据
     *
     * 子类可自由选择是否实现
     */
    onRemove?(): void;

    /**
     * 可选方法：当 Buff 配置了 tickInterval 时，每次 tick 触发一次
     * 典型用途：
     *  - 持续伤害（DOT）
     *  - 每秒回血（HoT）
     *  - 每秒执行逻辑
     *
     * 不需要 tick 的 Buff 不实现即可
     */
    onTick?(dt?:number): void;
}


