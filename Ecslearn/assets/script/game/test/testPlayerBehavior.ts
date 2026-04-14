import { TestRegistry } from './TestRegistry';
import {
    PlayerBehaviorBase,
    PlayerBehaviorFactory,
    playerBehavior,
} from '../../baseSystem/player';

class DummyBehavior extends PlayerBehaviorBase {
    readonly typeId = '__test_dummy';
}
playerBehavior(DummyBehavior);

// ── 用例 1：合法职业 ID 创建成功 ──

TestRegistry.register('[PlayerBehavior] 合法 ID 创建成功', () => {
    const b = PlayerBehaviorFactory.create('__test_dummy');
    if (!b) throw new Error('create 返回空值');
    if (b.typeId !== '__test_dummy') throw new Error(`typeId 错误: ${b.typeId}`);
});

// ── 用例 2：非法职业 ID 创建失败 ──

TestRegistry.register('[PlayerBehavior] 非法 ID 抛错', () => {
    let threw = false;
    try {
        PlayerBehaviorFactory.create('__nonexistent_xyz');
    } catch {
        threw = true;
    }
    if (!threw) throw new Error('未注册 ID 应抛错');
});

// ── 用例 3：重复注册保护 ──

TestRegistry.register('[PlayerBehavior] 重复注册拒绝', () => {
    let threw = false;
    try {
        PlayerBehaviorFactory.register('__test_dummy', DummyBehavior);
    } catch {
        threw = true;
    }
    if (!threw) throw new Error('重复注册应抛错');
});

// ── 用例 4：has() 检查 ──

TestRegistry.register('[PlayerBehavior] has() 正确', () => {
    if (!PlayerBehaviorFactory.has('__test_dummy')) throw new Error('已注册 ID 应返回 true');
    if (PlayerBehaviorFactory.has('__nope')) throw new Error('未注册 ID 应返回 false');
});

// ── 用例 5：registeredIds 可查 ──

TestRegistry.register('[PlayerBehavior] registeredIds 包含已注册项', () => {
    const ids = PlayerBehaviorFactory.registeredIds();
    if (ids.indexOf('__test_dummy') < 0) throw new Error('registeredIds 应包含 "__test_dummy"');
});
