/**
 * 洗牌算法（Fisher-Yates + 散度阈值兜底）。纯函数，无引擎依赖。
 *
 * 散度阈值：要求至少 scatterRatio × N 块不在原位才算合格。
 *   - 太低（< 0.5）：有时候洗完跟没洗一样，玩家觉得游戏不工作
 *   - 太高（> 0.9）：极端情况死循环，maxAttempts 兜底退出
 */

/** Fisher-Yates 原地等概率打乱：1938 年算法，10 行写完。 */
export function fisherYates(arr: number[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

/** 数有多少块不在正确槽（slots[i] !== i）。 */
export function countMisplaced(arr: number[]): number {
    let count = 0;
    for (let i = 0; i < arr.length; i++) {
        if (arr[i] !== i) count++;
    }
    return count;
}

export interface ShuffleStats {
    misplaced: number;
    attempts: number;
    /** 是否达标（true = 满足 scatterRatio；false = 用了最后一次结果兜底）。 */
    satisfied: boolean;
}

/**
 * 洗牌带散度兜底——直到至少 scatterRatio 比例的块不在原位为止。
 *
 * 原地修改 slots，返回统计信息（调用方决定打 log 还是 warn）。
 */
export function shuffleSlots(
    slots: number[],
    scatterRatio: number,
    maxAttempts: number,
): ShuffleStats {
    const minMisplaced = Math.floor(slots.length * scatterRatio);
    let attempts = 0;
    let misplaced = 0;
    while (attempts < maxAttempts) {
        fisherYates(slots);
        attempts++;
        misplaced = countMisplaced(slots);
        if (misplaced >= minMisplaced) {
            return { misplaced, attempts, satisfied: true };
        }
    }
    return { misplaced, attempts, satisfied: false };
}
