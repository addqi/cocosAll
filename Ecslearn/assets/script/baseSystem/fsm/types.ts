/**
 * 状态接口
 * TCtx 为上下文类型，状态通过它操作宿主，不直接依赖任何具体类
 */
export interface IState<TCtx = any> {
    enter(ctx: TCtx): void;
    update(ctx: TCtx, dt: number): void;
    exit(ctx: TCtx): void;
}
