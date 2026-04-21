# 09 · Start 状态：让箭头飞起来

## 本节目标

**点击一根箭头后，它真的沿方向匀速移动**，离开原位，保持线条+箭头头的样子。暂时不处理"飞出边界"的问题（下一章）。

预期：

- 点击箭头 0 → 变蓝 → 缓慢向右移动。
- 移动速度恒定。
- 移动过程中可以继续点击其他箭头，各自分别运动。
- 不会崩溃，不会鬼畜。

一句话：**把"状态"驱动成"动画"**。

---

## 需求分析

### "移动"到底是什么

回到数据：箭头的位置由 `ArrowRuntime.coords` 决定。**coords 变 → ArrowView.refresh 重画 → 视觉上就"动了"**。

不需要 Tween 缓动、不需要物理引擎、不需要任何复杂东西。**每帧把 coords 往前推一点，就是匀速移动**。

### "coords" 是格子坐标（整数），怎么连续移动？

问题来了：coords 是 `[1, 1]` 这种整数格子。想要"匀速移动 30 像素"怎么表达？

**两种思路**：

1. **用浮点数格子坐标**。`[1.0, 1.3]` 表示"在第 1 行、第 1.3 列"。缺点：整个项目原本假设整数，需要一堆特判。
2. **每根箭头加一个 `progress` 字段**（0~1），记录"从当前 coords 再往前走了多少"。渲染时按 progress 偏移。

**选方案 2**。理由：

- 配置数据（`ArrowData.coords`）保持整数，不污染。
- `ArrowRuntime.coords` 仍然是整数，随移动一格一格更新。
- `progress` 表示"走到下一格的百分之几"。到 1.0 时就"落格"——coords 整体前移一位。

这和 G3_FBase 的做法本质一样：那里的 `arrowsMove[arrowIndex] = {pos: 0, time: 0}`，`pos` 就是我们的 progress，`time` 是累计时间。

### "每帧"的节奏

Cocos 3.8 的 Component 有 `update(dt: number)` 生命周期方法，每帧自动调一次，`dt` 是距离上一帧的秒数（约 `1/60 = 0.0167`）。

**哪个组件 update？**

选项 A：`ArrowView.update`（每根箭头自己维护 progress）。
选项 B：`GameController.update`（集中管理所有箭头）。

**选 B**。理由：

- progress 属于"游戏状态"，归 GameController 管。对应 G3_FBase 的 `MovingStartLogic` 响应 `MovingStartSignal` 每帧触发。
- ArrowView 不应该持有状态数据。
- 如果将来要做"所有箭头同步飞"这种效果，在 GameController 里方便。

---

## 实现思路

### 数据结构扩展

`ArrowRuntime` 加一个字段：

```typescript
interface ArrowRuntime {
    mode: ArrowMoveMode;
    coords: Cell[];
    hasFailed: boolean;
    /** Start 状态下的"前进进度"，0~1。等于 1 时落格并重置为 0 */
    progress: number;
}
```

### 每帧更新逻辑

```typescript
function tickStart(rt: ArrowRuntime, direction: Direction, dt: number, speed: number) {
    if (rt.mode !== ArrowMoveMode.Start) return;

    rt.progress += speed * dt;

    while (rt.progress >= 1) {
        rt.progress -= 1;
        // 前移一格：每个 coord 往方向加 1 格
        rt.coords = rt.coords.map(([r, c]) => [r + direction[0], c + direction[1]]);
    }
}
```

**关键点**：

- **用 `while` 不用 `if`**。如果 dt 异常大（比如页面切回来），一帧可能跨多格。while 能一次性吃掉所有整格，不会出现"落格延迟"的 bug。对应 Linus 的"**消除特殊情况**"——大 dt 和小 dt 一样处理。
- **`speed` 单位是"每秒几格"**。默认 `speed = 5` 意味着 5 格/秒，0.2 秒走一格。参考 G3_FBase 的 `ArrowConfig.moveSpeedMax = 1.2`，具体数值可调。
- **前移一格 = 每个 coord 都 +direction**。coords 整体平移，形状不变。

