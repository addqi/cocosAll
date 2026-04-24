/**
 * Step 2.12 — 虚拟输入系统（摇杆 + 攻击按钮）
 *
 * 覆盖：
 *   A 组 computeJoystickOutput（纯函数）
 *     A1 中心点（dx=dy=0）→ active=false
 *     A2 死区内 → active=false
 *     A3 死区外、半径内 → 归一化正确
 *     A4 半径外 → 按方向 clamp 到 1.0
 *     A5 边界点（distance == deadZone）→ 归一化（视为活动）
 *     A6 负方向 / 4 个象限对称
 *
 *   B 组 computeKnobLocalPos（视觉位置）
 *     B1 半径内：knob 跟随触摸
 *     B2 半径外：knob clamp 到边缘
 *
 *   C 组 ActionMapSystem 优先级合并
 *     C1 键盘按 + 摇杆有输入 → moveDir 用键盘
 *     C2 键盘空 + 摇杆有输入 → moveDir 用摇杆
 *     C3 键盘空 + 摇杆无输入 → moveDir = (0,0)
 *     C4 mouseDown / mouseHeld 任一为 true 都触发 EAction.Attack
 */

import { TestRegistry } from './TestRegistry';
import {
    computeJoystickOutput,
    computeKnobLocalPos,
} from '../ui/VirtualInputPanel';
import { ActionMapSystem } from '../system/ActionMapSystem';
import { RawInputComp, ActionComp, EAction } from '../component';
import { Entity } from '../../baseSystem/ecs';
import { KeyCode } from 'cc';

function assert(cond: unknown, msg: string): asserts cond {
    if (!cond) throw new Error(msg);
}
function assertNear(actual: number, expected: number, eps: number, label: string): void {
    if (Math.abs(actual - expected) > eps) {
        throw new Error(`${label}: expected ≈${expected} (±${eps}), got ${actual}`);
    }
}

// ─── A 组 computeJoystickOutput ────────────────────

TestRegistry.register('Step2.12-A', '用例1', '中心点不活动', () => {
    const out = computeJoystickOutput(100, 100, 100, 100, 10, 50);
    assert(!out.active, 'active 应为 false');
});

TestRegistry.register('Step2.12-A', '用例2', '死区内不活动', () => {
    const out = computeJoystickOutput(105, 103, 100, 100, 10, 50);  // 距 5.83
    assert(!out.active, '距 < 10 应不活动');
});

TestRegistry.register('Step2.12-A', '用例3', '死区外正常归一化', () => {
    const out = computeJoystickOutput(125, 100, 100, 100, 10, 50);  // 距 25
    assert(out.active, 'active 应为 true');
    assertNear(out.x, 0.5, 1e-6, 'x = 25/50 = 0.5');
    assertNear(out.y, 0,   1e-6, 'y = 0');
});

TestRegistry.register('Step2.12-A', '用例4', '半径外按方向 clamp 到 1', () => {
    const out = computeJoystickOutput(200, 100, 100, 100, 10, 50);  // 距 100
    assert(out.active, 'active=true');
    assertNear(out.x, 1, 1e-6, 'x clamp 到 1');
    assertNear(out.y, 0, 1e-6, 'y = 0');
});

TestRegistry.register('Step2.12-A', '用例5', '边界 distance == deadZone 视为活动', () => {
    const out = computeJoystickOutput(110, 100, 100, 100, 10, 50);  // 距 10
    assert(out.active, '边界点应活动');
    assertNear(out.x, 0.2, 1e-6, 'x = 10/50');
});

TestRegistry.register('Step2.12-A', '用例6', '4 象限对称', () => {
    const cx = 100, cy = 100;
    const r = 25;
    const cases: Array<[number, number, number, number]> = [
        [cx + r, cy,     0.5,  0],     // 右
        [cx - r, cy,    -0.5,  0],     // 左
        [cx,     cy + r, 0,    0.5],   // 上
        [cx,     cy - r, 0,   -0.5],   // 下
    ];
    for (const [tx, ty, ex, ey] of cases) {
        const o = computeJoystickOutput(tx, ty, cx, cy, 10, 50);
        assertNear(o.x, ex, 1e-6, `(${tx},${ty}) x`);
        assertNear(o.y, ey, 1e-6, `(${tx},${ty}) y`);
    }
});

