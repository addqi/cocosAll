import type { UpgradeConfig, UpgradeEffect, UpgradeTarget, ShootPolicyData } from './types';
import { HoldToShoot, ClickToShoot, AutoShoot } from '../shoot/ShootPolicies';
import type { IShootPolicy } from '../shoot/types';

interface AppliedRecord {
    config: UpgradeConfig;
    buffIds: number[];
    hitEffectIds: string[];
    wasPolicy: boolean;
}

export class UpgradeManager {
    private _applied = new Map<string, AppliedRecord>();
    private _target: UpgradeTarget;
    private _defaultPolicy: IShootPolicy = new HoldToShoot();

    constructor(target: UpgradeTarget) {
        this._target = target;
    }

    apply(config: UpgradeConfig): boolean {
        if (this._applied.has(config.id)) return false;

        const record: AppliedRecord = {
            config,
            buffIds: [],
            hitEffectIds: [],
            wasPolicy: false,
        };

        for (const eff of config.effects) {
            this._applyEffect(eff, record);
        }

        this._applied.set(config.id, record);
        return true;
    }

    remove(configId: string): boolean {
        const record = this._applied.get(configId);
        if (!record) return false;

        for (const buffId of record.buffIds) {
            this._target.buffMgr.removeBuff(buffId);
        }
        for (const hid of record.hitEffectIds) {
            this._target.hitEffectMgr.remove(hid);
        }
        if (record.wasPolicy) {
            this._target.setShootPolicy(this._defaultPolicy);
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

    /**
     * 检查是否有可触发的进化升级
     * @param allConfigs 全部升级配置（含进化类）
     */
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
        switch (eff.type) {
            case 'buff': {
                this._target.buffMgr.addBuff(eff.data, this._target.buffOwner);
                record.buffIds.push(eff.data.id);
                break;
            }
            case 'hit_effect': {
                this._target.hitEffectMgr.add(eff.data);
                record.hitEffectIds.push(eff.data.id);
                break;
            }
            case 'shoot_policy': {
                const policy = this._createPolicy(eff.data as ShootPolicyData);
                this._target.setShootPolicy(policy);
                record.wasPolicy = true;
                break;
            }
        }
    }

    private _createPolicy(data: ShootPolicyData): IShootPolicy {
        switch (data.policyClass) {
            case 'ClickToShoot': return new ClickToShoot();
            case 'AutoShoot':    return new AutoShoot(data.level ?? 1);
            default:             return new HoldToShoot();
        }
    }
}
