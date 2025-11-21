import { BuffEffectBase } from "./BuffEffectBase";
import { BuffRuntimeInfo } from "./BuffRuntimeInfo";

/**
 * 变化类型
 */
export type Changetype = 'ADD'|'MUL'|'OVERRIDE'|'CLAMP'|'EVENT';

/**声明式的属性变化描述 */
export interface AttributeChange{
    attrId:string; // 属性ID
    type:Changetype; // 变化类型
    value?:number;//值
    meta?:any;//额外的元数据
}
/** BuffData：来自配置表（JSON/Excel） */
export interface BuffData{
    id: number;
    name: string;
    /**秒；0 表示永久 */
    duration: number;          // 
    /**最大叠加层数（默认 1） */
    maxStack?: number;         // 
    /** tick 间隔（秒）, 0 表示不 tick */
    tickInterval?: number;     //
    /**工厂使用的效果类名 */
    effectClass?: string;      // 工厂使用的效果类名
    // 额外字段：任意配置数据（例如 addValue, mulValue）
    [key: string]: any;
}

/** BuffEffectFactory 要返回的类构造签名 */
export type BuffEffectCtor = new (runtime: BuffRuntimeInfo) => BuffEffectBase;

/** 最小 Buff 持有者（角色）接口：只要求能被属性解析器访问到属性系统 */
export interface IBuffOwner {
    // 一般你的 RolePropertyMgr（或 PropertyManager）至少要实现这几个方法
    getPropertyManager(): any;           // 返回属性管理器（你的 PropertyManager 实例）
    // 提供一个唯一 id（用于日志/调试）
    uid?: string | number;
}