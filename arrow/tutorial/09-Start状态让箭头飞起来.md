# 09 · Start 状态：让箭头飞起来

## 本节目标

**点击一根箭头后，它真的沿自己方向匀速"爬"出去，每格落一个头、丢一个尾，像贪吃蛇一样前进。**
暂时不处理"飞出边界"（下一章）。

预期：

- 点击箭头 0 → 它沿当前朝向缓慢前进。
- 前进过程中形状长度不变，一格一格往前爬。
- **L 形箭头也能前进**——不需要任何转弯代码。
- 多根箭头可以同时在飞，互不干扰。

一句话：**把 coords 当成贪吃蛇的身体，头进一格、尾出一格，就是匀速前进。**

---

## 为什么是"贪吃蛇"

最朴素的想法是"整根箭头沿 direction 平移"：

```typescript
rt.coords = rt.coords.map(([r, c]) => [r + dr, c + dc]);
```

直线箭头能用。**但 L 形 `[[4,2],[3,2],[3,3],[3,4]]` 会崩**——整体平移后尾巴飘到 `[4,3]`，和"尾巴沿着身子爬过转角"的视觉预期完全不符。

**贪吃蛇模型**：

1. 算头的下一步位置 `newHead = head + dir`。
2. `coords.push(newHead); coords.shift();`——头进一格、尾出一格。

`dir` **从 coords 末尾两格派生**：

```typescript
dir = coords[last] - coords[last-1]
```

这样不管 coords 是直线、L 形、Z 形，"头进尾出"都是同一段代码。**转弯信息已经在 coords 里，不用再写一遍。**

> **Linus 的品味**：好代码没有特殊情况。L 形 / 直线 / Z 形共用一套逻辑，不是因为我们聪明，而是因为**方向这个"派生值"不存了**，从源头消除了歧义。

---

## 要改什么

做 3 件小事、1 个验证：

| 步骤 | 文件 | 改动 |
|---|---|---|
| 1 | `common/Config.ts` | 加一个 `arrowSpeed` 配置 |
| 2 | `core/ArrowState.ts` | 给 `ArrowRuntime` 加 `coords` + `progress` 字段，加 `deriveDirection` / `tickStart` |
| 3 | `game/ArrowView.ts` | 画"头延伸 progress 格"的效果 |
| 4 | `game/GameController.ts` | 加一个 `update(dt)`，每帧推进所有 Start 状态的箭头 |
| 5 | 验证 | 把 `loadLevel(1)` 临时改成 `loadLevel(2)`，看 L 形能不能爬过转角 |

下面按 1→4 一个一个来，**每步先解释要干什么、再给对应代码片段**，章节末尾再给每个文件的完整代码做对照。

---

## 第 1 步：Config 加速度

### 要做的事

`tickStart` 需要一个"每秒飞多少格"的速度配置，加在 `Config` 里。

### 代码

在 `assets/scripts/common/Config.ts` 的对象里**追加一个字段**：

```typescript
/** Start 状态下箭头的速度（格/秒）。5 格/秒 = 一格 0.2s，新手能看清 */
arrowSpeed: 5,
```

### 为什么是 5

- 速度太大（比如 100）一帧就跨完整个 5 格棋盘，看上去像瞬移。
- 5 格/秒 = 一格 0.2 秒，眼睛能跟上、不无聊。
- 魔数封在 `Config` 里，以后要调手感统一改这里。

---

## 第 2 步：扩 `ArrowRuntime` + 加 `tickStart`

### 2.1 给 `ArrowRuntime` 加字段

当前的 `ArrowRuntime`（07 章）：

```typescript
export interface ArrowRuntime {
    mode: ArrowMoveMode;
    hasFailed: boolean;
}
```

**加两个字段**：

```typescript
export interface ArrowRuntime {
    mode: ArrowMoveMode;
    hasFailed: boolean;
    /** 当前占据的格子（随前进动态变化，和 ArrowData.coords 解耦）*/
    coords: Cell[];
    /** Start 状态下的推进累计量（单位：格）。每累加满 1 格就真的移动一次 */
    progress: number;
}
```

