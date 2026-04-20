# 05 · 箭头的静态渲染（ArrowView）

## 本节目标

**在第 04 章的点阵上，叠加画出 3 根朝右的灰色箭头**。

启动后画面应该是：

```
                (屏幕中心)
                    +
   col=1  col=2  col=3  col=4  col=5
   ╾──────────────▶              ← 箭头 1 (row=1)
   ╾──────────────▶              ← 箭头 2 (row=2)
   ╾──────────────▶              ← 箭头 3 (row=3)
```

每根箭头：

- **线条身体**：从尾格子 `[row, 1]` 画到头格子 `[row, 3]`
- **三角形箭头头**：在头格子位置，指向方向 `[0, 1]`（即向右）
- **颜色**：灰色（`0x111633`，来自 G3_FBase 的 `arrowIdleColor`）

一句话：**第一次看到"这关游戏该怎么玩"**。虽然还不能动。

---

## 需求分析

### 为什么要独立一个 ArrowView

- **一根箭头 = 一个节点 = 一个 ArrowView 组件**，对应 G3_FBase 里一个 Arrow 实体。
- ArrowView 只负责画，不管逻辑。它收到 `setData(arrow, rows, cols)` 就画出来。
- 将来第 09 章让箭头动起来时，只改 ArrowView 里一个 `update()`，其他代码不碰。

对照参考项目：

| G3_FBase | 我们 |
|----------|------|
| `CombatArrowDomain`（管所有箭头实体的域） | GameController 里一个 `arrowViews: ArrowView[]` 数组 |
| `ArrowComponent`（一根箭头的数据） | ArrowView 组件内部的字段 |
| `CombatArrowRender`（渲染） | ArrowView 里的 `render()` 方法 |

**G3_FBase 把数据和渲染拆成了两个 Atom（ArrowComponent 和 ArrowRender），我们合并成一个 ArrowView 组件**。理由：Cocos 3.8 里 cc.Component 本身就是"数据 + 行为 + 节点"三位一体的天然封装，没必要再拆。这是 "Linus 的简洁执念"——**比参考少一层也能干完**，就不要那一层。

### 怎么画一根箭头

箭头 = 一条线 + 一个三角形。

```
   tail                       head
    ●━━━━━━━━━━━━━━━━━━━━━━━━▶
    |           body           |
    
    tail = coords[0]（第一个格子，箭头的尾）
    head = coords[coords.length - 1]（最后一个格子，箭头的头）
```

参考 G3_FBase 的 `ArrowComponent.defineComponent()`：

- `coords: []` —— 坐标数组，**从尾到头**排列
- `moveMode`、`color`、`highlight` 等 —— 暂时用不到，本章只画静态

画法：

1. 从 `coords[0]` 到 `coords[last]` 画一条 10px 粗的灰线（参考 `Config.arrowLineWidth`）。
2. 在 `coords[last]` 画一个朝 `direction` 方向的三角形（边长 `Config.arrowHeadSize`）。

---

## 实现思路

### 三角形怎么画

Graphics 画三角形的通用模式：

```typescript
g.moveTo(x1, y1);
g.lineTo(x2, y2);
g.lineTo(x3, y3);
g.close();
g.fill();
```

关键是**三角形的三个顶点怎么算**。

设箭头头格子的像素坐标是 `(hx, hy)`，方向向量 `[dr, dc]`，头大小 `s = Config.arrowHeadSize`。

- 方向向量需要从格子空间（行列）**转到像素空间**：
  - 格子 `direction = [dr, dc]`（行增量、列增量）
  - 像素方向 `(pdx, pdy) = (dc, -dr)`（因为 y 轴翻转了！）
  - 归一化：除以长度（上面那组方向 `[±1, 0]` 或 `[0, ±1]` 长度都是 1，不用除，但正式写法要规范）

- 三角形顶点：
  - **尖端**：`(hx + pdx * s, hy + pdy * s)` —— 向前走 s
  - **左翼**：`(hx - pdx * s/2 + (-pdy) * s/2, hy - pdy * s/2 + pdx * s/2)` —— 基于"垂直方向"偏移
  - **右翼**：`(hx - pdx * s/2 - (-pdy) * s/2, hy - pdy * s/2 - pdx * s/2)`

公式里的"垂直于方向向量的向量"= 把方向向量 **逆时针旋转 90 度**：`(pdx, pdy) → (-pdy, pdx)`。

直接记结论：

