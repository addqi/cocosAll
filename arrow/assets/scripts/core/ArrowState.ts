import { ArrowData } from './LevelData';

/** 箭头移动状态枚举。数字值有语义（例如第 15 章会用 mode < Start 判断"还没发射"），不可随意改顺序 */
export enum ArrowMoveMode {
    Idle    = 0,
    Collide = 1,
    Back    = 2,
    Start   = 3,
    End     = 4,
}

/**
 * 一根箭头的运行时状态（07 章版本：只含 mode + hasFailed）。
 * 09 章实现贪吃蛇移动时会扩展 coords / progress 字段。
 */
export interface ArrowRuntime {
    mode: ArrowMoveMode;
    hasFailed: boolean;
}

/** 从配置创建初始 runtime */
export function createRuntime(_data: ArrowData): ArrowRuntime {
    return {
        mode: ArrowMoveMode.Idle,
        hasFailed: false,
    };
}

/** 是否可以被玩家点击激发（Idle 才可点）*/
export function canFire(rt: ArrowRuntime): boolean {
    return rt.mode === ArrowMoveMode.Idle;
}

/** 是否处于"运动中"（已激发但未结束）*/
export function isRunning(rt: ArrowRuntime): boolean {
    return rt.mode === ArrowMoveMode.Start
        || rt.mode === ArrowMoveMode.Collide
        || rt.mode === ArrowMoveMode.Back;
}

/** 是否已成功逃脱 */
export function hasEscaped(rt: ArrowRuntime): boolean {
    return rt.mode === ArrowMoveMode.End;
}

/** 激发箭头。blocked=true 表示前方有挡，进 Collide；否则进 Start */
export function fire(rt: ArrowRuntime, blocked: boolean): void {
    if (rt.mode !== ArrowMoveMode.Idle) return;
    rt.mode = blocked ? ArrowMoveMode.Collide : ArrowMoveMode.Start;
}

/** 飞出边界，Start → End */
export function markEnd(rt: ArrowRuntime): void {
    if (rt.mode !== ArrowMoveMode.Start) return;
    rt.mode = ArrowMoveMode.End;
}

/** 撞击完成，Collide → Back（同时首次标记失败）*/
export function markCollide(rt: ArrowRuntime): void {
    if (rt.mode !== ArrowMoveMode.Collide) return;
    rt.mode = ArrowMoveMode.Back;
    rt.hasFailed = true;
}

/** 回弹完成，Back → Idle。注意 hasFailed 不清零（一关内不可逆）*/
export function markBack(rt: ArrowRuntime): void {
    if (rt.mode !== ArrowMoveMode.Back) return;
    rt.mode = ArrowMoveMode.Idle;
}

/** 强制重置到初始 Idle（用于"重试"按钮）*/
export function resetToIdle(rt: ArrowRuntime, _data: ArrowData): void {
    rt.mode = ArrowMoveMode.Idle;
    rt.hasFailed = false;
}
