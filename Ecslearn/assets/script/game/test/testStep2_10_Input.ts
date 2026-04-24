/**
 * Step 2.10.3 — 输入层扩展：mouseUp + justReleased
 *
 * 覆盖：
 *   1. ActionComp.justReleased 在本帧鼠标抬起时触发 Attack
 *   2. ActionComp.justReleased 在本帧键盘 KEY_J 抬起时触发 Attack
 *   3. justReleased 下一帧（无 up 事件）自动清空
 *   4. 同帧同时按下 + 抬起不同键：justPressed / justReleased 各司其职
 *   5. HoldToShoot / ClickToShoot 零回归：justReleased 字段存在不影响老 Policy 行为
 */
import { KeyCode } from 'cc';
import { TestRegistry } from './TestRegistry';
import { RawInputComp, ActionComp, EAction } from '../component';
import { ActionMapSystem } from '../system/ActionMapSystem';
import { HoldToShoot, ClickToShoot, ChargeShoot } from '../shoot/ShootPolicies';
import { Entity } from '../../baseSystem/ecs';

function assert(cond: unknown, msg: string): asserts cond {
    if (!cond) throw new Error(msg);
}

/** 构造一个带 RawInputComp / ActionComp 的 Entity（不进 World）*/
function makeEntity(): { entity: Entity; raw: RawInputComp; act: ActionComp } {
    const entity = new Entity();
    const raw = new RawInputComp();
    const act = new ActionComp();
    entity.addComponent(raw);
    entity.addComponent(act);
    return { entity, raw, act };
}

function runActionMap(entity: Entity): void {
    const sys = new ActionMapSystem();
    sys.update([entity]);
}

// ─── 用例 1：鼠标抬起触发 justReleased ──────────────────

TestRegistry.register('Step2.10.3', '用例1', '鼠标抬起触发 Attack justReleased', () => {
    const { entity, raw, act } = makeEntity();
    raw.mouseUp = true;
    runActionMap(entity);
    assert(
        act.justReleased.has(EAction.Attack),
        `Attack 应在 justReleased 里；实际 size=${act.justReleased.size}`,
    );
});

// ─── 用例 2：键盘 J 抬起触发 justReleased ───────────────

TestRegistry.register('Step2.10.3', '用例2', '键盘 J 抬起触发 Attack justReleased', () => {
    const { entity, raw, act } = makeEntity();
    raw.up.add(KeyCode.KEY_J);
    runActionMap(entity);
    assert(act.justReleased.has(EAction.Attack), 'J 键抬起应触发 Attack justReleased');
});

// ─── 用例 3：下一帧自动清空 ─────────────────────────────

TestRegistry.register('Step2.10.3', '用例3', 'justReleased 下一帧自动清空', () => {
    const { entity, raw, act } = makeEntity();
    // 第一帧：mouseUp
    raw.mouseUp = true;
    runActionMap(entity);
    assert(act.justReleased.has(EAction.Attack), '第一帧应触发');

    // 第二帧：无任何 up 事件
    raw.mouseUp = false;
    raw.up.clear();
    runActionMap(entity);
    assert(
        act.justReleased.size === 0,
        `第二帧 justReleased 应为空；实际 size=${act.justReleased.size}`,
    );
});

// ─── 用例 4：按下 + 抬起同帧不同键 ─────────────────────

TestRegistry.register('Step2.10.3', '用例4', 'justPressed / justReleased 各司其职', () => {
    const { entity, raw, act } = makeEntity();
    raw.down.add(KeyCode.SPACE);     // 按 Dodge
    raw.up.add(KeyCode.KEY_J);       // 抬 Attack
    runActionMap(entity);

    assert(act.justPressed.has(EAction.Dodge),    'Dodge 应在 justPressed');
    assert(!act.justPressed.has(EAction.Attack),  'Attack 不应在 justPressed');
    assert(act.justReleased.has(EAction.Attack),  'Attack 应在 justReleased');
    assert(!act.justReleased.has(EAction.Dodge),  'Dodge 不应在 justReleased');
});

// ─── 用例 5：HoldToShoot / ClickToShoot 零回归 ──────────

TestRegistry.register('Step2.10.3', '用例5', 'HoldToShoot 不被 justReleased 字段污染', () => {
    const { entity, raw, act } = makeEntity();
    raw.mouseHeld = true;
    raw.mouseUp   = true;        // 也抬起（真实场景下不会同帧，但我们要确保语义独立）
    runActionMap(entity);

    const hold = new HoldToShoot();
    assert(
        hold.wantShoot(act, false, false),
        'HoldToShoot 在 active.has(Attack) 时应返 true',
    );
});

TestRegistry.register('Step2.10.3', '用例6', 'ClickToShoot 不被 justReleased 字段污染', () => {
    const { entity, raw, act } = makeEntity();
    raw.mouseDown = true;
    raw.mouseUp   = true;
    runActionMap(entity);

    const click = new ClickToShoot();
    assert(
        click.wantShoot(act, false, false),
        'ClickToShoot 在 justPressed.has(Attack) 时应返 true',
    );
});

TestRegistry.register('Step2.10.3', '用例7', 'ChargeShoot 仅在 justReleased 时返 true', () => {
    const { entity, raw, act } = makeEntity();

    // 场景 A: 只是按住（无 justReleased）
    raw.mouseHeld = true;
    runActionMap(entity);
    const charge = new ChargeShoot();
    assert(!charge.wantShoot(act, false, false), '按住时不应射');

    // 场景 B: 松开瞬间
    raw.mouseHeld = false;
    raw.mouseUp   = true;
    runActionMap(entity);
    assert(charge.wantShoot(act, false, false), '松开瞬间应射');
});
