import { TestRegistry } from './TestRegistry';
import { PlayerBehaviorFactory, playerBehavior } from '../../baseSystem/player';
import { PlayerBehavior } from '../player/base';
import type { IAttackDecision, ISkillContextSource } from '../player/base';
import type { IState } from '../../baseSystem/fsm';
import type { PlayerCtx } from '../player/states/PlayerContext';
import type { SkillContext } from '../skill/SkillTypes';

// ── 最小可编译的 Stub 行为 ──

class StubBehavior extends PlayerBehavior {
    readonly typeId = '__test_stub';

    wantAttack(_d: IAttackDecision): boolean { return false; }

    createAttackState(): IState<PlayerCtx> {
        return { enter() {}, update() {}, exit() {} };
    }

    buildSkillContext(src: ISkillContextSource): SkillContext {
        return {
            playerProp:    src.playerProp,
            playerCombat:  src.playerCombat,
            playerNode:    src.playerNode,
            hitEffectMgr:  src.hitEffectMgr,
            buffMgr:       src.buffMgr,
            buffOwner:     src.buffOwner,
            mouseWorldPos: src.mouseWorldPos,
            behavior:      this,
            services:      null!,
        };
    }
}
playerBehavior(StubBehavior);

// ── 用例 1：Stub 能通过工厂创建 ──

TestRegistry.register('[PlayerBehavior 抽象] 工厂创建 StubBehavior', () => {
    const b = PlayerBehaviorFactory.create('__test_stub');
    if (!(b instanceof PlayerBehavior)) {
        throw new Error('实例应为 PlayerBehavior 子类');
    }
});

// ── 用例 2：wantAttack 可调用 ──

TestRegistry.register('[PlayerBehavior 抽象] wantAttack 返回 boolean', () => {
    const b = PlayerBehaviorFactory.create<PlayerBehavior>('__test_stub');
    const result = b.wantAttack({ input: null!, hasTarget: true, isMoving: false });
    if (typeof result !== 'boolean') throw new Error('wantAttack 应返回 boolean');
});

// ── 用例 3：createAttackState 返回合法状态 ──

TestRegistry.register('[PlayerBehavior 抽象] createAttackState 返回 IState', () => {
    const b = PlayerBehaviorFactory.create<PlayerBehavior>('__test_stub');
    const state = b.createAttackState();
    if (typeof state.enter !== 'function') throw new Error('缺少 enter');
    if (typeof state.update !== 'function') throw new Error('缺少 update');
    if (typeof state.exit !== 'function') throw new Error('缺少 exit');
});

// ── 用例 4：buildSkillContext 返回完整结构 ──

TestRegistry.register('[PlayerBehavior 抽象] buildSkillContext 返回 SkillContext', () => {
    const b = PlayerBehaviorFactory.create<PlayerBehavior>('__test_stub');
    const ctx = b.buildSkillContext({
        playerProp: null!, playerCombat: null!, playerNode: null!,
        hitEffectMgr: null!, buffMgr: null!, buffOwner: null!, mouseWorldPos: null!,
    });
    if (!('behavior' in ctx)) throw new Error('SkillContext 缺少 behavior');
    if (typeof ctx.behavior.onBehaviorCommand !== 'function') throw new Error('behavior 缺少 onBehaviorCommand');
});

// ── 用例 5：onBehaviorCommand 默认不抛错 ──

TestRegistry.register('[PlayerBehavior 抽象] onBehaviorCommand 默认空实现', () => {
    const b = PlayerBehaviorFactory.create<PlayerBehavior>('__test_stub');
    b.onBehaviorCommand('set_shoot_policy', 'auto', 2);
});
