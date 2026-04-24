import { isInsideBoard } from './Coord';
import { ArrowData, Cell, Direction } from './LevelData';

/** 箭头移动状态枚举。数字值有语义（例如第 15 章会用 mode < Start 判断"还没发射"），不可随意改顺序 */
export enum ArrowMoveMode {
    Idle = 0,
    Collide = 1,
    Back = 2,
    Start = 3,
    End = 4,
}

/**
 * 一根箭头的运行时状态（07 章版本：只含 mode + hasFailed）。
 * 09 章实现贪吃蛇移动时会扩展 coords / progress 字段。
 */
export interface ArrowRuntime {
    /** */
    mode: ArrowMoveMode;
    hasFailed: boolean;
    /** 当前占据的格子（随前进动态变化，和 ArrowData.coords 解耦）*/
    coords: Cell[];
    /** Start 状态下的推进累计量（单位：格）。每累加满 1 格就真的移动一次 */
    progress: number;
    /** Collide 状态下，头部要抵达的目标格子；其他状态下为 null */
    collideAim: Cell | null;
}

/** 从配置创建初始 runtime */
export function createRuntime(data: ArrowData): ArrowRuntime {
    return {
        /** 当前状态 */
        mode: ArrowMoveMode.Idle,
        /** 是否失败 */
        hasFailed: false,
        /** 当前占据的格子（随前进动态变化，和 ArrowData.coords 解耦）*/
        coords: data.coords.map(c => [c[0], c[1]] as Cell),  // 深拷贝一次
        /** Start 状态下的推进累计量（单位：格）。每累加满 1 格就真的移动一次 */
        progress: 0,
        /** Collide 状态下，头部要抵达的目标格子；其他状态下为 null */
        collideAim: null,
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

/** 从 coords 最后两点派生方向。单格时返回 [0,0]（不动） */
export function deriveDirection(coords: Cell[]): Direction {
    if (coords.length < 2) return [0, 0];
    const [hr, hc] = coords[coords.length - 1];
    const [pr, pc] = coords[coords.length - 2];
    return [hr - pr, hc - pc];
}

/** Start 模式下每帧推进。方向由 coords 自动派生。 */
export function tickStart(rt: ArrowRuntime, dt: number, speed: number, rows: number, cols: number): void {
    if (rt.mode !== ArrowMoveMode.Start) return;
    rt.progress += speed * dt;
    while (rt.progress >= 1) {
        rt.progress -= 1;
        stepOneCell(rt);
        const tail = rt.coords[0];
        if (!isInsideBoard(tail[0], tail[1], rows, cols)) {
            markEnd(rt);
            break;
        }
    }
}


/** 头进一格、尾出一格。支持任意折线。 */
function stepOneCell(rt: ArrowRuntime): void {
    const dir = deriveDirection(rt.coords);
    const [hr, hc] = rt.coords[rt.coords.length - 1];
    rt.coords.push([hr + dir[0], hc + dir[1]]);
    rt.coords.shift();
}