// ─── B 组 computeKnobLocalPos ──────────────────────

TestRegistry.register('Step2.12-B', '用例1', '半径内 knob 跟随', () => {
    const p = computeKnobLocalPos(125, 110, 100, 100, 50);  // 偏移 (25, 10), 距 26.93
    assertNear(p.x, 25, 1e-6, 'x = 25');
    assertNear(p.y, 10, 1e-6, 'y = 10');
});

TestRegistry.register('Step2.12-B', '用例2', '半径外 clamp 到边缘', () => {
    const p = computeKnobLocalPos(200, 100, 100, 100, 50);  // 偏移 (100, 0)
    assertNear(p.x, 50, 1e-6, 'x clamp 到 50');
    assertNear(p.y, 0,  1e-6, 'y = 0');
});

// ─── C 组 ActionMapSystem 优先级合并 ─────────────

function mkEntity(): { entity: Entity; raw: RawInputComp; act: ActionComp } {
    const entity = new Entity();
    const raw = new RawInputComp();
    const act = new ActionComp();
    entity.addComponent(raw);
    entity.addComponent(act);
    return { entity, raw, act };
}
function runAm(entity: Entity): void {
    new ActionMapSystem().update([entity]);
}

TestRegistry.register('Step2.12-C', '用例1', '键盘 + 摇杆同时有输入：键盘优先', () => {
    const { entity, raw, act } = mkEntity();
    raw.keys.set(KeyCode.KEY_D, true);          // 键盘按右
    raw.virtualMoveX = -1;                       // 摇杆指左
    raw.virtualMoveY = 0;
    raw.virtualMoveActive = true;
    runAm(entity);
    assertNear(act.moveDir.x,  1, 1e-6, '应用键盘 D 的方向');
    assertNear(act.moveDir.y,  0, 1e-6, 'y=0');
});

TestRegistry.register('Step2.12-C', '用例2', '键盘空 + 摇杆有输入：用摇杆', () => {
    const { entity, raw, act } = mkEntity();
    raw.virtualMoveX = 0.6;
    raw.virtualMoveY = 0.8;
    raw.virtualMoveActive = true;
    runAm(entity);
    assertNear(act.moveDir.x, 0.6, 1e-6, '用摇杆 x');
    assertNear(act.moveDir.y, 0.8, 1e-6, '用摇杆 y');
});

TestRegistry.register('Step2.12-C', '用例3', '键盘空 + 摇杆无输入：归 0', () => {
    const { entity, raw, act } = mkEntity();
    raw.virtualMoveX = 1;
    raw.virtualMoveY = 1;
    raw.virtualMoveActive = false;   // 关键：未激活
    runAm(entity);
    assertNear(act.moveDir.x, 0, 1e-6, 'x = 0');
    assertNear(act.moveDir.y, 0, 1e-6, 'y = 0');
});

TestRegistry.register('Step2.12-C', '用例4', 'mouseDown 触发 Attack justPressed', () => {
    const { entity, raw, act } = mkEntity();
    raw.mouseDown = true;
    runAm(entity);
    assert(act.justPressed.has(EAction.Attack), 'mouseDown 应等价于 Attack justPressed');
});

TestRegistry.register('Step2.12-C', '用例5', 'mouseHeld 触发 Attack active', () => {
    const { entity, raw, act } = mkEntity();
    raw.mouseHeld = true;
    runAm(entity);
    assert(act.active.has(EAction.Attack), 'mouseHeld 应等价于 Attack active');
});

TestRegistry.register('Step2.12-C', '用例6', 'mouseUp 触发 Attack justReleased', () => {
    const { entity, raw, act } = mkEntity();
    raw.mouseUp = true;
    runAm(entity);
    assert(act.justReleased.has(EAction.Attack), 'mouseUp 应等价于 Attack justReleased');
});