```typescript
// (pdx, pdy) = 方向的像素单位向量
// (nx, ny) = 垂直于方向的单位向量（逆时针 90°）
const nx = -pdy, ny = pdx;

const tipX  = hx + pdx * s,     tipY  = hy + pdy * s;
const leftX = hx + nx  * s / 2, leftY = hy + ny  * s / 2;
const rightX= hx - nx  * s / 2, rightY= hy - ny  * s / 2;
```

> **Linus 的品味**：三角形的三个顶点用**一套统一公式**算出来，不用 if 判断 "向右 → 这样，向下 → 那样"。**消除特殊情况**，方向变了公式不变。

### 谁持有 ArrowView

选项 A：ArrowView 节点挂在 BoardView 节点下，共用 Board 的 transform。
选项 B：ArrowView 节点挂在 Canvas 根下，和 BoardView 并列。

**我们选 A**。理由：将来第 06 章做缩放适配时，整个棋盘（点 + 箭头）要**作为一个整体缩放**。挂在同一个父节点下，父节点 scale 一改，所有子节点一起动。

---

## 代码实现

### 文件 1：`assets/scripts/game/ArrowView.ts`（新增）

```typescript
import {
    _decorator, Component, UITransform, Graphics, Color, Vec3,
} from 'cc';
import { ArrowData } from '../core/LevelData';
import { gridToPixel } from '../core/Coord';
import { Config } from '../common/Config';
const { ccclass } = _decorator;

/** 箭头 Idle 状态的默认灰色，取自 G3_FBase arrowIdleColor = 0x111633 */
const IDLE_COLOR = new Color(0x11, 0x16, 0x33, 0xff);

/**
 * 一根箭头的视图。
 * 本章只画静态：一条线 + 一个三角形箭头头。
 * 后续章节会加上 moveMode 状态驱动的颜色变化和位置更新。
 */
@ccclass('ArrowView')
export class ArrowView extends Component {
    private graphics: Graphics | null = null;
    private data: ArrowData | null = null;
    private rows = 0;
    private cols = 0;

    /** 由 GameController / BoardView 注入数据，注入后立即画一次 */
    setData(data: ArrowData, rows: number, cols: number) {
        this.data = data;
        this.rows = rows;
        this.cols = cols;
        this.ensureGraphics();
        this.redraw();
    }

    private ensureGraphics() {
        if (this.graphics) return;
        // ArrowView 节点本身需要 UITransform 才能被 Graphics 正确渲染
        if (!this.node.getComponent(UITransform)) {
            this.node.addComponent(UITransform);
        }
        this.graphics = this.node.addComponent(Graphics);
    }

    private redraw() {
        if (!this.data || !this.graphics) return;
        const g = this.graphics;
        g.clear();

        const { direction, coords } = this.data;
        const tail = coords[0];
        const head = coords[coords.length - 1];

        const tailPx = gridToPixel(tail[0], tail[1], this.rows, this.cols);
        const headPx = gridToPixel(head[0], head[1], this.rows, this.cols);

        // 像素方向向量：格子 [dr, dc] → 像素 (dc, -dr)
        const pdx = direction[1];
        const pdy = -direction[0];

        // 1) 画线条身体
        g.strokeColor = IDLE_COLOR;
        g.lineWidth = Config.arrowLineWidth;
        g.moveTo(tailPx.x, tailPx.y);
        g.lineTo(headPx.x, headPx.y);
        g.stroke();

        // 2) 画三角形箭头头
        const s = Config.arrowHeadSize;
        const nx = -pdy, ny = pdx;  // 垂直方向（逆时针 90°）
        const tipX  = headPx.x + pdx * s;
        const tipY  = headPx.y + pdy * s;
        const leftX = headPx.x + nx * s / 2;
        const leftY = headPx.y + ny * s / 2;
        const rightX = headPx.x - nx * s / 2;
        const rightY = headPx.y - ny * s / 2;

        g.fillColor = IDLE_COLOR;
        g.moveTo(tipX, tipY);
        g.lineTo(leftX, leftY);
        g.lineTo(rightX, rightY);
        g.close();
        g.fill();
    }
}
```

**关键点**：

- **`setData` 是唯一入口**：外部调用它传入数据，内部负责画。避免 public 字段被外部乱改。
- **`redraw` 私有**：画面怎么刷新是 ArrowView 自己的事。将来状态变化也是 setData 触发 redraw，外部不直接碰。
- **`g.clear()`**：每次重画先清空，否则叠画（第 12 章箭头变色时就要用）。
- **方向向量用 `(direction[1], -direction[0])`**：
  - `direction = [0, 1]`（向右） → `(1, 0)` 像素向量，箭头向右 ✅
  - `direction = [1, 0]`（向下） → `(0, -1)` 像素向量，箭头向下 ✅（Cocos y 向下为负）
  - `direction = [-1, 0]`（向上） → `(0, 1)` 箭头向上 ✅
  - `direction = [0, -1]`（向左） → `(-1, 0)` 箭头向左 ✅

