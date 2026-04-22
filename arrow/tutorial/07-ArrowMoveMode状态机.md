# 07 · ArrowMoveMode 状态机（纯逻辑）

## 本节目标

**为每一根箭头定义一个 5 态状态机，用纯 TypeScript 写完**，不碰 Cocos。

本章结束时：

- 新增 1 个文件 `assets/scripts/core/ArrowState.ts`，里面有：
  - `ArrowMoveMode` 枚举（5 个状态）
  - `ArrowRuntime` 接口（运行时状态）
  - `createRuntime / canFire / isRunning / hasEscaped` 查询函数
  - `fire / markEnd / markCollide / markBack / resetToIdle` 5 个转移函数
- 在 `GameController.onLoad` 末尾跑一段自测，Console 打印：

  ```
  [Arrow] StateMachine self-test:
    init:                Idle
    after fire(blocked): Collide
    after markCollide:   Back
    after markBack:      Idle
    after fire(false):   Start
    after markEnd:       End
    after resetToIdle:   Idle
  ```

一句话：**把游戏规则先用纯逻辑写清楚，和 Cocos 解耦**。

---

## 需求分析

### 为什么先写状态机

> "Bad programmers worry about the code. Good programmers worry about data structures." — Linus

这句话本章全面生效。

**整根箭头的"行为"其实只是 5 种状态之间的跳转**。把这 5 种状态和跳转规则先用 TypeScript 写死，后面所有章节（触摸、移动、碰撞、回弹、胜利）只是在**驱动**它，不再修改它。

**纯逻辑的 3 个理由**：

1. **可独立验证**。一段 `console.log` 就能自测，不用启动 Cocos、不用点鼠标。
2. **不污染画面**。ArrowView 只管"看状态显颜色"，不判断规则。
3. **可移植**。今天是 Cocos 3.8，明天换任何引擎，这段 core 代码一行不用改。

### 5 个状态的含义

```typescript
enum ArrowMoveMode {
    Idle    = 0,   // 空闲：等玩家点，显示浅色
    Collide = 1,   // 撞击中：点了但前方有阻挡，显示红色
    Back    = 2,   // 回弹中：撞完了往回倒，显示红色
    Start   = 3,   // 飞行中：沿方向匀速飞，显示蓝色
    End     = 4,   // 已逃脱：飞出棋盘成功
}
```

**为什么显式写出 `= 0, = 1, ...`**？

枚举值的**数字顺序**在将来某些章节里会被直接拿来比大小（例如"还没成功发射"= `mode < Start`）。**有语义的枚举必须显式标数字**，否则有人随手改顺序就会把全套游戏判定改错。本章不用这个特性，先在这里立规矩。

### 状态转移图

```
          ┌──────────────┐
          │  Idle (0)    │◄────────────┐
          └──┬───────────┘             │
             │ fire(blocked=false)     │ markBack()
             │                          │
     ┌───────▼──────┐                   │
     │  Start (3)   │                   │
     └──┬───────────┘                   │
        │ markEnd()                     │
        ▼                               │
     ┌───────────┐                      │
     │  End (4)  │                      │
     └───────────┘                      │
                                        │
     Idle ──fire(blocked=true)──► Collide ──markCollide──► Back
```

**转移规则表**：

| 当前 | 事件 | 下一状态 |
|------|------|----------|
| Idle | `fire(rt, false)`（畅通） | Start |
| Idle | `fire(rt, true)`（有挡） | Collide |
| Start | `markEnd()` | End |
| Collide | `markCollide()` | Back |
| Back | `markBack()` | Idle（同时 `hasFailed = true` 已在上一步打下） |
| 其他 | 任何转移 | 不允许（视为 noop） |

**反向转移一律禁止**。End 是吸收态（再也不变）。**这是有限状态机的"闭嘴"设计——状态只朝一个方向推进**。

---

## 实现思路

### 数据结构：`ArrowRuntime`