### 渲染适配"进度"

ArrowView 原本 `drawArrow` 是按 coords 整数画。现在要在 coords 基础上叠加 progress 偏移：

```typescript
const offsetR = direction[0] * rt.progress;
const offsetC = direction[1] * rt.progress;
// 画线时，tail 和 head 都加这个偏移
const tailPx = gridToPixel(tail[0] + offsetR, tail[1] + offsetC, rows, cols);
const headPx = gridToPixel(head[0] + offsetR, head[1] + offsetC, rows, cols);
```

`gridToPixel` 用的是乘法，接受浮点数输入没问题。

---

## 代码实现

### 文件 1：`core/ArrowState.ts` 加 `progress` 字段和 `tickStart` 函数

```typescript
import { Cell, ArrowData, Direction } from './LevelData';

export enum ArrowMoveMode { Idle = 0, Collide = 1, Back = 2, Start = 3, End = 4 }

export interface ArrowRuntime {
    mode: ArrowMoveMode;
    coords: Cell[];
    hasFailed: boolean;
    /** Start/Back 状态下的推进进度（0~1） */
    progress: number;
}

function cloneCoords(src: Cell[]): Cell[] {
    return src.map(c => [c[0], c[1]] as Cell);
}

export function createRuntime(data: ArrowData): ArrowRuntime {
    return {
        mode: ArrowMoveMode.Idle,
        coords: cloneCoords(data.coords),
        hasFailed: false,
        progress: 0,
    };
}

export function canFire(rt: ArrowRuntime): boolean {
    return rt.mode === ArrowMoveMode.Idle;
}

export function isRunning(rt: ArrowRuntime): boolean {
    return rt.mode === ArrowMoveMode.Start
        || rt.mode === ArrowMoveMode.Collide
        || rt.mode === ArrowMoveMode.Back;
}

export function hasEscaped(rt: ArrowRuntime): boolean {
    return rt.mode === ArrowMoveMode.End;
}

export function fire(rt: ArrowRuntime, blocked: boolean): void {
    if (rt.mode !== ArrowMoveMode.Idle) return;
    rt.mode = blocked ? ArrowMoveMode.Collide : ArrowMoveMode.Start;
    rt.progress = 0;
}

export function markEnd(rt: ArrowRuntime): void {
    if (rt.mode !== ArrowMoveMode.Start) return;
    rt.mode = ArrowMoveMode.End;
    rt.progress = 0;
}

export function markCollide(rt: ArrowRuntime): void {
    if (rt.mode !== ArrowMoveMode.Collide) return;
    rt.mode = ArrowMoveMode.Back;
    rt.hasFailed = true;
    rt.progress = 0;
}

export function markBack(rt: ArrowRuntime): void {
    if (rt.mode !== ArrowMoveMode.Back) return;
    rt.mode = ArrowMoveMode.Idle;
    rt.progress = 0;
}

export function resetToIdle(rt: ArrowRuntime, data: ArrowData): void {
    rt.mode = ArrowMoveMode.Idle;
    rt.coords = cloneCoords(data.coords);
    rt.hasFailed = false;
    rt.progress = 0;
}

/**
 * 每帧推进 Start 状态的箭头。
 * @param rt        箭头运行时
 * @param direction 箭头方向（来自 ArrowData）
 * @param dt        帧间隔（秒）
 * @param speed     速度（格/秒）
 */
export function tickStart(
    rt: ArrowRuntime, direction: Direction, dt: number, speed: number,
): void {
    if (rt.mode !== ArrowMoveMode.Start) return;
    rt.progress += speed * dt;
    while (rt.progress >= 1) {
        rt.progress -= 1;
        rt.coords = rt.coords.map(([r, c]) => [r + direction[0], c + direction[1]] as Cell);
    }
}
```

**关键变化**：

- **所有转移函数都重置 `progress = 0`**。每次状态切换从头算。
- **`tickStart` 是本章新增**。每帧被 GameController 调用一次。

