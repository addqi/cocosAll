# 07 · ArrowMoveMode 状态机（纯逻辑）

## 本节目标

**为每一根箭头定义一个 5 态状态机，用纯 TypeScript 写完**，不碰 Cocos。

本章结束时：

- `scripts/core/ArrowState.ts` 里有完整的 `ArrowMoveMode` 枚举和 `ArrowRuntime` 数据结构。
- `scripts/core/StateMachine.ts` 里有 `canFire / fire / markCollide / markBack / markEnd / reset` 一组纯函数，每个都做一件事。
- 在 `GameController.onLoad` 里手动跑一段自测代码，Console 打印：
  ```
  [Arrow] StateMachine self-test:
    init: Idle
    after fire: Start
    after markEnd: End
    after reset: Idle
  ```

一句话：**把整个游戏的"规则"先在纸上写清楚，和 Cocos 解耦**。

---

## 需求分析

### 为什么先写状态机

> "Bad programmers worry about the code. Good programmers worry about data structures." — Linus

这句话在本章全面生效。

**整个游戏的核心数据 = 每根箭头的状态 + 关卡的 hp**。搞清楚这俩，后面 14 章都是围着它们转的"画面层"。

**先写纯逻辑的 3 个理由**：

1. **可独立验证**。一段 `console.log` 就能自测，不用启动 Cocos、不用点鼠标、不用等编译。
2. **不污染画面代码**。ArrowView 以后只做"看状态显颜色/位置"，不判断规则。
3. **可移植**。今天是 Cocos 3.8，明天换 React Native 或 Unity，这段 core 代码一行不用改。

对照 G3_FBase，这部分对应：

- `ArrowComponent.defineComponent()` 里的状态字段（`moveMode / coords / historyCoords / collideAim / collidedIndex / failed / collidedTime`）
- 一堆 `MovingXxxLogic` 里调用的状态转移（`arrowComponent.moveMode.set(eid, G3_FBase.ArrowMoveMode.Back)`）

G3_FBase 把"数据在 Component / 转移在 Logic / 转移时机在 Chain"三处分散，新手看得一头雾水。**我们合并为一处：纯 TypeScript 一个文件**，类型 + 所有转移函数都在一起。

### 5 个状态的含义（严格对齐 G3_FBase）

```typescript
enum ArrowMoveMode {
    Idle    = 0,   // 空闲：等待玩家点击，显示灰色
    Collide = 1,   // 撞击：正在撞前方箭头，显示红色
    Back    = 2,   // 回弹：被弹回起点，显示红色
    Start   = 3,   // 飞出：正在沿方向匀速飞，显示蓝色
    End     = 4,   // 逃脱：已飞出边界，标记成功
}
```

**为什么值是 `0,1,2,3,4` 而不能随便改**？

看 G3_FBase 里这段判定胜利的代码（`TouchEndToCombatDoPassDispatchLogic`）：

```typescript
if (this.combatArrowDomain.arrowComponent.moveMode[arrowEid] < G3_FBase.ArrowMoveMode.Start) {
    this.router.dispatchAction = ae.DispatchAction.Cancel;
    return;
}
```

关键是 `< Start`，意味着 **Idle/Collide/Back 都属于"还没成功开始"，Start/End 属于"已开始"**。数值的大小关系是有语义的。

- `< Start` = 还没成功发射（Idle 0 / Collide 1 / Back 2）
- `>= Start` = 已经成功发射（Start 3 / End 4）

**我们沿用这个设计**。

### 状态转移图

```
          ┌──────────────┐
          │  Idle (0)    │◄────────────┐
          └──┬───────────┘             │
             │ fire() 成功              │ markBack() 完成
             │                          │
     ┌───────▼──────┐      前方有挡    ┌┴────────────┐
     │  Start (3)   │◄─── markCollide ─┤  Collide (1)│
     └──┬───────────┘                   └─────────────┘
        │ markEnd()                          │
        │ (飞出边界)                         │ markBack()
        ▼                                    │
     ┌───────────┐                           │
     │  End (4)  │                           ▼
     └───────────┘                    ┌──────────────┐
                                      │  Back (2)    │
                                      └──────────────┘
```

**转移规则**：