注意 `Cell` 要从 `./LevelData` import 进来。

**为什么要 `coords` 字段**：

07 章 runtime 只有 `mode + hasFailed`。08 章点击判定用的是**静态**的 `ArrowData.coords`——那时候够用，因为箭头不动。**但从这一章开始箭头要真的动了**，它的占位必须和配置解耦：配置是关卡初始状态、**runtime 是"它现在在哪里"**。所以要单独一份 coords。

**为什么要 `progress` 字段**：

帧率是变的（30~60 fps），我们不能"每帧就往前一格"——那样高帧率箭头飞得快、低帧率飞得慢。正确做法是"**每帧累加 `speed * dt`**，累够 1 就移动一格"。这个累加量就是 `progress`。

> **progress 的单位是"格"，不是"0~1"**。当它 ≥ 1 时代表"我已经攒够一格了，该真的移动一次"。

### 2.2 `createRuntime` 初始化新字段

07 章的 `createRuntime` 只填了 2 个字段，现在要填 4 个：

```typescript
export function createRuntime(data: ArrowData): ArrowRuntime {
    return {
        mode: ArrowMoveMode.Idle,
        hasFailed: false,
        coords: data.coords.map(c => [c[0], c[1]] as Cell),  // 深拷贝一次
        progress: 0,
    };
}
```

**关键**：`coords` 用 `.map(c => [c[0], c[1]])` **深拷贝一次**，不能直接 `data.coords`。否则 runtime 改 coords 会**反向污染配置**，下次重置关卡就全乱了。

### 2.3 加 `deriveDirection`

方向不存字段、每次从 coords 末尾两格现算：

```typescript
import { Cell, ArrowData, Direction } from './LevelData';

/** 从 coords 最后两点派生方向。单格时返回 [0,0]（不动） */
export function deriveDirection(coords: Cell[]): Direction {
    if (coords.length < 2) return [0, 0];
    const [hr, hc] = coords[coords.length - 1];
    const [pr, pc] = coords[coords.length - 2];
    return [hr - pr, hc - pc];
}
```

`Direction` 也要从 `./LevelData` 补进 import。

**`length < 2` 的兜底**：我们目前的关卡里不会有单格箭头，但以后某些边界情况（例如 Back 状态回到只剩一格）可能出现。**在数据结构层给一个安全默认值**，总比崩强。

### 2.4 加 `tickStart`

每帧由 `GameController.update` 调一次：

