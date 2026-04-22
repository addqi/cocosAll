# 09 · Start 状态：让箭头飞起来（贪吃蛇模型）

## 本节目标

**点击一根箭头后，它真的沿 coords 末端方向匀速"爬"出去，每格落一个头、丢一个尾，像贪吃蛇一样前进**。暂时不处理"飞出边界"的问题（下一章）。

预期：

- 点击箭头 0 → 它沿当前朝向缓慢前进。
- 移动过程中形状不变长度，一格一格往前爬。
- **如果 coords 本身是 L 形，前进时也能自然地"转弯"**——不用写任何转弯代码。
- 移动过程中可以继续点击其他箭头，各自分别运动。
- 不会崩溃，不会鬼畜。

一句话：**把"coords"当成贪吃蛇的身体，头进一格、尾出一格，就是匀速前进**。

---

## 为什么是"贪吃蛇"而不是"刚体平移"？

### 我们之前怎么想的

如果把"箭头前进"当成"整根箭头沿 direction 平移一格"，代码大概这样：

```typescript
rt.coords = rt.coords.map(([r, c]) => [r + direction[0], c + direction[1]]);
```

漂亮、对称、三行。直的箭头确实能用。

### 然后问题来了：L 形箭头怎么办？

看下图，一根 L 形箭头（尾在下、转角在 [3,4]、头朝右）：

```
     col 2  3  4  5
row 3    .  .  ■→
row 4    .  .  ■
row 5    .  .  ■
```

`coords = [[5,4], [4,4], [3,4], [3,5 假设]]`。你希望它怎么"前进"？

**玩家的直觉**：头继续往右爬一格，尾从 [5,4] 被拖走，整体形状开始"绕过"转角：

```
     col 2  3  4  5  6        col 2  3  4  5  6
row 3    .  .  ■  ■→     →    .  .  .  ■  ■→
row 4    .  .  ■  .           .  .  ■  .  .
row 5    .  .  .  .           .  .  .  .  .
```

这是**贪吃蛇的行为**：头领着身子走，身子跟着头爬过拐点。

### "整根平移"在这里会崩

如果坚持"整根沿 direction 平移"，direction 是多少？

- `[0, 1]`（向右）—— 尾巴会平移到 [5,5]，和屏幕上看到的"尾巴跟着身子爬"完全不符。
- 每节各自的方向？—— 那就不是一个 direction 了，成了一堆"每段的方向"，特殊情况瞬间爆炸。

这就是 Linus 说的：

> **"好代码没有特殊情况。"**
> **"如果实现需要超过 3 层缩进，重新设计它。"**

刚体平移模型到 L 形就需要特判。贪吃蛇模型，**不管 coords 是直的、L 形、Z 形、还是螺旋形，一套逻辑全覆盖**。

### 贪吃蛇的"一套逻辑"到底有多简单？

每格前进一步 = 两个操作：

1. 算出"新头"：`newHead = oldHead + dirFromLastTwo(coords)`。
2. `coords.push(newHead); coords.shift();`——头进一格，尾出一格。

完。**没有转弯代码**，因为转弯已经刻在 coords 里了——`dirFromLastTwo` 自动取 `coords[-1] - coords[-2]`，这一段是什么方向，下一格就往哪个方向走。

### 方向从哪来：从 coords 自己派生

`ArrowData.direction` 字段在 JSON 里还写着（我们**不删**，为了向后兼容和可读性），但**运行时不用它**。

```typescript
export function deriveDirection(coords: Cell[]): Direction {
    if (coords.length < 2) return [0, 0];  // 单格箭头，默认不动
    const [hr, hc] = coords[coords.length - 1];
    const [pr, pc] = coords[coords.length - 2];
    return [hr - pr, hc - pc];
}
```

**Linus 的规则：派生值不存**。方向永远可以从 coords 的最后两点 1:1 算出来——存了就可能和 coords 不一致，不存就没有这种 bug。