| 当前 | 事件 | 下一状态 | 备注 |
|------|------|----------|------|
| Idle | `fire()` 前方无挡 | Start | 玩家点击成功 |
| Idle | `fire()` 前方有挡 | Collide | 玩家点击但注定撞 |
| Start | `markEnd()` | End | 飞出棋盘边界 |
| Collide | `markBack()` | Back | 撞完了开始回弹 |
| Back | `markBack()` 回到原位 | Idle | 回弹完了；同时 `hp -= 1` |
| End / Start | 任何转移 | 不允许（视为 noop）| 状态单向推进，不回头 |

**反向转移一律禁止**。End 状态是吸收态（hitting 终点后再也不变）。Idle 只能被 fire 触发。这是有限状态机的"闭嘴"设计——**从起点到终点只有一条路**。

---

## 实现思路

### 数据结构：`ArrowRuntime`

一根箭头的**运行时状态**（不等于配置）：

```typescript
interface ArrowRuntime {
    mode: ArrowMoveMode;           // 当前状态
    coords: Cell[];                // 当前占据的格子（动态变化！）
    hasFailed: boolean;            // 历史上是否失败过（标红色）
}
```

- `mode`：当前状态，核心字段。
- `coords`：箭头当前的占位。`Idle` 时等于 `ArrowData.coords`；`Start` 时会随着移动不断更新（比如原来 `[[1,1],[1,2],[1,3]]`，飞了一步变 `[[1,2],[1,3],[1,4]]`）。
- `hasFailed`：曾经撞过（至少进入过 Back）。用于让这根箭头 Idle 时显示红色警告色，而不是灰色。对应 G3_FBase `ArrowComponent.failed`。

**不放进来的东西**：

- `direction`：静态配置，来自 `ArrowData`，不会变。
- `origin`：同上。
- `color`：派生值（根据 mode/hasFailed 算出），不存。

> **Linus 的品味**：**派生值不存**。color 是 (mode, hasFailed) 的函数，画的时候现算。存了就会和真实状态不一致。

### 纯函数 API

```typescript
// 查询
function canFire(rt: ArrowRuntime): boolean;
function isRunning(rt: ArrowRuntime): boolean;

// 转移
function createRuntime(data: ArrowData): ArrowRuntime;
function fire(rt: ArrowRuntime, blocked: boolean): void;
function markEnd(rt: ArrowRuntime): void;
function markCollide(rt: ArrowRuntime): void;
function markBack(rt: ArrowRuntime): void;
function resetToIdle(rt: ArrowRuntime): void;
```

**风格**：所有转移函数**就地修改 `rt` 对象**（`void` 返回），不搞"函数式返回新对象"。理由：

- 游戏逻辑里箭头就是"那一根箭头的那个对象"，复制一份再替换徒增复杂度。
- G3_FBase 的 `arrowComponent.moveMode.set(eid, ...)` 也是就地修改。一致。

---

## 代码实现

### 文件 1：`assets/scripts/core/ArrowState.ts`（新增）

```typescript
import { Cell, ArrowData } from './LevelData';

/** 箭头移动状态枚举。值的顺序与 G3_FBase.ArrowMoveMode 对齐 */
export enum ArrowMoveMode {
    Idle    = 0,
    Collide = 1,
    Back    = 2,
    Start   = 3,
    End     = 4,
}

/** 一根箭头的运行时状态 */
export interface ArrowRuntime {
    /** 当前状态 */
    mode: ArrowMoveMode;
    /** 当前占据的格子（会随 Start 移动而变） */
    coords: Cell[];
    /** 历史是否失败过 */
    hasFailed: boolean;
}

/** 把 deep clone 隔离出来，防止共享数组引用 */
function cloneCoords(src: Cell[]): Cell[] {
    return src.map(c => [c[0], c[1]]);
}

/** 从配置创建初始 runtime */
export function createRuntime(data: ArrowData): ArrowRuntime {
    return {
        mode: ArrowMoveMode.Idle,
        coords: cloneCoords(data.coords),
        hasFailed: false,
    };
}

/** 是否可以被玩家点击激发（Idle 状态才能点） */
export function canFire(rt: ArrowRuntime): boolean {
    return rt.mode === ArrowMoveMode.Idle;
}

/** 是否处于"运动中"（已激发但未结束） */
export function isRunning(rt: ArrowRuntime): boolean {
    return rt.mode === ArrowMoveMode.Start
        || rt.mode === ArrowMoveMode.Collide
        || rt.mode === ArrowMoveMode.Back;
}

/** 是否已经成功逃脱 */
export function hasEscaped(rt: ArrowRuntime): boolean {
    return rt.mode === ArrowMoveMode.End;
}

/** 激发箭头（由 InputController 调用） */
export function fire(rt: ArrowRuntime, blocked: boolean): void {
    if (rt.mode !== ArrowMoveMode.Idle) return;
    rt.mode = blocked ? ArrowMoveMode.Collide : ArrowMoveMode.Start;
}

/** 标记飞出边界，进入 End 吸收态 */
export function markEnd(rt: ArrowRuntime): void {
    if (rt.mode !== ArrowMoveMode.Start) return;
    rt.mode = ArrowMoveMode.End;
}

/** 从 Collide 进入回弹 Back */
export function markCollide(rt: ArrowRuntime): void {
    if (rt.mode !== ArrowMoveMode.Collide) return;
    rt.mode = ArrowMoveMode.Back;
    rt.hasFailed = true;
}

/** 回弹完成，回到 Idle */
export function markBack(rt: ArrowRuntime): void {
    if (rt.mode !== ArrowMoveMode.Back) return;
    rt.mode = ArrowMoveMode.Idle;
}

/** 强制重置（用于"重试"按钮） */
export function resetToIdle(rt: ArrowRuntime, data: ArrowData): void {
    rt.mode = ArrowMoveMode.Idle;
    rt.coords = cloneCoords(data.coords);
    rt.hasFailed = false;
}
```