```typescript
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

3 个设计点：

- **前置检查 `rt.mode !== Start`**。非 Start 不跑，和其他转移函数风格统一。
- **`while` 不是 `if`**。如果页面切后台再切回来，一次 dt 可能是 2 秒，progress 会瞬间累到 10。`if` 只消耗一次 → 剩下 9 格没消化 → 下一帧又累一堆，越积越多。**累加型进度永远 `while`**。
- **`stepOneCell` 独立私有函数**。`tickStart` 读起来只有"攒够一格就走一步"这一件事，步进细节下放。

### 2.5 07 章的其他转移函数**一律不改**

`fire / markEnd / markCollide / markBack / resetToIdle` 保持 07 章版本。有人可能想在这些函数里加 `rt.progress = 0`，**暂时不要**。原因：

- 本章只演示 Idle → Start → 飞起来。Start 飞完后的收尾（markEnd / markBack）10/12 章会单独做。
- **每章只改当章必需的东西**。改得越少越少出错。

如果你确实担心 progress 残留的问题（例如反复 reset 某根箭头），`resetToIdle` 里加一行 `rt.progress = 0`，够了。其他不要碰。

---

## 第 3 步：`ArrowView` 画"头延伸 progress 格"

### 要做的事

05 章 / 08 章的 `_redraw` 已经会画折线了。现在要做的只是**让头段往前多伸 `progress` 格**，这样 progress 从 0 涨到 1 的过程中头部像素是**平滑滑动**的（不是一下跳一格）。

### 改动位置

在 `ArrowView._redraw` 里，**画完原有折线之后**，如果 `rt != null && rt.progress > 0`，再延长最后一段到 `headPx + dir * gap * progress`。三角箭头画在这个延长后的终点上。

### 代码片段

改 `_redraw` 的结构如下（标出要新增/修改的行）：

```typescript
private _redraw() {
    if (!this._data || !this._graphics) {
        console.error('ArrowView: _data or _graphics is null');
        return;
    }
    const g = this._graphics;
    // 1) 决定 coords 从哪来：有 runtime 优先用 runtime（动态），否则用 data（静态初始态）
    const coords: Cell[] = this._rt ? this._rt.coords : this._data.coords;
    if (coords.length < 2) return;

    g.clear();

    const color = this._pickColor();
    const pixels: Pixel[] = coords.map(
        ([r, c]) => gridToPixel(r, c, this._rows, this._cols),
    );

    // 2) 计算"头的视觉位置"：head 像素 + progress 方向延伸
    const progress = this._rt?.progress ?? 0;
    const dr = coords[coords.length - 1][0] - coords[coords.length - 2][0];
    const dc = coords[coords.length - 1][1] - coords[coords.length - 2][1];
    const tipPx: Pixel = {
        x: pixels[pixels.length - 1].x + dc * Config.gap * progress,
        y: pixels[pixels.length - 1].y - dr * Config.gap * progress,
    };

    // 3) 画折线：pixels[0] → ... → pixels[last]（→ tipPx 如果有延伸）
    g.strokeColor = color;
    g.lineWidth = Config.arrowLineWidth;
    g.moveTo(pixels[0].x, pixels[0].y);
    for (let i = 1; i < pixels.length; i++) {
        g.lineTo(pixels[i].x, pixels[i].y);
    }
    if (progress > 0) {
        g.lineTo(tipPx.x, tipPx.y);
    }
    g.stroke();

    // 4) 三角头画在 tipPx 上
    this._drawHeadAt(g, tipPx, dr, dc, color);
}
```

关键解释：

- **优先读 `rt.coords` 而不是 `this._data.coords`**：08 章点击判定用的是 `ArrowData`，本章起**画面由 runtime 驱动**。画的位置必须是运行时位置，不然箭头看上去不动。
- **`dc * Config.gap * progress`**：`Config.gap` 是一格的像素宽度；乘 `progress`（0~1 之间的累加残余）得到视觉平滑位移。
- **`dr` → `-y`、`dc` → `+x`**：这是 `gridToPixel` 约定的行列→像素映射。记成定式。
- **`progress > 0` 才画延伸段**：progress 等于 0 时 tipPx == headPx，画 `lineTo(headPx, headPx)` 是零长线段，**Cocos 某些驱动会在这种零长段末端画出毛刺**。省掉这一笔画更稳。

`_drawHeadAt` 是原来 `_drawHead` 的改版——只是把"用哪个点、用什么方向"显式传进来，不再从 coords 里自取。原来的版本可以直接改签名。

### `_drawHeadAt` 签名

```typescript
private _drawHeadAt(g: Graphics, at: Pixel, dr: number, dc: number, color: Color) {
    const pdx = dc;
    const pdy = -dr;
    const nx = -pdy;
    const ny = pdx;
    const s = Config.arrowHeadSize;
    const tipX = at.x + pdx * s;
    const tipY = at.y + pdy * s;
    const leftX = at.x + nx * s / 2;
    const leftY = at.y + ny * s / 2;
    const rightX = at.x - nx * s / 2;
    const rightY = at.y - ny * s / 2;

    g.fillColor = color;
    g.moveTo(tipX, tipY);
    g.lineTo(leftX, leftY);
    g.lineTo(rightX, rightY);
    g.close();
    g.fill();
}
```

对比 08 章，名字从 `_drawHead` 改成 `_drawHeadAt`、参数从 `(coords, pixels, color)` 改成 `(at, dr, dc, color)`。**更通用**，既能画"头在 head 格"的也能画"头延伸了一点的"。

---

## 第 4 步：`GameController` 加 `update`

### 要做的事

Cocos 的 `Component` 生命周期里 `update(dt: number)` 每帧被引擎调一次。我们用它**遍历所有 Start 状态的箭头，推进 progress、触发 refresh**。

### 代码片段

在 `GameController` 里加一个方法：

```typescript
update(dt: number) {
    for (let i = 0; i < this.runtimes.length; i++) {
        const rt = this.runtimes[i];
        if (rt.mode !== ArrowMoveMode.Start) continue;
        tickStart(rt, dt, Config.arrowSpeed);
        this.refreshArrow(i);
    }
}
```

同时 `import` 补两个：

```typescript
import { tickStart } from '../core/ArrowState';
import { Config } from '../common/Config';
```

### 设计点

- **`if (rt.mode !== ArrowMoveMode.Start) continue`**：Idle 不 tick、已撞的不 tick。**tick 的前置条件在外层控制**，不是 tickStart 自己。
- **每次 tick 后 `refreshArrow(i)`**：数据动了画面跟着走。Cocos 没有响应式，手动刷是我们 08 章就立下的规矩。
- **不做 dirty 标记**：只有几根箭头，每帧全刷没损耗。过度优化是浪费时间。

---

## 第 5 步：验证

### 5.1 level_01 直线飞行

保存预览，点击任意一根箭头，它应该**向右缓慢滑行**，每 0.2 秒跨一格。多点几根，**它们各自独立前进**。

目前会一直飞出屏幕也不停（下一章处理）。

### 5.2 level_02 L 形转弯

把 `GameController.onLoad` 里：

```typescript
this.loadLevel(1);
```

**临时改成**：

```typescript
this.loadLevel(2);
```

预览。你会看到一根 L 形箭头：
- `coords[0] = [4,2]`（左下尾巴）
- `coords[1..3] = [3,2] → [3,3] → [3,4]`（转角、中段、头朝右）

点击它：
- **第 1 格**：头走到 `[3,5]`，尾从 `[4,2]` 消失、下一格 `[3,2]` 变成新尾巴——**尾巴自然爬过了转角**。
- **第 2 格**：头 `[3,6]`（出界了，下一章处理），形状变成水平直线。
- 整个过程 `coords.length` 恒等于 4，**形状从 L 变成直线**，没有任何特判代码。

这就是贪吃蛇模型的威力。验证完记得把 `loadLevel(2)` 改回 `loadLevel(1)`。

---

## 易错点

### 易错 1：`update(dt)` 签名写错

```typescript
update() { }              // ❌ 没参数，dt 是 undefined，progress 算出 NaN
update(deltaTime) { }     // ❌ 没类型，strict 模式下报错
```

Cocos 3.8 的 `Component.update` 固定签名 `update(dt: number)`。**方法名大小写敏感**。

### 易错 2：用 `if` 代替 `while`

```typescript
if (rt.progress >= 1) {   // ❌
    rt.progress -= 1;
    stepOneCell(rt);
}
```

页面切后台 2 秒后切回来，一次 dt 可能累到 progress=10。`if` 只 step 一次、剩 9 格没消化。**累加型进度永远 `while`**。

### 易错 3：push 完忘了 shift

```typescript
function stepOneCell(rt) {
    rt.coords.push([...]);
    // 忘了 rt.coords.shift();
}
```

表现：**箭头越飞越长**，像贪吃蛇吃东西。长度守恒靠"push 必配 shift"。

### 易错 4：`createRuntime` 里直接赋 `coords: data.coords`

```typescript
return {
    ...
    coords: data.coords,   // ❌ 共享引用
};
```

JS 数组是引用传递，runtime 改 coords 就等于改配置。`resetToIdle` 以后会发现 ArrowData.coords 已经被动态改过，关卡就再也重置不回原样。**跨配置/运行时边界必须深拷贝**。

### 易错 5：在 `_redraw` 里仍然读 `this._data.coords`

```typescript
const coords = this._data.coords;   // ❌ 永远画初始位置
```

08 章这样写是对的（当时箭头不动）。本章起必须优先读 `this._rt.coords`。否则你 tick 推进了 runtime，但画面从头到尾静止——一个非常迷惑的 bug。

### 易错 6：`progress > 1` 的边界

如果速度调到 20 格/秒、帧率 30 fps，一帧 `dt = 0.033s`，`speed * dt ≈ 0.66`——没事。但极端情况（速度 100 + 偶尔卡帧）progress 可能一帧累到 2 以上。`while` 保证消化干净，但 **`_redraw` 里的 `progress` 如果残留大于 1，箭头视觉会超出一格位置**。

不过正常情况下一帧结束时 progress 必然小于 1（while 消化过了），**前提是 `tickStart` 先于 `refreshArrow` 调用**。我们的顺序是对的，这条只是提醒你别改顺序。

---

## 扩展练习

1. **看 progress 变化**：在 `update` 里加一行 `console.log(this.runtimes[0].progress.toFixed(2))`，观察点击后 progress 从 0 涨到 1、再从 0 涨到 1 的锯齿。理解"视觉平滑"和"逻辑离散"的区别。

2. **做一条 Z 形箭头**：改 level_02.json 让 coords 有两个转角，比如 `[[5,2],[4,2],[4,3],[3,3],[3,4]]`。预期：贪吃蛇模型**一行代码不用改**照样跑通。

3. **思考题**：`tickStart` 现在是 3 参（rt, dt, speed）。如果改成把 `speed` 挂在 `ArrowRuntime` 里呢？（例如有的箭头快、有的慢。）要改哪里？哪种写法更好？提示：speed 是不是箭头的"身份"？

---

## 本章完整代码对照

上面的"代码片段"告诉你每块怎么改。这一节给各文件最终形态，**抄完之后对照一下就好**，不要再从这里复制。

### `assets/scripts/common/Config.ts`

```typescript
/**
 * 全局数值配置。所有"魔数"都进这里，绝对不在业务代码里写 50 / 100 这种。
 */