### 文件 2：改造 `BoardView.ts`（加 `spawnArrows`）

BoardView 除了画点，现在还负责"创建所有 ArrowView 节点"。

**注意**：这里我们让 BoardView 既管点也管箭头。这不违反"单一职责"—— BoardView 的职责是**"把一关数据画出来"**，点和箭头都是"这一关的视觉元素"。

```typescript
import {
    _decorator, Component, Node, UITransform, Graphics, Color, Vec3,
} from 'cc';
import { LevelData } from '../core/LevelData';
import { gridToPixel } from '../core/Coord';
import { Config } from '../common/Config';
import { ArrowView } from './ArrowView';
const { ccclass } = _decorator;

@ccclass('BoardView')
export class BoardView extends Component {
    private dots: Node[] = [];
    private arrowViews: ArrowView[] = [];

    render(data: LevelData) {
        this.clear();
        this.renderDots(data);
        this.renderArrows(data);
        console.log(
            `[Arrow] BoardView rendered: ${this.dots.length} dots, ${this.arrowViews.length} arrows`
        );
    }

    /** 获取所有箭头视图，后续章节会用 */
    getArrowViews(): readonly ArrowView[] {
        return this.arrowViews;
    }

    private renderDots(data: LevelData) {
        const allCells = data.arrows.flatMap(a => a.coords);
        for (const [row, col] of allCells) {
            const dot = this.createDot(row, col, data.rows, data.cols);
            this.node.addChild(dot);
            this.dots.push(dot);
        }
    }

    private renderArrows(data: LevelData) {
        for (let i = 0; i < data.arrows.length; i++) {
            const node = new Node(`Arrow_${i}`);
            this.node.addChild(node);
            const view = node.addComponent(ArrowView);
            view.setData(data.arrows[i], data.rows, data.cols);
            this.arrowViews.push(view);
        }
    }

    private createDot(row: number, col: number, rows: number, cols: number): Node {
        const p = gridToPixel(row, col, rows, cols);
        const dot = new Node(`Dot_${row}_${col}`);
        dot.setPosition(new Vec3(p.x, p.y, 0));
        dot.addComponent(UITransform).setContentSize(Config.pointSize, Config.pointSize);
        const g = dot.addComponent(Graphics);
        g.fillColor = new Color(86, 101, 246, 80);
        const r = Config.pointSize / 2;
        g.circle(0, 0, r);
        g.fill();
        return dot;
    }

    private clear() {
        for (const d of this.dots) d.destroy();
        for (const a of this.arrowViews) a.node.destroy();
        this.dots = [];
        this.arrowViews = [];
    }
}
```

**关键改动**：

- 新增 `arrowViews: ArrowView[]` 跟踪所有箭头视图。
- `render()` 拆成 `renderDots` + `renderArrows` 两个私有方法，主方法读起来像目录。
- 新增 `getArrowViews()` 只读访问器，后续章节（第 08 章触摸交互、第 09 章状态驱动）需要拿到所有箭头视图。**返回 `readonly` 防止外部意外修改数组**。
- `clear()` 同时清两套节点。

### 文件 3：`GameController.ts` 一行不用动

这就是分层的好处。`GameController` 还是调 `boardView.render(data)`，里面发生什么它不 care。

---

## 运行效果

保存、预览、F12 Console：

```
[Arrow] Game scene loaded. I am alive.
[Arrow] Level loaded: 5 x 5, arrows = 3
[Arrow] BoardView rendered: 9 dots, 3 arrows
```

画面：

```
┌─────────────────────────────────────┐
│                                     │
│   ╾──────▶                          │  ← 箭头 1
│   •   •   •  ← 点阵在箭头下方透过来   │
│   ╾──────▶                          │  ← 箭头 2
│   •   •   •                          │
│   ╾──────▶                          │  ← 箭头 3
│   •   •   •                  +       │  (+ 是屏幕中心)
│                                     │
└─────────────────────────────────────┘
```

三根灰色朝右的箭头清晰可见，每根箭头下面是它占据的 3 个蓝色半透明点（点比箭头线窄，会从箭头两侧或穿过透出来）。

---

## 易错点

### 易错 1：箭头方向反了（箭头头出现在尾的位置）

```typescript
const head = coords[0];                     // ❌ 把第一个当头
const tail = coords[coords.length - 1];     // ❌ 把最后一个当尾
```