本章 `ArrowRuntime` **只存两个字段**：

```typescript
interface ArrowRuntime {
    mode: ArrowMoveMode;   // 当前状态
    hasFailed: boolean;    // 历史上是否失败过（进入过 Back）
}
```

- `mode`：当前状态，核心字段。
- `hasFailed`：标记"这根箭头撞过"，用来让它在 Idle 时显示红色警告色。

**为什么只有这两个**？

因为**本章只负责"状态跳转"这一件事**。箭头的位置（`coords`）在第 09 章贪吃蛇移动时才需要动态维护，到时候再加进来。现在加进来，本章用不到，只是个摆设，还容易让新手以为"写状态机要写位置"。

> **Linus 的品味**：**每章只引入当章用得到的字段**。用不到的不先挖坑。

**派生值不存**（这一条规则要立下来）：

- `direction` 永远从 `ArrowData` 里读，不复制进 runtime。
- `color` 在画面层按 `(mode, hasFailed)` 现算，不存。

### 转移函数的 API 风格

所有转移函数**就地修改 `rt` 对象**（`void` 返回），不返回新对象。理由：

- 游戏里一根箭头就是"那一个对象"，全程持有引用，没必要复制换新。
- 可以在每个函数开头加一句"前置状态检查"，不满足就 `return`（noop），**不会抛异常**。

---

## 代码实现

### 文件 1：`assets/scripts/core/ArrowState.ts`（新增）

```typescript
import { ArrowData } from './LevelData';

/** 箭头移动状态枚举。数字值有语义，不可随意改顺序 */
export enum ArrowMoveMode {
    Idle    = 0,
    Collide = 1,
    Back    = 2,
    Start   = 3,
    End     = 4,
}

/** 一根箭头的运行时状态（本章版本）*/
export interface ArrowRuntime {
    mode: ArrowMoveMode;
    hasFailed: boolean;
}

/** 从配置创建初始 runtime */
export function createRuntime(_data: ArrowData): ArrowRuntime {
    return {
        mode: ArrowMoveMode.Idle,
        hasFailed: false,
    };
}

/** 是否可以被玩家点击激发（Idle 才可点） */
export function canFire(rt: ArrowRuntime): boolean {
    return rt.mode === ArrowMoveMode.Idle;
}

/** 是否处于"运动中"（已激发但未结束） */
export function isRunning(rt: ArrowRuntime): boolean {
    return rt.mode === ArrowMoveMode.Start
        || rt.mode === ArrowMoveMode.Collide
        || rt.mode === ArrowMoveMode.Back;
}

/** 是否已成功逃脱 */
export function hasEscaped(rt: ArrowRuntime): boolean {
    return rt.mode === ArrowMoveMode.End;
}

/** 激发箭头。blocked=true 表示前方有挡，进 Collide；否则进 Start */
export function fire(rt: ArrowRuntime, blocked: boolean): void {
    if (rt.mode !== ArrowMoveMode.Idle) return;
    rt.mode = blocked ? ArrowMoveMode.Collide : ArrowMoveMode.Start;
}

/** 飞出边界，Start → End */
export function markEnd(rt: ArrowRuntime): void {
    if (rt.mode !== ArrowMoveMode.Start) return;
    rt.mode = ArrowMoveMode.End;
}

/** 撞击完成，Collide → Back（同时首次标记失败）*/
export function markCollide(rt: ArrowRuntime): void {
    if (rt.mode !== ArrowMoveMode.Collide) return;
    rt.mode = ArrowMoveMode.Back;
    rt.hasFailed = true;
}

/** 回弹完成，Back → Idle。注意 hasFailed 不清零 */
export function markBack(rt: ArrowRuntime): void {
    if (rt.mode !== ArrowMoveMode.Back) return;
    rt.mode = ArrowMoveMode.Idle;
}

/** 强制重置到初始 Idle（用于"重试"按钮）*/
export function resetToIdle(rt: ArrowRuntime, _data: ArrowData): void {
    rt.mode = ArrowMoveMode.Idle;
    rt.hasFailed = false;
}
```