export const Config = {
    /** 格子之间的距离（像素） */
    gap: 100,
    /** 点的大小（像素） */
    pointSize: 12,
    /** 箭头线宽（像素） */
    arrowLineWidth: 10,
    /** 箭头头部大小（像素） */
    arrowHeadSize: 24,
    /** Start 状态下箭头的速度（格/秒） */
    arrowSpeed: 5,
} as const;
```

### `assets/scripts/core/ArrowState.ts`

```typescript
import { Cell, ArrowData, Direction } from './LevelData';

/** 箭头移动状态枚举。数字值有语义，不可随意改顺序 */
export enum ArrowMoveMode {
    Idle    = 0,
    Collide = 1,
    Back    = 2,
    Start   = 3,
    End     = 4,
}

/** 一根箭头的运行时状态（09 章版本：加 coords + progress）*/
export interface ArrowRuntime {
    mode: ArrowMoveMode;
    hasFailed: boolean;
    /** 当前占据的格子（动态） */
    coords: Cell[];
    /** Start 状态下头的推进累计量（单位：格）*/
    progress: number;
}

/** 从 coords 最后两点派生方向。单格时返回 [0,0] */
export function deriveDirection(coords: Cell[]): Direction {
    if (coords.length < 2) return [0, 0];
    const [hr, hc] = coords[coords.length - 1];
    const [pr, pc] = coords[coords.length - 2];
    return [hr - pr, hc - pc];
}