记住：**`coords` 是"从尾到头"排列的**。最后一个元素才是箭头头。搞反的直接现象：箭头三角形画在线的左端而不是右端。

**怎么记**：`origin` 字段的值就等于 `coords[last]`，这一点看 `Level_00001.json` 任何一个 arrow 都能验证。

### 易错 2：方向向量忘了翻转 y

```typescript
const pdx = direction[1];    // ✅
const pdy = direction[0];    // ❌ 没翻转
```

结果：方向是 `[1, 0]`（向下）时，箭头画成向上。

**规则**：**格子 row 增加 = 屏幕 y 减少**，所以 `pdy = -direction[0]`。第 03 章的 `gridToPixel` 已经用了这个原则，这里保持一致。

### 易错 3：Graphics 每次 redraw 忘了 `g.clear()`

```typescript
private redraw() {
    const g = this.graphics;
    // g.clear();  ❌ 忘了
    g.moveTo(...);
    g.stroke();
}
```

第一次画正常，第二次画（比如第 12 章箭头变色 + 移动位置）会把新老两条线同时画出来。**Graphics 的绘制命令是累加的**，必须手动清。

**规则**：所有"会被多次调用的 draw 方法"，**第一行必须是 `g.clear()`**。

### 易错 4：箭头头"一半在屏幕外"

`arrowHeadSize = 24`，箭头尖端会超出最后一个格子位置 24 像素。当箭头头格子正好在棋盘边缘时，尖端就在棋盘外面。

**目前不是问题**（第 01 关 3 根箭头都在内部列 1~3，头在 col=3，离右边缘还远）。

但关卡设计时要注意：**如果箭头头格子在最右一列，箭头尖端会画到棋盘外**。这是 G3_FBase 的既有行为（看它的 `maxRadius` 和 `edgeSpaceWidth` 计算），视觉上没问题。

### 易错 5：ArrowView 节点没 UITransform，Graphics 不显示

```typescript
private ensureGraphics() {
    if (this.graphics) return;
    this.graphics = this.node.addComponent(Graphics);  // ❌ 没先加 UITransform
}
```

Graphics 要求节点有 UITransform（提供 contentSize、anchor）。**`new Node()` 创建的节点默认没有 UITransform**。

**规则**：凡是要挂 2D 渲染组件（Sprite / Graphics / Label）的节点，第一个加的组件永远是 UITransform。

---

## 扩展练习

1. **加第 4 根方向不同的箭头**：在 `level_01.json` 的 `arrows` 数组末尾加一项：
   ```json
   { "direction": [1, 0], "origin": [3, 5], "coords": [[1,5],[2,5],[3,5]] }
   ```
   预期：屏幕最右列出现一根**朝下**的箭头。验证你的方向公式对四个方向都对。**做完后把这条删掉**，第 06 章继续用原始 3 根箭头。

2. **换颜色**：把 `IDLE_COLOR` 从灰色 `0x111633` 改成红色 `0xfe4b5e`（G3_FBase 的 `arrowStopColor`）。预览看效果。想想：为什么 G3_FBase 静态 idle 用灰色而不是红色？
   
   提示：红色在游戏里有"警告/失败"的含义，idle 时不该用。

3. **进阶**：把 `ArrowView` 里 3 组 "tipX, leftX, rightX" 这 9 个算式**重构**成一个 `calcArrowHeadPoints(head, direction, size)` 纯函数，放到 `core/Coord.ts` 里。重构之后 `redraw` 方法变短，`calcArrowHeadPoints` 可以单独测试。
   
   这就是 G3_FBase 把逻辑拆成 `FunctionAtom` 的思路——**可复用的算法留在 core，组件只管调用**。

---

**本章结束时的工程状态**：

```
arrow/assets/
├── resources/levels/level_01.json
├── scenes/Game.scene
└── scripts/
    ├── core/
    │   ├── LevelData.ts
    │   └── Coord.ts
    ├── common/
    │   └── Config.ts
    └── game/
        ├── ArrowView.ts                ← 新增
        ├── BoardView.ts                ← 改造
        └── GameController.ts
```

**第一部分（第 1~5 章）收尾**：

- ✅ Cocos 工程能跑
- ✅ 关卡 JSON 能加载
- ✅ 格子 ↔ 像素坐标互转
- ✅ 点阵能画
- ✅ 箭头静态渲染

**屏幕上已经能看到一关游戏的雏形。但它不能动。**

下一章：**06 · 视图组合与窗口适配** —— 让棋盘在不同分辨率下居中、不溢出。