**每个函数的三条规则**（Linus 式）：

1. **开头一句前置检查**：`if (rt.mode !== X) return;`。**不满足就 noop**，外部随便乱调也不会崩，也不会把状态带错。这就是"消除特殊情况"：要么转移成功、要么什么都不做，没有第三种结果。
2. **就地改**：直接 `rt.mode = ...`，不 clone、不返回。
3. **每个函数只管一件事**：`markCollide` 只负责 Collide→Back + 打 hasFailed；**不**顺便通知画面、**不**减 HP、**不**播音效。这些在后续章节由 GameController 串起来。

> 💡 **`_data` 参数**为什么现在就留着？  
> 第 09 章 `createRuntime` / `resetToIdle` 需要从 `data.coords` 初始化位置。本章用不到，但把参数位先占好，09 章扩展时调用方**一行都不用改**。这是"不破坏调用方"。

### 文件 2：在 `GameController.onLoad` 末尾加自测

当前的 `GameController.ts`（第 05 章完成态）长这样：

```typescript
onLoad() {
    this.boardView = this.createBoardView();
    this.loadLevel(1);
}
```

**只加一行调用 + 一个自测方法**，其它原样不动：

```typescript
import {
    ArrowMoveMode, createRuntime, fire, markEnd,
    markCollide, markBack, resetToIdle,
} from '../core/ArrowState';
import { ArrowData } from '../core/LevelData';

// ... class GameController 其余字段保留 ...

onLoad() {
    this.boardView = this.createBoardView();
    this.loadLevel(1);
    this.stateMachineSelfTest();
}

private stateMachineSelfTest() {
    const fakeArrow: ArrowData = {
        direction: [0, 1],
        origin: [1, 3],
        coords: [[1, 1], [1, 2], [1, 3]],
    };
    const rt = createRuntime(fakeArrow);
    const lines: string[] = [];
    const step = (label: string) => {
        const pad = label.padEnd(20, ' ');
        lines.push(`${pad} ${ArrowMoveMode[rt.mode]}`);
    };

    step('init:');

    fire(rt, true);              // Idle → Collide
    step('after fire(blocked):');

    markCollide(rt);             // Collide → Back
    step('after markCollide:');

    markBack(rt);                // Back → Idle
    step('after markBack:');

    fire(rt, false);             // Idle → Start
    step('after fire(false):');

    markEnd(rt);                 // Start → End
    step('after markEnd:');

    resetToIdle(rt, fakeArrow);  // → Idle
    step('after resetToIdle:');

    console.log('[Arrow] StateMachine self-test:\n  ' + lines.join('\n  '));
    console.log('[Arrow] hasFailed after cycle =', rt.hasFailed);
}
```

**这段自测的 3 个设计点**：

1. **覆盖全部 5 条转移**：`fire(blocked) / markCollide / markBack / fire(false) / markEnd`，外加一次 `resetToIdle`。本章声明的所有转移都在日志里走了一遍。
2. **`padStart` 的反面**：用 `padEnd(20, ' ')` 让每行输出对齐，Console 好读。
3. **同时打印 `hasFailed`**：验证"`markCollide` 设置 hasFailed，之后的 `markBack / fire / markEnd / resetToIdle` 都不会清掉它"——除非 `resetToIdle` 走完。把这个行为绑在自测里，将来不小心改坏了能立刻发现。

> **为什么不写单元测试（Jest/Vitest）**？  
> 引入测试框架 = 引入一堆依赖。对单人学习项目，一个 `console.log` 开预览就能看，足够。项目规模上了百人再讨论要不要加测试框架。

---

## 运行效果

保存、预览，F12 打开 Console，你应该看到：