export function createRuntime(data: ArrowData): ArrowRuntime {
    return {
        mode: ArrowMoveMode.Idle,
        hasFailed: false,
        coords: data.coords.map(c => [c[0], c[1]] as Cell),
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
}

export function markEnd(rt: ArrowRuntime): void {
    if (rt.mode !== ArrowMoveMode.Start) return;
    rt.mode = ArrowMoveMode.End;
}

export function markCollide(rt: ArrowRuntime): void {
    if (rt.mode !== ArrowMoveMode.Collide) return;
    rt.mode = ArrowMoveMode.Back;
    rt.hasFailed = true;
}

export function markBack(rt: ArrowRuntime): void {
    if (rt.mode !== ArrowMoveMode.Back) return;
    rt.mode = ArrowMoveMode.Idle;
}

export function resetToIdle(rt: ArrowRuntime, data: ArrowData): void {
    rt.mode = ArrowMoveMode.Idle;
    rt.hasFailed = false;
    rt.coords = data.coords.map(c => [c[0], c[1]] as Cell);
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

### `assets/scripts/game/ArrowView.ts`

```typescript
import {
    _decorator, Component, UITransform, Graphics, Color,
} from 'cc';
import { ArrowData, Cell } from '../core/LevelData';
import { ArrowRuntime, ArrowMoveMode } from '../core/ArrowState';
import { gridToPixel, Pixel } from '../core/Coord';
import { Config } from '../common/Config';
const { ccclass } = _decorator;

const COLOR_IDLE = new Color(0xff, 0xff, 0xff, 0xff);
const COLOR_MOVE = new Color(0x5b, 0x72, 0xfe, 0xff);
const COLOR_STOP = new Color(0xfe, 0x4b, 0x5e, 0xff);

@ccclass('ArrowView')
export class ArrowView extends Component {
    private _graphics: Graphics | null = null;
    private _data: ArrowData | null = null;
    private _rows = 0;
    private _cols = 0;
    private _rt: ArrowRuntime | null = null;

    public initData(data: ArrowData, rows: number, cols: number) {
        if (!this._graphics) {
            this._graphics = this.getComponent(Graphics) ?? this.addComponent(Graphics);
        }
        if (!this.node.getComponent(UITransform)) {
            this.node.addComponent(UITransform);
        }
        this._data = data;
        this._rows = rows;
        this._cols = cols;
        this._redraw();
    }

    public refresh(rt: ArrowRuntime) {
        this._rt = rt;
        this._redraw();
    }

    private _redraw() {
        if (!this._data || !this._graphics) {
            console.error('ArrowView: _data or _graphics is null');
            return;
        }
        const g = this._graphics;
        const coords: Cell[] = this._rt ? this._rt.coords : this._data.coords;
        if (coords.length < 2) return;

        g.clear();

        const color = this._pickColor();
        const pixels: Pixel[] = coords.map(
            ([r, c]) => gridToPixel(r, c, this._rows, this._cols),
        );

        const progress = this._rt?.progress ?? 0;
        const dr = coords[coords.length - 1][0] - coords[coords.length - 2][0];
        const dc = coords[coords.length - 1][1] - coords[coords.length - 2][1];
        const headPx = pixels[pixels.length - 1];
        const tipPx: Pixel = {
            x: headPx.x + dc * Config.gap * progress,
            y: headPx.y - dr * Config.gap * progress,
        };

        g.strokeColor = color;
        g.lineWidth = Config.arrowLineWidth;
        g.moveTo(pixels[0].x, pixels[0].y);
        for (let i = 1; i < pixels.length; i++) {
            g.lineTo(pixels[i].x, pixels[i].y);
        }
        if (progress > 0) {
            g.lineTo(tipPx.x, tipPx.y);
        }
        g.stroke();

        this._drawHeadAt(g, tipPx, dr, dc, color);
    }

    private _pickColor(): Color {
        const rt = this._rt;
        if (!rt) return COLOR_IDLE;
        if (rt.mode === ArrowMoveMode.Start || rt.mode === ArrowMoveMode.End) {
            return COLOR_MOVE;
        }
        if (rt.mode === ArrowMoveMode.Collide || rt.mode === ArrowMoveMode.Back) {
            return COLOR_STOP;
        }
        if (rt.hasFailed) return COLOR_STOP;
        return COLOR_IDLE;
    }

    private _drawHeadAt(g: Graphics, at: Pixel, dr: number, dc: number, color: Color) {
        const pdx = dc;
        const pdy = -dr;
        const nx = -pdy;
        const ny = pdx;
        const s = Config.arrowHeadSize;
        const tipX = at.x + pdx * s;
        const tipY = at.y + pdy * s;
        const leftX = at.x + nx * s / 2;
        const leftY = at.y + ny * s / 2;
        const rightX = at.x - nx * s / 2;
        const rightY = at.y - ny * s / 2;

        g.fillColor = color;
        g.moveTo(tipX, tipY);
        g.lineTo(leftX, leftY);
        g.lineTo(rightX, rightY);
        g.close();
        g.fill();
    }
}
```

### `assets/scripts/game/GameController.ts`

```typescript
import { _decorator, Component, resources, JsonAsset, Node } from 'cc';
import { LevelData, validateLevelData, ArrowData } from '../core/LevelData';
import { BoardView } from './BoardView';
import {
    ArrowMoveMode, ArrowRuntime, createRuntime, canFire, fire,
    markEnd, markCollide, markBack, resetToIdle, tickStart,
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

    onLoad() {
        this.boardView = this.createBoardView();
        this.input = this.node.addComponent(InputController);
        this.loadLevel(1);
    }

    update(dt: number) {
        for (let i = 0; i < this.runtimes.length; i++) {
            const rt = this.runtimes[i];
            if (rt.mode !== ArrowMoveMode.Start) continue;
            tickStart(rt, dt, Config.arrowSpeed);
            this.refreshArrow(i);
        }
    }

    private createBoardView(): BoardView {
        const node = new Node('BoardView');
        this.node.addChild(node);
        return node.addComponent(BoardView);
    }

    private loadLevel(levelNo: number) {
        const no = levelNo < 10 ? `0${levelNo}` : `${levelNo}`;
        const path = `levels/level_${no}`;
        resources.load(path, JsonAsset, (err, asset) => {
            if (err) {
                console.error(`[Arrow] Load level failed: ${path}`, err);
                return;
            }
            let data: LevelData;
            try {
                data = validateLevelData(asset.json);
            } catch (e) {
                console.error(`[Arrow] Level data invalid:`, e);
                return;
            }
            this.levelData = data;
            this.onLevelLoaded(data);
        });
    }

    private onLevelLoaded(data: LevelData) {
        console.log(`[Arrow] Level loaded: ${data.rows} x ${data.cols}, arrows = ${data.arrows.length}`);
        this.runtimes = data.arrows.map(a => createRuntime(a));
        this.boardView?.render(data);
        this.refreshAllArrows();
        this.input?.setup(data, (idx) => this.onArrowClick(idx));
    }

    private onArrowClick(idx: number) {
        const rt = this.runtimes[idx];
        if (!canFire(rt)) return;
        fire(rt, false);
        console.log(`[Arrow] Arrow ${idx} fired. mode = ${ArrowMoveMode[rt.mode]}`);
        this.refreshArrow(idx);
    }

    private refreshAllArrows() {
        const views = this.boardView?.getArrowViews() ?? [];
        for (let i = 0; i < views.length; i++) {
            views[i].refresh(this.runtimes[i]);
        }
    }

    private refreshArrow(idx: number) {
        const views = this.boardView?.getArrowViews() ?? [];
        views[idx]?.refresh(this.runtimes[idx]);
    }
}
```

> 07 章的 `stateMachineSelfTest` 如果你留着了，这里删掉了——自测已经在 07 章跑过，本章不需要再跑。

---

## 本章结束时的工程状态

```
assets/scripts/
├── core/
│   ├── LevelData.ts
│   ├── Coord.ts
│   └── ArrowState.ts            ← 加 coords/progress 字段 + deriveDirection + tickStart
├── common/Config.ts             ← 加 arrowSpeed
└── game/
    ├── ArrowView.ts             ← _redraw 支持 progress 延伸 + _drawHeadAt
    ├── BoardView.ts
    ├── GameController.ts        ← 加 update
    └── InputController.ts
```

下一章：**10 · 飞出边界 = End 状态** —— 飞出去的箭头在边界停下，标记成功逃脱。依然基于贪吃蛇模型：**头的下一步格子如果出界，就 markEnd**。
