/**
 * 升级抽卡的 "tier → 权重" 映射策略
 *
 * 职责：
 *   输入：升级配置的 tier（1=普通 / 2=稀有 / 3=史诗 / 4=传说 …）
 *   输出：抽卡时的权重（数值越大越容易被抽到）
 *
 * 非职责：
 *   - 不碰 UpgradeConfig；不知道 "fire-arrow" 是什么
 *   - 不执行抽卡（那是 UpgradeOfferSystem 的事）
 *   - 不做归一化；返回的原始权重由调用方累加得到总权重
 *
 * Linus 式好品味：
 *   - 切换曲线只改一行 `CurrentWeightPolicy`
 *   - 外部消费方只依赖 `tierToWeight(tier)` 这个函数，看不到内部策略类
 *   - 未来想加"策划 JSON 配置曲线"也只改这一个文件
 */

export interface IWeightPolicy {
    /** 给定 tier 返回权重；非正 tier 一律返回 0（不参与抽卡）*/
    tierToWeight(tier: number): number;
}

/** 线性反比：weight = 1 / tier（首版默认）*/
export class LinearWeightPolicy implements IWeightPolicy {
    tierToWeight(tier: number): number {
        return tier > 0 ? 1 / tier : 0;
    }
}

/** 二次反比：weight = 1 / tier²（高 tier 极稀有，适合放大 "传说梗"）*/
export class QuadraticWeightPolicy implements IWeightPolicy {
    tierToWeight(tier: number): number {
        return tier > 0 ? 1 / (tier * tier) : 0;
    }
}

/** 指数衰减：weight = 0.5 ^ (tier-1)（策划喜欢直觉的"每档减半"）*/
export class HalvingWeightPolicy implements IWeightPolicy {
    tierToWeight(tier: number): number {
        return tier > 0 ? Math.pow(0.5, tier - 1) : 0;
    }
}

/**
 * 当前使用的策略 —— 切换曲线只改这一行
 *
 * 选择指南（首版 MVP 用 Linear；后续数据驱动调整）：
 *   - Linear    = { 1:1.0, 2:0.5, 3:0.33, 4:0.25 } 温和
 *   - Quadratic = { 1:1.0, 2:0.25, 3:0.11, 4:0.06 } 高 tier 极稀
 *   - Halving   = { 1:1.0, 2:0.5, 3:0.25, 4:0.125 } 直觉"减半"
 */
export const CurrentWeightPolicy: IWeightPolicy = new LinearWeightPolicy();

/**
 * 便捷函数：等价于 CurrentWeightPolicy.tierToWeight(tier)
 * 抽卡器调用的唯一入口
 */
export function tierToWeight(tier: number): number {
    return CurrentWeightPolicy.tierToWeight(tier);
}
