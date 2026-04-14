import type { UpgradeConfig, UpgradeEffect, UpgradeTarget, ShootPolicyData } from './types';
import { UpgradeEffectRegistry, type EffectApplyResult } from './UpgradeEffectRegistry';
import './baseEffects';

interface AppliedRecord {
    config: UpgradeConfig;
    results: { eff: UpgradeEffect; result: EffectApplyResult }[];
    /** legacy: shoot_policy 是否被旧路径修改过 */
    wasPolicy: boolean;
}

export class UpgradeManager {
    private _applied = new Map<string, AppliedRecord>();
    private _target: UpgradeTarget;

    constructor(target: UpgradeTarget) {
        this._target = target;
    }

    apply(config: UpgradeConfig): boolean {
        if (this._applied.has(config.id)) return false;

        const record: AppliedRecord = { config, results: [], wasPolicy: false };

        for (const eff of config.effects) {
            this._applyEffect(eff, record);
        }

        this._applied.set(config.id, record);
        return true;
    }

    remove(configId: string): boolean {
        const record = this._applied.get(configId);
        if (!record) return false;

        for (const { eff, result } of record.results) {
            const handler = UpgradeEffectRegistry.get(eff.type);
            if (handler) {
                handler.remove(eff.data, this._target, result);
            }
        }

        if (record.wasPolicy) {
            this._target.setShootPolicy(this._getDefaultPolicy());
        }

        this._applied.delete(configId);
        return true;
    }

    has(configId: string): boolean {
        return this._applied.has(configId);
    }

    get appliedIds(): string[] {
        return [...this._applied.keys()];
    }

    get count(): number {
        return this._applied.size;
    }

    checkEvolution(allConfigs: readonly UpgradeConfig[]): UpgradeConfig[] {
        const result: UpgradeConfig[] = [];
        for (const cfg of allConfigs) {
            if (!cfg.evolvesFrom?.length) continue;
            if (this._applied.has(cfg.id)) continue;
            if (cfg.evolvesFrom.every(id => this._applied.has(id))) {
                result.push(cfg);
            }
        }
        return result;
    }

    private _applyEffect(eff: UpgradeEffect, record: AppliedRecord) {
        const handler = UpgradeEffectRegistry.get(eff.type);
        if (handler) {
            const result = handler.apply(eff.data, this._target);
            record.results.push({ eff, result });
            return;
        }

        if (eff.type === 'shoot_policy') {
            this._legacyApplyPolicy(eff.data as ShootPolicyData);
            record.wasPolicy = true;
            record.results.push({ eff, result: {} });
            return;
        }

        console.warn(`[UpgradeManager] 未知 effect type: "${eff.type}"`);
    }

    private _legacyApplyPolicy(data: ShootPolicyData): void {
        if (this._target.sendBehaviorCommand) {
            this._target.sendBehaviorCommand('set_shoot_policy_class', data.policyClass, data.level);
        } else {
            this._target.setShootPolicy(data);
        }
    }

    private _getDefaultPolicy(): unknown {
        return { policyClass: 'HoldToShoot' };
    }
}
