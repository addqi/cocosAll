/** 箭头方向向量：[行增量, 列增量] */
export type Direction = [number, number];

/** 格子坐标：[行, 列] */
export type Cell = [number, number];

/** 一根箭头的数据 */
export interface ArrowData {
    direction: Direction;
    origin: Cell;
    coords: Cell[];
}

/** 一关的完整数据 */
export interface LevelData {
    rows: number;
    cols: number;
    arrows: ArrowData[];
}

/**
 * 校验 JSON 是不是合法的 LevelData。
 * 不合法直接抛错，因为错误的关卡数据没救。
 */
export function validateLevelData(data: unknown): LevelData {
    if (!data || typeof data !== 'object') {
        throw new Error('LevelData must be an object');
    }
    const d = data as LevelData;
    if (typeof d.rows !== 'number' || typeof d.cols !== 'number') {
        throw new Error('LevelData.rows / cols must be number');
    }
    if (!Array.isArray(d.arrows) || d.arrows.length === 0) {
        throw new Error('LevelData.arrows must be a non-empty array');
    }
    for (let i = 0; i < d.arrows.length; i++) {
        const a = d.arrows[i];
        if (!Array.isArray(a.direction) || a.direction.length !== 2) {
            throw new Error(`arrows[${i}].direction must be [dr, dc]`);
        }
        if (!Array.isArray(a.coords) || a.coords.length === 0) {
            throw new Error(`arrows[${i}].coords must be non-empty`);
        }
    }
    return d;
}