### 文件 2：`common/Config.ts` 加速度配置

```typescript
export const Config = {
    gap: 100,
    pointSize: 12,
    arrowLineWidth: 10,
    arrowHeadSize: 24,
    /** Start 状态下箭头的速度（格/秒）。取中等值，新手可见 */
    arrowSpeed: 5,
} as const;
```

### 文件 3：`ArrowView.ts` 支持带 progress 的渲染

在 `drawArrow` 里加上 progress 偏移：

```typescript
private drawArrow(rt: ArrowRuntime) {
    const g = this.graphics!;
    g.clear();

    const { direction } = this.data!;
    const coords = rt.coords;
    if (coords.length === 0) return;

    // 移动进度：Start 状态下按 progress 位置内插
    const offR = direction[0] * rt.progress;
    const offC = direction[1] * rt.progress;

    const color = this.pickColor(rt);
    const tail = coords[0];
    const head = coords[coords.length - 1];
    const tailPx = gridToPixel(tail[0] + offR, tail[1] + offC, this.rows, this.cols);
    const headPx = gridToPixel(head[0] + offR, head[1] + offC, this.rows, this.cols);

    const pdx = direction[1];
    const pdy = -direction[0];

    g.strokeColor = color;
    g.lineWidth = Config.arrowLineWidth;
    g.moveTo(tailPx.x, tailPx.y);
    g.lineTo(headPx.x, headPx.y);
    g.stroke();

    const s = Config.arrowHeadSize;
    const nx = -pdy, ny = pdx;
    const tipX  = headPx.x + pdx * s, tipY  = headPx.y + pdy * s;
    const leftX = headPx.x + nx * s / 2, leftY = headPx.y + ny * s / 2;
    const rightX = headPx.x - nx * s / 2, rightY = headPx.y - ny * s / 2;

    g.fillColor = color;
    g.moveTo(tipX, tipY);
    g.lineTo(leftX, leftY);
    g.lineTo(rightX, rightY);
    g.close();
    g.fill();
}
```

**只改动了 `tailPx` / `headPx` 的计算**，其他一字不变。

### 文件 4：`GameController.ts` 加 `update`

```typescript
import {
    _decorator, Component, resources, JsonAsset, Node, view, screen,
} from 'cc';
import { LevelData, validateLevelData } from '../core/LevelData';
import { computeBoardLayout } from '../core/Coord';
import { BoardView } from './BoardView';
import {
    createRuntime, fire, canFire, tickStart,
    ArrowRuntime, ArrowMoveMode,
} from '../core/ArrowState';
import { InputController } from './InputController';
import { Config } from '../common/Config';
const { ccclass } = _decorator;

@ccclass('GameController')
export class GameController extends Component {
    private levelData: LevelData | null = null;
    private boardView: BoardView | null = null;
    private input: InputController | null = null;
    private runtimes: ArrowRuntime[] = [];

    onLoad() { /* 和第 08 章一致 */ }
    onDestroy() { /* 和第 08 章一致 */ }

    // ... loadLevel / onLevelLoaded / onArrowClick 等不变 ...

    update(dt: number) {
        if (!this.levelData) return;
        let dirty = false;
        for (let i = 0; i < this.runtimes.length; i++) {
            const rt = this.runtimes[i];
            if (rt.mode !== ArrowMoveMode.Start) continue;
            tickStart(rt, this.levelData.arrows[i].direction, dt, Config.arrowSpeed);
            this.refreshArrow(i);
            dirty = true;
        }
        // dirty 字段这里暂不用，保留占位，第 14 章 HUD 会看
    }

    // ... refreshAllArrows / refreshArrow / applyLayout 等不变 ...
}
```

**注意**：

- **`update` 只关心 Start 状态**。其他状态跳过。这是一个 "O(n) 遍历 + 1 个 if" 的结构，**不需要任何调度器、事件总线、响应式框架**。对应 Linus 说的"**用最笨但最清晰的方式实现**"。
- **每次 tick 后都 `refreshArrow`**。刷新 dirty 逻辑第 14 章再优化。目前 N 很小（3~10 根箭头）无所谓。