> 📖 **与第 07/08 章的兼容说明**：
>
> 之前章节里 `ArrowData.direction` 被当作"方向"用。从本章开始，**玩法代码一律改用 `deriveDirection(coords)`，不再读 `ArrowData.direction`**。JSON 字段保留，只当作文档和将来"初始方向提示"。**这是向前兼容，不会破坏已有关卡数据**。

---

## 实现思路

### 数据结构扩展

`ArrowRuntime` 加一个字段 `progress`，表示"当前头格和下一格之间的推进比例（0~1）"：

```typescript
interface ArrowRuntime {
    mode: ArrowMoveMode;
    coords: Cell[];       // 贪吃蛇身体，从尾到头
    hasFailed: boolean;
    progress: number;     // Start 状态下的推进进度，0~1
}
```

**为什么叫 progress 不叫"头偏移"**？因为它表达的是"头的下一步已经走了百分之几"，和 G3_FBase 的 `arrowsMove[i].pos` 同义。

### 每帧推进：头进尾出

```typescript
export function tickStart(rt: ArrowRuntime, dt: number, speed: number): void {
    if (rt.mode !== ArrowMoveMode.Start) return;
    rt.progress += speed * dt;
    while (rt.progress >= 1) {
        rt.progress -= 1;
        stepOneCell(rt);     // 头进一格、尾出一格
    }
}

function stepOneCell(rt: ArrowRuntime): void {
    const dir = deriveDirection(rt.coords);
    const [hr, hc] = rt.coords[rt.coords.length - 1];
    const newHead: Cell = [hr + dir[0], hc + dir[1]];
    rt.coords.push(newHead);
    rt.coords.shift();
}
```

**注意这里和老版本的差别**：

| 维度 | 老版本（刚体平移） | 新版本（贪吃蛇） |
|------|--------------------|------------------|
| 接口 | `tickStart(rt, direction, dt, speed)` | `tickStart(rt, dt, speed)` |
| 方向来源 | 外部传入 `ArrowData.direction` | `coords` 末端派生 |
| 每格前进 | `coords.map(+direction)` | `push(newHead); shift()` |
| L 形支持 | 崩 | 天然支持 |
| 长度是否变化 | 不变 | 不变（push + shift 数量守恒） |

**数量守恒**：push 一个、shift 一个，coords.length 永远等于初始长度。这就是"箭头不会越飞越长"的根本保证，**不靠任何显式检查**。

### 渲染：按折线画，progress 叠加在头段

`ArrowView` 原本画"一条直线 + 三角形箭头头"。现在 coords 可能是折线，要画**从 coords[0] 经过所有点到 coords[N-1] 的折线**，然后在头段附加 progress 偏移。

```typescript
// 1) 折线：coords[0] → coords[1] → ... → coords[N-1]
// 2) 最后一节按 progress 进行延伸：
//    画到的实际终点 = coords[N-1] + dir * progress
// 3) 箭头三角形画在"延伸后的终点"
```

这本质是：**折线 N-1 段正常画，最后一段画到 "head + dir*progress" 而不是 head**。

### 每帧节奏

```
GameController.update(dt):
    for rt in runtimes where mode == Start:
        tickStart(rt, dt, Config.arrowSpeed)
        refreshArrow(i)
```

`GameController.update` 是唯一的每帧调度点。ArrowView 不管时间、只管"给我当前 runtime，我按它画"。这个分工和第 07/08 章一致。

---

## 代码实现

### 文件 1：`core/ArrowState.ts` —— 删 direction 参数，加贪吃蛇推进