```
[Arrow] Level loaded: 5 x 5, arrows = 3
[Arrow] StateMachine self-test:
  init:                Idle
  after fire(blocked): Collide
  after markCollide:   Back
  after markBack:      Idle
  after fire(false):   Start
  after markEnd:       End
  after resetToIdle:   Idle
[Arrow] hasFailed after cycle = false
```

**画面不变化**。这一章纯逻辑，不改画面任何东西。

> `Level loaded` 和 `StateMachine self-test` 的顺序可能颠倒（因为 `loadLevel` 是异步的，自测是同步的）。**这不是 bug**：自测用的是 `fakeArrow`，和真实关卡数据无关，任何顺序都能正确跑完。

---

## 易错点

### 易错 1：转移函数不做前置检查

```typescript
export function markEnd(rt: ArrowRuntime): void {
    rt.mode = ArrowMoveMode.End;   // ❌ 任何状态都能跳到 End
}
```

结果：可能从 Idle 直接跳到 End，胜负判定乱（End 算逃脱成功）。

**规则**：每个转移函数开头判断当前 mode 是否允许本次转移，不允许就 noop 返回。**这是状态机的灵魂**。

### 易错 2：枚举值随便排序，不显式写数字

```typescript
enum ArrowMoveMode {
    Idle, Start, Collide, Back, End  // ❌ 值自动变成 0,1,2,3,4
}
```

本章你感觉不到问题，因为自测只用枚举名（`ArrowMoveMode[rt.mode]`）。但第 15 章要用 `mode < Start` 判断"还没成功发射"，那时候 `Start` 的值就**必须是 3**。顺序一改就全错。

**规则**：**有语义的枚举显式标数字**，`Idle = 0, Collide = 1, ...`。

### 易错 3：`hasFailed` 在 `markBack` 里清零

```typescript
export function markBack(rt: ArrowRuntime): void {
    if (rt.mode !== ArrowMoveMode.Back) return;
    rt.mode = ArrowMoveMode.Idle;
    rt.hasFailed = false;   // ❌ 不该清
}
```

结果：箭头撞完回弹到 Idle，颜色从红变回浅色，玩家以为是根"没撞过"的新箭头。

**规则**：`hasFailed` 一关内**不可逆**，只有 `resetToIdle`（重试整关）才能清零。

### 易错 4：自测写在 `onLevelLoaded` 里

```typescript
private onLevelLoaded(data: LevelData) {
    // ...
    this.stateMachineSelfTest();  // ❌
}
```

这样自测会在关卡加载**之后**跑。看起来没错，但如果 `resources.load` 失败，自测永远跑不到，你就发现不了状态机写错了。

**规则**：**纯逻辑自测和关卡加载解耦**。写在 `onLoad` 里，开场就跑一次，任何资源问题都不影响它。

---

## 扩展练习

1. **加一条"非法转移"测试**：在自测里，Idle 状态直接调 `markEnd(rt)`，再 `step('illegal markEnd:')`，期望日志里还是 `Idle`（前置检查 noop）。这条能验证你第 1 条规则没忘写。

2. **把自测封装成可复用函数**：把 `stateMachineSelfTest` 从 `GameController` 里搬到 `core/ArrowState.ts` 末尾，导出一个 `runSelfTest(): string[]` 返回日志行。`GameController` 只负责调它打印。这样状态机模块本身也能独立被其他地方自测。

3. **思考题**：`resetToIdle` 现在不检查 `rt.mode`，任何状态都能 reset。这到底是 bug 还是特性？提示——对比 `markEnd` 的前置检查，你会发现"重试整关"和"状态跳转"的语义不一样。

---

## 本章结束时的工程状态

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
    └── GameController.ts         ← 仅在 onLoad 末尾加一行自测调用
```

下一章：**08 · 点击箭头 → 触发状态转移** —— 把状态机和画面接起来，第一次让"用户操作"改变"游戏状态"。