**关键设计决策**：

1. **每个转移函数开头都有"前置状态检查"**（`if (rt.mode !== X) return;`）。这避免了外部乱调导致的状态污染。对应 Linus 说的"**消除特殊情况**"——函数要么处于正确的前置状态下执行，要么 noop 返回，没有第三种可能。

2. **`cloneCoords` 独立出来**。JS 的数组是引用传递，忘了 clone 的话 `rt.coords` 和 `data.coords` 指向同一个内存，Start 状态改了 coords 等于改了配置，下次 reset 就错乱。**边界一次性隔离**。

3. **`hasFailed` 不在重置时保留 `reset(data)` 会清零**，但注意 `markBack` 进 Idle 时**不改 hasFailed**。这是有意为之：一关里箭头撞过就永远标红，直到下一关开始重置。

### 文件 2：`GameController.ts` 加自测代码

在 `onLoad` 末尾追加一段自测：

```typescript
import {
    _decorator, Component, resources, JsonAsset, Node,
    view, screen,
} from 'cc';
import { LevelData, validateLevelData, ArrowData } from '../core/LevelData';
import { computeBoardLayout } from '../core/Coord';
import { BoardView } from './BoardView';
import {
    createRuntime, fire, markEnd, resetToIdle,
    ArrowMoveMode,
} from '../core/ArrowState';
const { ccclass } = _decorator;

@ccclass('GameController')
export class GameController extends Component {
    private levelData: LevelData | null = null;
    private boardView: BoardView | null = null;

    onLoad() {
        console.log('[Arrow] Game scene loaded. I am alive.');
        this.boardView = this.createBoardView();
        this.loadLevel(1);
        view.on('canvas-resize', this.onCanvasResize, this);

        this.stateMachineSelfTest();
    }

    // ... (loadLevel / onLevelLoaded / applyLayout / 等方法保持第 06 章的样子)

    private stateMachineSelfTest() {
        const fakeArrow: ArrowData = {
            direction: [0, 1],
            origin: [1, 3],
            coords: [[1, 1], [1, 2], [1, 3]],
        };
        const rt = createRuntime(fakeArrow);

        const lines: string[] = [];
        lines.push(`init: ${ArrowMoveMode[rt.mode]}`);      // Idle

        fire(rt, false);
        lines.push(`after fire: ${ArrowMoveMode[rt.mode]}`); // Start

        markEnd(rt);
        lines.push(`after markEnd: ${ArrowMoveMode[rt.mode]}`); // End

        resetToIdle(rt, fakeArrow);
        lines.push(`after reset: ${ArrowMoveMode[rt.mode]}`);   // Idle

        console.log('[Arrow] StateMachine self-test:\n  ' + lines.join('\n  '));
    }

    // ... 其他方法不变
}
```

**为什么不是单元测试**？

你要有 vitest/jest 环境当然可以用。但对新手来说：

- **一个 `console.log` 能看效果**就够了。
- 把它写在 `onLoad` 里，启动就跑一次，看见日志 = 通过。
- 不引入额外依赖。

**这是 G3_FBase 没做的事**：参考项目缺少这种"自测日志"，新人接手只能盯着 136 个 Logic 试图拼出完整行为。我们一开始就写自测，以后每加一个转移都可以往这里补一行，永远可见。