---

## 运行效果

预览，点击箭头 0。

**画面**：箭头 0 变蓝，**开始缓慢向右移动**。以 5 格/秒的速度，5 格距离大约 1 秒走完。

**多选**：点箭头 0，等它飞一半，点箭头 1，两根同时飞。

**日志**：`[Arrow] Arrow 0 fired. mode = Start`（每次点击一次）。

目前箭头会一直飞，**飞出屏幕也不停**。下一章处理。

---

## 易错点

### 易错 1：`update(dt)` 写错签名

```typescript
update(deltaTime) { }    // ❌ 没标类型（严格模式编不过）
update() { }             // ❌ 没参数（dt 是 undefined，progress 算出 NaN）
```

**规则**：Cocos 3.8 的 `Component.update` 固定签名 `update(dt: number)`。按方法名区分大小写。

### 易错 2：progress 不清零导致初速不为 0

```typescript
export function fire(rt, blocked) {
    if (rt.mode !== ArrowMoveMode.Idle) return;
    rt.mode = ArrowMoveMode.Start;
    // rt.progress = 0;  ❌ 忘了清零
}
```

如果箭头被 reset 过又重新 fire，progress 可能残留上次的值。表现：瞬移一小段。**所有状态切换都要把 progress 清零**。

### 易错 3：用 `if` 代替 `while`

```typescript
if (rt.progress >= 1) {   // ❌ dt 巨大时会丢格
    rt.progress -= 1;
    ...
}
```

页面切后台再切回来，一次 dt 可能是 2 秒，progress 瞬间变 10。`if` 只减一次 → progress 剩 9 → 继续减 → bug 死循环。

**规则**：**累加型 progress 的消耗永远用 `while`**。

### 易错 4：用 `rt.coords.forEach` 修改元素

```typescript
rt.coords.forEach(c => { c[0] += direction[0]; });  // ❌ 改了配置数据
```

如果 `rt.coords` 里的元素是和 `data.coords` 共享引用的（忘了 clone），这么改会反污染配置。第 07 章的 `cloneCoords` 保护了**数组**本身，但**元素（每个 `[r, c]`）还是浅引用**。

**规则**：**修改 coords 时永远用 `.map(...)` 返回新数组**，不 in-place 改元素。

### 易错 5：`Config.arrowSpeed = 100` 调太大看不出动画

新手初看会用很大的值想"快点看效果"。但 speed=100 + 5 格棋盘 = 一帧跨完整个棋盘，看上去像瞬移。

**规则**：**速度调成"肉眼能看清"的水平**。5 格/秒，一格 0.2s，合适。

---

## 扩展练习

1. **加速/减速**：启动后先慢后快（或先快后慢）。提示：tickStart 里的 speed 参数替换为 `speed * f(rt.progress)` 或 `speed * f(totalTime)`。

2. **箭头飞出后变灰**：在本章末尾观察——箭头飞出屏幕仍然是蓝色，不符合"已完成"的感觉。思考一下第 10 章要怎么做（markEnd 之后什么颜色？End 对应 COLOR_MOVE 还是应该加个 COLOR_END？）。

3. **思考题**：G3_FBase 的 `MovingStartLogic` 里有一段 `moveForwardFunction(coords, velocity)` 的复杂逻辑，返回 `{newCoords, arrivedPoint}`。我们这里用 `progress + while` 完成同样的事，代码从十几行变成三行。能解释为什么更简单但功能等价吗？

---

**工程状态**：

```
core/
├── ArrowState.ts          ← 加 progress + tickStart
├── Coord.ts
└── LevelData.ts
common/
└── Config.ts              ← 加 arrowSpeed
game/
├── ArrowView.ts           ← drawArrow 支持 progress 偏移
├── BoardView.ts
├── GameController.ts      ← 加 update
└── InputController.ts
```

下一章：**10 · 飞出边界 = End 状态** —— 飞出去的箭头在边界停下，标记成功逃脱。
