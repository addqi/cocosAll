/**
 * 概率触发 + 冷却工具 —— 跨 effect 共享的"偶发技能"模板。
 *
 * 用途：
 *   - trigger-happy: 每次发射 30% 概率追加一箭（无冷却，chance=0.3, cooldownSec=0）
 *   - charge-lifedrain: 吸血概率随时间累积到 X%，触发后冷却到 0（ramp + reset）
 *   - 敌人命中减伤（未来）：命中时 50% 概率减伤，触发后冷却 3 秒
 *
 * 设计：
 *   - **tryTrigger(now) 返 boolean** —— 一次调用做"检查 + 可能消费"
 *   - 冷却是"上次触发后 N 秒内 tryTrigger 永远返 false"
 *   - `now` 由调用方提供（方便测试；别在工具类里偷 Date.now）
 *
 * 累积模式（`mode: 'ramp'`）—— 每次 tryTrigger 未触发时 chance 按 rate 累积到 maxChance：
 *   - chance 不再是固定值，而是每次调用递增
 *   - 触发时 chance 归 0（不是冷却，语义上的"蓄能消耗"）
 *
 * 这两种语义通过 constructor 参数切换，避免两套类。
 */
export interface ProbabilityCooldownOpts {
    /** 初始概率（0~1）；ramp 模式下是当前累积值起点 */
    chance: number;
    /** 触发后冷却秒数（0 = 无冷却） */
    cooldownSec?: number;
    /**
     * ramp 模式：每次 tryTrigger 未触发时，chance += rampRate * dtSec；
     * chance 上限 maxChance；触发时 chance 归 0。
     * 不提供 rampRate 或 rampRate <= 0 即固定概率模式。
     */
    rampRate?: number;
    maxChance?: number;
}

export class ProbabilityCooldown {
    private _chance: number;
    private readonly _initialChance: number;
    private readonly _cooldownSec: number;
    private readonly _rampRate: number;
    private readonly _maxChance: number;
    private _cdRemainSec = 0;
    private _lastTickNow = -1;

    constructor(opts: ProbabilityCooldownOpts) {
        this._chance = Math.max(0, Math.min(1, opts.chance));
        this._initialChance = this._chance;
        this._cooldownSec = Math.max(0, opts.cooldownSec ?? 0);
        this._rampRate = Math.max(0, opts.rampRate ?? 0);
        this._maxChance = Math.max(0, Math.min(1, opts.maxChance ?? 1));
    }

    /**
     * 尝试触发。
     *
     * @param now 当前时刻（秒）—— 用于计算 dt；首次调用会记录基准并返 false（避免 dt 巨大）。
     * @returns 是否触发
     */
    tryTrigger(now: number): boolean {
        // 首次调用：只记录时间，不触发，避免 dt 混乱
        if (this._lastTickNow < 0) {
            this._lastTickNow = now;
            return false;
        }
        const dt = Math.max(0, now - this._lastTickNow);
        this._lastTickNow = now;

        // 冷却中 —— 扣完 dt 后若仍 > 0 则本帧禁；若扣到 0 继续往下尝试触发
        if (this._cdRemainSec > 0) {
            this._cdRemainSec = Math.max(0, this._cdRemainSec - dt);
            if (this._cdRemainSec > 0) return false;
        }

        const fired = Math.random() < this._chance;
        if (fired) {
            this._cdRemainSec = this._cooldownSec;
            this._chance = this._rampRate > 0 ? 0 : this._initialChance;
        } else if (this._rampRate > 0) {
            this._chance = Math.min(this._maxChance, this._chance + this._rampRate * dt);
        }
        return fired;
    }

    /** 当前概率（ramp 模式下可用来显示 UI）*/
    get currentChance(): number { return this._chance; }
    /** 剩余冷却（秒）*/
    get cooldownRemain(): number { return this._cdRemainSec; }
    /** 手动重置（测试或 UI 用）*/
    reset(): void {
        this._chance = this._initialChance;
        this._cdRemainSec = 0;
        this._lastTickNow = -1;
    }
}