```typescript
import { Cell, ArrowData, Direction } from './LevelData';

export enum ArrowMoveMode { Idle = 0, Collide = 1, Back = 2, Start = 3, End = 4 }

export interface ArrowRuntime {
    mode: ArrowMoveMode;
    coords: Cell[];
    hasFailed: boolean;
    /** Start/Back 状态下头的推进进度（0~1） */
    progress: number;
}

function cloneCoords(src: Cell[]): Cell[] {
    return src.map(c => [c[0], c[1]] as Cell);
}

/** 从 coords 最后两点派生方向。单格时返回 [0,0]（不动） */
export function deriveDirection(coords: Cell[]): Direction {
    if (coords.length < 2) return [0, 0];
    const [hr, hc] = coords[coords.length - 1];
    const [pr, pc] = coords[coords.length - 2];
    return [hr - pr, hc - pc];
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

/** Start 模式下每帧推进。方向由 coords 自动派生。 */
export function tickStart(rt: ArrowRuntime, dt: number, speed: number): void {
    if (rt.mode !== ArrowMoveMode.Start) return;
    rt.progress += speed * dt;
    while (rt.progress >= 1) {
        rt.progress -= 1;
        stepOneCell(rt);
    }
}

/** 头进一格、尾出一格。支持任意折线。 */
function stepOneCell(rt: ArrowRuntime): void {
    const dir = deriveDirection(rt.coords);
    const [hr, hc] = rt.coords[rt.coords.length - 1];
    rt.coords.push([hr + dir[0], hc + dir[1]]);
    rt.coords.shift();
}
```

**关键变化清单**：

- **新增 `deriveDirection(coords)`**。单一可信方向来源。
- **`tickStart` 签名从 4 参变 3 参**。`direction` 删掉，内部自己派生。
- **`stepOneCell` 用 push/shift**。不再 map 整个数组。
- 其它状态转移函数保持不变。

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

### 文件 3：`ArrowView.ts` —— 折线渲染 + 头段 progress

核心重写 `drawArrow`。原本只画"一段直线"，现在画"N-1 段折线 + 最后一段按 progress 延伸"。

```typescript
import { Config } from '../common/Config';
import { gridToPixel } from '../core/Coord';
import { Cell } from '../core/LevelData';
import { ArrowRuntime } from '../core/ArrowState';
import { deriveDirection } from '../core/ArrowState';

// ... 组件壳 / 颜色选择逻辑保持不变 ...

private drawArrow(rt: ArrowRuntime) {
    const g = this.graphics!;
    g.clear();

    const coords = rt.coords;
    if (coords.length === 0) return;

    const color = this.pickColor(rt);
    g.strokeColor = color;
    g.lineWidth = Config.arrowLineWidth;

    // 所有格子转成像素坐标
    const points = coords.map(([r, c]) => gridToPixel(r, c, this.rows, this.cols));

    // head 段 progress 延伸：最后一段的终点 = head + dir*progress
    const dir = deriveDirection(coords);
    const headPx = points[points.length - 1];
    const tipPx = {
        x: headPx.x + dir[1] * Config.gap * rt.progress,
        y: headPx.y - dir[0] * Config.gap * rt.progress,
    };

    // 画折线：coords[0] → coords[1] → ... → coords[N-1] → tipPx
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        g.lineTo(points[i].x, points[i].y);
    }
    if (rt.progress > 0) {
        g.lineTo(tipPx.x, tipPx.y);
    }
    g.stroke();

    // 三角形箭头头画在 tipPx 上，沿 dir 方向
    this.drawArrowHead(tipPx.x, tipPx.y, dir, color);
}

private drawArrowHead(x: number, y: number, dir: [number, number], color: Color) {
    const g = this.graphics!;
    const pdx = dir[1];
    const pdy = -dir[0];
    const s = Config.arrowHeadSize;
    const nx = -pdy, ny = pdx;
    const tipX  = x + pdx * s,      tipY  = y + pdy * s;
    const leftX = x + nx * s / 2,   leftY = y + ny * s / 2;
    const rightX = x - nx * s / 2,  rightY = y - ny * s / 2;

    g.fillColor = color;
    g.moveTo(tipX, tipY);
    g.lineTo(leftX, leftY);
    g.lineTo(rightX, rightY);
    g.close();
    g.fill();
}
```

**关键点解析**：

- **`points = coords.map(gridToPixel)`**。所有格子一次性转像素，后面只管画。
- **`tipPx` 是"视觉上的头尖"**。等于 head 像素 + dir 方向上的 `gap * progress` 偏移。
  - 注意 `dir[1]` 映射到 x、`-dir[0]` 映射到 y（y 向上为正，行号向下增）。
  - **这个映射和 `gridToPixel` 的行列 → xy 规则一致**，别搞反。
