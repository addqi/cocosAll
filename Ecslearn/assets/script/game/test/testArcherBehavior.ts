import { TestRegistry } from './TestRegistry';
import { PlayerBehaviorFactory } from '../../baseSystem/player';
import { PlayerBehavior } from '../player/base';
import { ArcherBehavior } from '../player/archer';
import { AutoShoot } from '../shoot/ShootPolicies';

// ── 用例 1：工厂能创建 archer ──

TestRegistry.register('[Archer] 工厂创建 ArcherBehavior', () => {
    const b = PlayerBehaviorFactory.create('archer');
    if (!(b instanceof ArcherBehavior)) throw new Error('应为 ArcherBehavior 实例');
    if (!(b instanceof PlayerBehavior)) throw new Error('应为 PlayerBehavior 子类');
});

// ── 用例 2：wantAttack 委托给 HoldToShoot（默认策略） ──

TestRegistry.register('[Archer] wantAttack 默认策略 — 无输入不攻击', () => {
    const b = PlayerBehaviorFactory.create<ArcherBehavior>('archer');
    const mockInput = { active: new Set(), justPressed: new Set() } as any;
    const result = b.wantAttack({ input: mockInput, hasTarget: true, isMoving: false });
    if (result !== false) throw new Error('HoldToShoot 无攻击输入应返回 false');
});

// ── 用例 3：createAttackState 返回合法 IState ──

TestRegistry.register('[Archer] createAttackState 返回 IState', () => {
    const b = PlayerBehaviorFactory.create<ArcherBehavior>('archer');
    const state = b.createAttackState();
    if (typeof state.enter !== 'function') throw new Error('缺少 enter');
    if (typeof state.update !== 'function') throw new Error('缺少 update');
    if (typeof state.exit !== 'function') throw new Error('缺少 exit');
});

// ── 用例 4：onBehaviorCommand 切换 shootPolicy ──

TestRegistry.register('[Archer] onBehaviorCommand 切换射击策略', () => {
    const b = PlayerBehaviorFactory.create<ArcherBehavior>('archer');
    const auto = new AutoShoot(2);
    b.onBehaviorCommand('set_shoot_policy', auto);
    if (b.shootPolicy !== auto) throw new Error('策略未切换');
});

// ── 用例 5：buildSkillContext 注入 behavior ──

TestRegistry.register('[Archer] buildSkillContext 包含 behavior', () => {
    const b = PlayerBehaviorFactory.create<ArcherBehavior>('archer');
    const ctx = b.buildSkillContext({
        playerProp: null!, playerCombat: null!, playerNode: null!,
        hitEffectMgr: null!, buffMgr: null!, buffOwner: null!, mouseWorldPos: null!,
    });
    if (!ctx.behavior) throw new Error('缺少 behavior');
    if (typeof ctx.behavior.onBehaviorCommand !== 'function') throw new Error('behavior 缺少 onBehaviorCommand');
});
