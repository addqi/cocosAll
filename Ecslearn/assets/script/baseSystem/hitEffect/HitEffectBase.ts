import type { HitEffectData } from './types';

/**
 * HitEffect 基类 —— 支持 3 种钩子。
 *
 * Linus 原则：**扩展不破坏**。现有所有 effect 只实现 `onHit`，新钩子对它们透明。
 *
 * 钩子语义：
 *   - `onHit(ctx)`          玩家箭命中敌人后（必实现；保留语义）
 *   - `onShoot(ctx)`        玩家每次发射箭时（可选；可向 ctx 追加额外弹道 / 概率效果）
 *   - `onTakenDamage(ctx)`  玩家被敌人伤害前（可选；可修改 rawDamage 做"减伤/反弹/免死"）
 *
 * `onHit` 保留为抽象方法不仅因为"已有几十条 effect 这样写"，
 * 也因为"最常用路径每次命中必走"—— 可选会逼 HitEffectMgr 每帧判空，划不来。
 * `onShoot` / `onTakenDamage` 频率低、实现 effect 数量少，可选更合适。
 */
export abstract class HitEffectBase {
    constructor(public readonly data: HitEffectData) {}

    /** 箭命中敌人 —— 必实现 */
    abstract onHit(ctx: any): void;

    /** 每次发射箭时 —— 用于 trigger-happy / split-arrow 等 */
    onShoot?(ctx: any): void;

    /** 玩家被伤害前 —— 用于 second-wind / 减伤 / 反弹 等 */
    onTakenDamage?(ctx: any): void;
}
