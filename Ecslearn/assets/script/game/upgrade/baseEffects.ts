import { UpgradeEffectRegistry, type EffectApplyResult, type EffectHandler } from './UpgradeEffectRegistry';
import type { UpgradeTarget } from './types';

const buffHandler: EffectHandler = {
    apply(data: any, ctx: UpgradeTarget): EffectApplyResult {
        ctx.buffMgr.addBuff(data, ctx.buffOwner);
        return { buffIds: [data.id] };
    },
    remove(_data: any, ctx: UpgradeTarget, record: EffectApplyResult): void {
        for (const id of record.buffIds ?? []) ctx.buffMgr.removeBuff(id);
    },
};

const hitEffectHandler: EffectHandler = {
    apply(data: any, ctx: UpgradeTarget): EffectApplyResult {
        ctx.hitEffectMgr.add(data);
        return { hitEffectIds: [data.id] };
    },
    remove(_data: any, ctx: UpgradeTarget, record: EffectApplyResult): void {
        for (const id of record.hitEffectIds ?? []) ctx.hitEffectMgr.remove(id);
    },
};

const behaviorCommandHandler: EffectHandler = {
    apply(data: any, ctx: UpgradeTarget): EffectApplyResult {
        if (ctx.sendBehaviorCommand) {
            ctx.sendBehaviorCommand(data.command, ...(data.args ?? []));
        }
        return {};
    },
    remove(data: any, ctx: UpgradeTarget): void {
        if (data.undoCommand && ctx.sendBehaviorCommand) {
            ctx.sendBehaviorCommand(data.undoCommand, ...(data.undoArgs ?? []));
        }
    },
};

UpgradeEffectRegistry.register('buff', buffHandler);
UpgradeEffectRegistry.register('hit_effect', hitEffectHandler);
UpgradeEffectRegistry.register('behavior_command', behaviorCommandHandler);
