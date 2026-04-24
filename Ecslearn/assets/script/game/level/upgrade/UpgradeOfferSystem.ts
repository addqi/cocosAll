import { emit } from '../../../baseSystem/util';
import { GameEvt, type UpgradeChosenEvent } from '../../events/GameEvents';
import type { UpgradeConfig } from '../../upgrade/types';
import type { UpgradeManager } from '../../upgrade/UpgradeManager';
import { ALL_UPGRADES } from '../../upgrade/upgradeConfigs';
import { LevelRun } from '../LevelRun';
import { tierToWeight } from './TierWeightPolicy';

/**
 * 升级抽卡器（数据层）
 *
 * 职责：
 *   - `rollOffer(count=3)` 按 tier 权重抽若干张候选升级
 *   - `applyChoice(id)`    把玩家选中的升级应用到 UpgradeManager + 登记 LevelRun
 *   - `isEligible(cfg)`    判定某条升级是否可入池（去重 + 进化前置）
 *
 * 非职责：
 *   - 不持有 "上一次 roll 的结果"—— 重抽由 LevelManager 显式再 rollOffer
 *   - 不管 UI / 事件总线之外的其他副作用
 *
 * Linus 式好品味：
 *   - 候选池过滤就是一串 .filter，不加状态
 *   - 权重抽样累积权重 + 线性扫描，清晰易读
 *   - tier → 权重委托给 TierWeightPolicy，想换公式改一个文件
 */
export class UpgradeOfferSystem {

    constructor(
        private readonly _manager: UpgradeManager,
        private readonly _pool: readonly UpgradeConfig[] = ALL_UPGRADES,
        private readonly _currentClassId: string | null = null,
    ) {
        if (_currentClassId === null) {
            console.warn(
                '[UpgradeOfferSystem] currentClassId=null — 流派独有升级将被过滤掉；' +
                '通用升级（classIds 缺省）仍可抽取。LevelManager 应在流派选择后再构造本系统。',
            );
        }
    }

    get currentClassId(): string | null { return this._currentClassId; }

    // ─── 候选池过滤 ─────────────────────────────────────

    /**
     * 判定一条升级当前是否可被抽到：
     *   1. UpgradeManager 没 apply 过
     *   2. 如果是进化版（evolvesFrom 非空）：所有前置必须都已 apply
     *   3. 如果声明了 classIds：当前 classId 必须在列表中；classId=null 时视为不匹配
     */
    isEligible(cfg: UpgradeConfig): boolean {
        if (this._manager.has(cfg.id)) return false;
        if (cfg.evolvesFrom?.length) {
            if (!cfg.evolvesFrom.every(id => this._manager.has(id))) return false;
        }
        if (cfg.classIds && cfg.classIds.length > 0) {
            if (!this._currentClassId) return false;
            if (!cfg.classIds.includes(this._currentClassId)) return false;
        }
        return true;
    }

    // ─── 抽卡 ──────────────────────────────────────────

    /**
     * 抽 count 张候选卡。候选池少于 count 时**返回实际数量**，不补位。
     * 同一次 roll 里不会出现重复 id（splice 排除已抽）。
     */
    rollOffer(count = 3): UpgradeConfig[] {
        const eligible = this._pool.filter(c => this.isEligible(c));
        return this._pickWeighted(eligible, count);
    }

    /**
     * 玩家选中一张升级：
     *   1. UpgradeManager.apply(cfg) 真正生效属性/hit effect
     *   2. LevelRun.current?.markUpgradeApplied(id) 登记（防抽卡再抽到它）
     *   3. emit GameEvt.UpgradeChosen
     * 返回 true = 成功；false = 找不到 id 或 UpgradeManager 已 apply 过
     */
    applyChoice(id: string): boolean {
        const cfg = this._pool.find(c => c.id === id);
        if (!cfg) {
            console.warn(`[UpgradeOfferSystem] applyChoice: unknown id "${id}"`);
            return false;
        }
        const ok = this._manager.apply(cfg);
        if (!ok) {
            console.warn(`[UpgradeOfferSystem] applyChoice: "${id}" 已 apply 过，忽略`);
            return false;
        }
        LevelRun.current?.markUpgradeApplied(id);

        const payload: UpgradeChosenEvent = { id };
        emit(GameEvt.UpgradeChosen, payload);
        return true;
    }

    // ─── 内部：累积权重抽样 ─────────────────────────────

    private _pickWeighted(pool: readonly UpgradeConfig[], count: number): UpgradeConfig[] {
        const result: UpgradeConfig[] = [];
        const remaining = [...pool];

        for (let i = 0; i < count && remaining.length > 0; i++) {
            // 每轮重算权重数组：被 splice 掉的不再参与
            const weights = remaining.map(c => tierToWeight(c.tier));
            const total = weights.reduce((a, b) => a + b, 0);
            if (total <= 0) break;  // 池里全是 tier<=0 的配置，不可能抽

            let r = Math.random() * total;
            let pickIdx = 0;
            for (let j = 0; j < weights.length; j++) {
                r -= weights[j];
                if (r <= 0) { pickIdx = j; break; }
            }
            result.push(remaining[pickIdx]);
            remaining.splice(pickIdx, 1);
        }
        return result;
    }
}