- **`moveTo + lineTo * N + stroke`**。Cocos Graphics 画折线的标准姿势。
- **progress == 0 时不画延伸段**。否则会出现 `lineTo(headPx, headPx)` 的零长度段，某些驱动下末端会多一个毛刺。
- **箭头头永远画在 tipPx**。progress 为 0 时 tipPx == headPx，表现和第 08 章一致。

### 文件 4：`GameController.ts` —— 加 update

```typescript
import {
    _decorator, Component, resources, JsonAsset, Node,
} from 'cc';
import { LevelData, validateLevelData } from '../core/LevelData';
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

    onLoad() { /* 和第 08 章完全一致 */ }

    // ... loadLevel / onLevelLoaded / onArrowClick 等方法不变 ...

    update(dt: number) {
        for (let i = 0; i < this.runtimes.length; i++) {
            const rt = this.runtimes[i];
            if (rt.mode !== ArrowMoveMode.Start) continue;
            tickStart(rt, dt, Config.arrowSpeed);
            this.refreshArrow(i);
        }
    }

    // ... refreshAllArrows / refreshArrow 等不变 ...
}
```

**注意**：

- **`tickStart(rt, dt, speed)` 只 3 参**。和老教程不兼容——如果你还在用老版本 `tickStart(rt, direction, dt, speed)`，请同步改。
- **每次 tick 后 `refreshArrow`**。刷新 dirty 逻辑不做，N 很小。
- **`update` 里不读 `ArrowData`**。玩法完全由 `ArrowRuntime.coords` 驱动。这就是"数据结构先行"的收益——一个调用点，没有分支。

### 文件 5：新增 `resources/levels/level_02.json`（L 形箭头关）

为了验证贪吃蛇模型真能"转弯"，加一关 L 形：

```json
{
    "rows": 5,
    "cols": 5,
    "arrows": [
        {
            "direction": [0, 1],
            "origin": [3, 4],
            "coords": [[4, 2], [3, 2], [3, 3], [3, 4]]
        }
    ]
}
```

图示：

```
     col 1  2  3  4  5
row 1    .  .  .  .  .
row 2    .  .  .  .  .
row 3    .  ■—■—■→ .       ← coords[1..3]，向右延伸的那一段
row 4    .  ■  .  .  .    ← coords[0]，尾巴
row 5    .  .  .  .  .
```

- `coords[0] = [4,2]`：最尾部，在左下。
- `coords[1] = [3,2]`：转角。
- `coords[2] = [3,3]`、`coords[3] = [3,4]`：向右延伸，头朝右。
- `deriveDirection(coords)` 返回 `[3,4] - [3,3] = [0,1]`，等于 JSON 里写的 `direction`（保持一致）。

**点击一次会看到**：

1. 头沿 `[0,1]` 前进 → 头变成 `[3,5]`、尾 shift 成 `[3,2]`。
2. 再前进 → 头 `[3,6]`（出界，留到下一章处理）、尾 shift 成 `[3,3]`——**尾巴自然"爬过"了转角**。
3. 关键观察：**整个过程 coords 长度始终是 4**，**形状从 L 渐变成直线**，没有任何特判代码。

---

## 运行效果

### level_01（3 根直箭头）

点击箭头 0：它缓慢向右"爬"，每 0.2 秒（speed=5 格/秒）往前一格。头的像素位置平滑滑动（progress 内插），每满一格整根 coords 推进一次。

多选：点箭头 0，等它飞一半，点箭头 1，两根同时前进、互不干扰。

### level_02（1 根 L 形箭头）

把 `GameController.onLoad` 里 `this.loadLevel(1)` 临时改成 `this.loadLevel(2)`，点击那根 L：

- 开始：L 形。
- 前进 1 格：头伸到 `[3,5]`，尾拉到 `[3,2]`，L 形开始变短一点。
- 前进 2 格：头 `[3,6]`（即将出界），尾 `[3,3]`，**L 形消失、变成水平直线**。
- 之后每一格：整条直线继续向右爬，直到被下一章的边界逻辑处理。

**重点**：整个变形过程**没有任何转弯检测代码**，全部由 "push newHead + shift tail" 自然涌现。这就是好数据结构的威力。