---

## 运行效果

预览，Console：

```
[Arrow] Game scene loaded. I am alive.
[Arrow] StateMachine self-test:
  init: Idle
  after fire: Start
  after markEnd: End
  after reset: Idle
[Arrow] Level loaded: 5 x 5, arrows = 3
[Arrow] BoardView rendered: 9 dots, 3 arrows
[Arrow] Layout applied: ...
```

**画面没变化**。这一章纯逻辑，不影响画面。

---

## 易错点

### 易错 1：状态值随便改，导致 `< Start` 判断失效

```typescript
enum ArrowMoveMode {
    Idle, Start, Collide, Back, End  // ❌ 随便排序
}
```

结果：`mode < Start` 的胜负判断逻辑全错。`Start` 现在是值 1，意思变成"Idle 不算没开始，Idle 也算开始了"，胜利条件瞬间乱掉。

**规则**：**枚举值的顺序有语义时必须显式标明数字**（`Idle = 0` 这种写法）。代码风格上也更明确"有语义"。

### 易错 2：数组直接赋值不克隆

```typescript
return { ..., coords: data.coords };   // ❌ 共享引用
```

把配置 `coords` 和运行时 `coords` 连一根线，运行时一改配置就污染。后面 reset 会失败。

**规则**：**跨越"配置/运行时"边界的对象必须深拷贝一次**。写在一个 `cloneCoords` 函数里集中管理。

### 易错 3：转移函数不检查前置状态

```typescript
export function markEnd(rt: ArrowRuntime): void {
    rt.mode = ArrowMoveMode.End;   // ❌ 随便让谁都能变 End
}
```

结果：可能从 Idle 直接跳到 End，胜负判定立刻乱（End 算胜利）。

**规则**：**转移函数开头先判断**"当前状态是不是允许发生这个转移"，否则 noop。**这是状态机的灵魂。**

### 易错 4：`ArrowMoveMode[rt.mode]` 这种反射用法在 `const enum` 里不工作

```typescript
export const enum ArrowMoveMode { ... }   // ❌ 运行时会被内联成数字
console.log(ArrowMoveMode[rt.mode]);      // undefined
```

我们这里用的是 `enum` 不是 `const enum`。如果哪天手贱加了 `const`，`ArrowMoveMode[0]` 这种反向查 name 的调试日志会全失效。

**规则**：**想要用 `Enum[value]` 查名字的，必须是 `enum` 不能是 `const enum`**。

### 易错 5：`hasFailed` 在 `markBack` 里清零

```typescript
export function markBack(rt: ArrowRuntime): void {
    if (rt.mode !== ArrowMoveMode.Back) return;
    rt.mode = ArrowMoveMode.Idle;
    rt.hasFailed = false;   // ❌ 不该清
}
```

结果：箭头撞过又回弹回来 Idle 后，颜色从红变回灰，玩家以为这是根没碰过的新箭头。**和 G3_FBase 行为不一致，且游戏反馈错误**。

**规则**：`hasFailed` 一关内不可逆，只有 `resetToIdle`（重试关卡）才能重置。

---

## 扩展练习

1. **补全 markCollide/markBack 自测**：在 `stateMachineSelfTest` 里扩展一个测试链路：`fire(rt, true)` → `markCollide` → `markBack`，验证最终状态回到 Idle 且 `hasFailed === true`。

2. **写 fail case**：构造一个 Idle 状态的 rt，直接调 `markEnd`。预期 mode 仍然是 Idle（因为前置检查 fail）。验证"转移前置检查"确实起作用了。

3. **进阶**：用 TypeScript 模板字面量类型约束状态转移。定义 `type AllowedTransition = 'Idle→Start' | 'Idle→Collide' | 'Start→End' | 'Collide→Back' | 'Back→Idle';`，写一个 `transition(from, to)` 函数，类型层面就阻止非法转移。
   
   这是在 TS 类型系统里"把状态图写成类型"，比运行时判断更早发现错误。

---

**本章结束时的工程状态**：

```
assets/scripts/
├── core/
│   ├── LevelData.ts
│   ├── Coord.ts
│   └── ArrowState.ts            ← 新增
├── common/Config.ts
└── game/
    ├── ArrowView.ts
    ├── BoardView.ts
    └── GameController.ts         ← 加了自测
```

下一章：**08 · 点击箭头 → 触发状态转移** —— 把状态机和画面接起来，第一次让"用户操作"改变"游戏状态"。
