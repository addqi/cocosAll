/**
 * ECS 基础类型定义
 * 定义组件和系统的通用接口，便于扩展
 */

/** 组件基接口 - 所有组件可实现此接口便于类型约束 */
export interface IComponent {}

/** 系统基接口 - 所有系统需实现 update 方法 */
export interface ISystem {
    update(entities: any[], dt?: number): void;
}