目前箭头会一直飞、**飞出屏幕也不停**，L 形爬到变直后也不会停。下一章处理。

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
    stepOneCell(rt);
}
```

页面切后台再切回来，一次 dt 可能是 2 秒，progress 瞬间变 10。`if` 只 step 一次 → progress 剩 9 → 下一帧又加一坨，越积越多。

**规则**：**累加型 progress 的消耗永远用 `while`**。

### 易错 4：`deriveDirection` 里少了 "length < 2" 兜底

```typescript
export function deriveDirection(coords: Cell[]): Direction {
    const [hr, hc] = coords[coords.length - 1];
    const [pr, pc] = coords[coords.length - 2];  // ❌ 单格时 undefined
    return [hr - pr, hc - pc];
}
```

虽然关卡数据里不会有长度 1 的箭头，但 Back 状态回退到只剩一格的瞬间、或者极端关卡可能触发。**数据结构层永远要为"边界情况"给一个合理默认值**——这里 `[0,0]` 是安全的（下一步等于原地），总比崩强。

### 易错 5：push 完忘了 shift

```typescript
function stepOneCell(rt) {
    const [hr, hc] = rt.coords[rt.coords.length - 1];
    rt.coords.push([hr + dir[0], hc + dir[1]]);
    // rt.coords.shift();  ❌ 忘了
}
```

表现：**箭头越飞越长**，像贪吃蛇吃东西。长度守恒靠"push 必配 shift"维持，少一个就破功。

### 易错 6：用 `rt.coords.forEach` 修改元素

```typescript
rt.coords.forEach(c => { c[0] += direction[0]; });  // ❌ 改了配置数据
```

老教程（刚体平移）有这个坑，新教程里已经不用 forEach 了。保留这一条是提醒：**只要你还在修改 coords，永远用返回新数组的方式**（`push/shift` 是安全的，因为 push 的是新建的 `[r, c]`；forEach + in-place 改元素会反污染 ArrowData.coords）。

### 易错 7：`Config.arrowSpeed = 100` 调太大看不出动画

5 格棋盘 + speed=100 = 一帧跨完整个棋盘，看上去像瞬移。调成 5 格/秒，一格 0.2s，合适。

---

## 扩展练习

1. **加速/减速**：启动后先慢后快（或先快后慢）。提示：tickStart 里的 speed 参数替换为 `speed * f(rt.progress)` 或 `speed * f(totalTime)`。

2. **自定义 L 关卡**：改 level_02.json 让箭头变成 Z 形（两个转角）、U 形（三段）。**期望**：不管几段几个转角，tickStart 一行都不用改，照样跑通。

3. **箭头飞出后变灰**：在本章末尾观察——箭头飞出屏幕仍然是 Start 色，不符合"已完成"的感觉。思考一下第 10 章要怎么做（markEnd 之后什么颜色？End 对应 COLOR_MOVE 还是应该加个 COLOR_END？）。

4. **思考题**：G3_FBase 的 `MovingStartLogic` 里有一段 `moveForwardFunction(coords, velocity)`，返回 `{newCoords, arrivedPoint}`。我们这里用 `progress + while + push/shift` 完成同样的事，代码从十几行变成五行。能解释为什么更简单但功能等价吗？（提示：把"方向"从输入参数下放成"coords 的派生值"消灭了多少特殊情况？）

---

**工程状态**：

```
core/
├── ArrowState.ts          ← 加 progress + deriveDirection + tickStart + stepOneCell
├── Coord.ts
└── LevelData.ts
common/
└── Config.ts              ← 加 arrowSpeed
game/
├── ArrowView.ts           ← drawArrow 重写为折线 + progress 延伸
├── BoardView.ts
├── GameController.ts      ← 加 update
└── InputController.ts
resources/
└── levels/
    ├── level_01.json
    └── level_02.json      ← 新增 L 形箭头关
```

下一章：**10 · 飞出边界 = End 状态** —— 飞出去的箭头在边界停下，标记成功逃脱。依然基于贪吃蛇模型：**头的下一步格子如果出界，就 markEnd**。
