# 04 · 棋盘与点阵渲染（BoardView）

## 本节目标

**把 `level_01.json` 里所有箭头占据的格子都画成一个蓝色小圆点**。

启动后屏幕应该看到（`+` 是屏幕中心 = 挂载节点原点）：

```
   col=1  col=2  col=3  col=4  col=5
                                      ← row=1  (空)
         •       •      •             ← row=2  (三个点：箭头 1 的 coords)
         •       +      •             ← row=3  (三个点：箭头 2 的 coords，中间那个正好是屏幕中心)
         •       •      •             ← row=4  (三个点：箭头 3 的 coords)
                                      ← row=5  (空)
```

一共 9 个蓝点（3 根箭头 × 每根 3 个格子），排成 3×3 的阵列，**整体以屏幕中心对称**。

一句话：**第一次在屏幕上"看到"这一关长什么样**。

---

## 需求分析

### 为什么要画"点"

新手容易问："我直接画箭头不就行了？为什么先画点？"

三条理由：

1. **点阵是游戏视觉反馈的底层**。玩家看到"哦这三个格子是同一根箭头的身体"，靠的就是这一串点。参考项目 G3_FBase 里 `CombatPointRender` 和 `CombatArrowRender` 是两个独立的 RenderAtom，分别画点和箭头。**分开画 = 分开调 = 分开改**。
2. **箭头画起来比点复杂得多**（要画线条 + 三角形箭头头）。先画点可以验证**坐标系完全正确**，再画箭头时出问题只可能是箭头画法的问题。
3. **练习"根据数据生成节点"这个模式**。这一章之后，再看箭头、Ray、HUD 全是同一个模式。

### 职责划分

| 组件 | 职责 |
|------|------|
| `GameController` | 加载关卡、把 LevelData 交给 BoardView |
| **`BoardView`（新）** | 根据 LevelData 生成所有点节点、画出来 |

**BoardView 不关心"谁是箭头""怎么移动"**，只负责"把所有箭头占据的格子画成小圆点"。

对应参考项目：`BoardView` ≈ `G3_FBase_CombatPointDomain` + `G3_FBase_CombatPointRender` 的合集。

---

## 实现思路

### 数据流

```
level_01.json
     ↓ resources.load
LevelData { arrows: [{coords: [[2,2],[2,3],[2,4]]}, ...] }
     ↓ 交给 BoardView.render(data)
 遍历所有 arrows[].coords
     ↓ gridToPixel(row, col, rows, cols)
 每个格子 (x, y)
     ↓ new Node + Graphics
 9 个蓝点节点挂在 BoardView 下
```

### "所有箭头占据的格子" ≠ "所有格子"

看清楚 level_01.json：

- 棋盘是 5×5 = 25 格
- 但只有 **9 格**（3 根箭头 × 3 个 coords）被画成点

**棋盘空白的格子不画点**。这是 G3_FBase 的设计（见 `CombatPointsInitLogic` 的 `arrows.flatMap(arrow => arrow.coords)`）——只画"有意义"的格子，其他是空白。好处是关卡的**形状可以任意**，不限于方形矩阵。

### 为什么 9 个点会"居中"——关卡数据的职责

你可能会问："棋盘 5×5、箭头只占 9 格，为什么这 9 个点正好绕屏幕中心对称？"

答案在 `level_01.json`：3 根箭头的 coords 是 `(2..4, 2..4)`，**中心恰好是 `(3,3) = 棋盘中心 = 屏幕中心`**。

换个角度讲：

- `Coord.ts` 的职责：**"格子中心 `(3,3)` 映射到像素 `(0,0)`"** —— 这是纯数学
- `level_01.json` 的职责：**"哪些格子有意义，让它们在棋盘里怎么分布"** —— 这是关卡设计
- `BoardView.ts` 的职责：**"按数据忠实画点"** —— 这是渲染

如果关卡数据把 9 格放在 `(1..3, 1..3)`（左上），屏幕上就是"偏左上"——**不是 bug，是关卡设计选择**。原项目 G3_FBase 的关卡数据也是让有效内容自然落在棋盘中心，而不是靠渲染层去补偿。

> **Linus 的分层**：一层做一件事。"让内容看起来居中"是关卡设计的事，不塞进渲染代码里。否则你会开始写 `if (要不要居中) ... else ...` 这种特殊情况，数据结构错了，一层层往上堆补丁。

### 为什么独立一个 BoardView 组件

**不搞一个组件**的写法：把画点的逻辑直接写在 `GameController` 里。短期能跑，长期有两个问题：

1. `GameController` 会变成上千行的神类，什么都在里面。
2. 将来单独改"点"的表现（换颜色、加动画），要在一堆不相关代码里翻找。

**搞一个组件**的写法：`BoardView extends Component`，挂在一个子节点上，只管画点。这和 G3_FBase 把 `CombatPointRender` 作为独立 `RenderAtom` 是一样的思路。

> **Linus 的品味**：职责单一。一个类一个事。

---

## 代码实现

### 文件 1：`assets/scripts/game/BoardView.ts`（新增）

在 `scripts/game/` 下新建 `BoardView.ts`：

```typescript
import {
    _decorator, Component, Node, UITransform, Graphics, Color, Vec3,
} from 'cc';
import { LevelData } from '../core/LevelData';
import { gridToPixel } from '../core/Coord';
import { Config } from '../common/Config';
const { ccclass } = _decorator;

/**
 * 棋盘点阵视图。
 * 根据 LevelData 里所有箭头占据的格子，生成对应数量的蓝色小圆点。
 * 对应 G3_FBase 的 CombatPointDomain + CombatPointRender。
 */
@ccclass('BoardView')
export class BoardView extends Component {
    /** 已生成的点节点，render() 时先清空再重建 */
    private dots: Node[] = [];

    render(data: LevelData) {
        this.clear();

        // 收集所有箭头占据的格子（可能重复，关卡设计时应保证不重复）
        // 不用 Array.prototype.flatMap：它是 ES2019 引入的，Cocos 3.x 默认 lib 目标比它低，编译会报错。
        // 双层 for 更笨、也更清晰，零 API 依赖。
        const allCells: [number, number][] = [];
        for (const a of data.arrows) {
            for (const c of a.coords) allCells.push(c);
        }

        for (const [row, col] of allCells) {
            const dot = this.createDot(row, col, data.rows, data.cols);
            this.node.addChild(dot);
            this.dots.push(dot);
        }

        console.log(`[Arrow] BoardView rendered ${this.dots.length} dots`);
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
        this.dots = [];
    }
}
```

**关键点**：

- **`render(data)` 是对外唯一接口**。GameController 拿到关卡数据后调一次。
- **`clear()` 先销毁旧节点**。这个看似多余的一步很重要：后面第 19 章切关卡时，如果不清旧点，屏幕上会叠加出现两套棋盘。
- **`dot.destroy()` 而不是 `dot.removeFromParent()`**：前者彻底释放节点，后者只是断开父子关系，节点还活着。搞错了会泄漏。
- **`Color(86, 101, 246, 80)`**：前三个是 RGB，最后是 alpha (0~255)。80 约等于 31% 透明度，点轻微淡化，让后面画的箭头更突出。数值来自参考项目 `G3_FBase_CombatPointRender` 里 `pointColor = 0x5665f6` + `alpha = 0.13*255 ≈ 33`；我们稍微亮一点好看清。
- **`g.circle(0, 0, r); g.fill();`**：相对自身中心画圆，半径 r。

### 文件 2：改造 `GameController.ts`

这一章的关键改造是**让 GameController 不再自己画图**，把画面职责丢给 BoardView。

```typescript
import {
    _decorator, Component, resources, JsonAsset, Node,
} from 'cc';
import { LevelData, validateLevelData } from '../core/LevelData';
import { BoardView } from './BoardView';
const { ccclass } = _decorator;

@ccclass('GameController')
export class GameController extends Component {
    private levelData: LevelData | null = null;
    private boardView: BoardView | null = null;

    onLoad() {
        console.log('[Arrow] Game scene loaded. I am alive.');
        this.boardView = this.createBoardView();
        this.loadLevel(1);
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
            try {
                this.levelData = validateLevelData(asset.json);
                this.onLevelLoaded(this.levelData);
            } catch (e) {
                console.error(`[Arrow] Level data invalid:`, e);
            }
        });
    }

    private onLevelLoaded(data: LevelData) {
        console.log(`[Arrow] Level loaded: ${data.rows} x ${data.cols}, arrows = ${data.arrows.length}`);
        this.boardView?.render(data);
    }
}
```

**关键改动**：

- 删掉了上一章的 `spawnTestDot` / `makeSolidColorFrame` 相关逻辑。
- `onLoad` 里先**创建 BoardView 节点并挂上组件**，再 loadLevel。
- `onLevelLoaded` 里**把数据甩给 BoardView**。GameController 不画任何东西。

### 文件 3：不用动 `LevelData.ts` / `Coord.ts` / `Config.ts`

复用上一章。**这就是分层的好处**——前几章的基础设施不动，新章节只加新文件。

---

## 运行效果

保存、预览、F12 Console：

```
[Arrow] Game scene loaded. I am alive.
[Arrow] Level loaded: 5 x 5, arrows = 3
[Arrow] BoardView rendered 9 dots
```

画面（`+` 是屏幕中心）：

```
┌─────────────────────────────────┐
│                                 │
│                                 │
│         •     •     •           │  ← 箭头 1 的 [2,2] [2,3] [2,4]
│                                 │
│         •     +     •           │  ← 箭头 2 的 [3,2] [3,3] [3,4]（中间那个点正好在屏幕中心）
│                                 │
│         •     •     •           │  ← 箭头 3 的 [4,2] [4,3] [4,4]
│                                 │
│                                 │
└─────────────────────────────────┘
```

3 行 × 3 列 = 9 个半透明蓝点，**以屏幕中心对称**排列成九宫格。

如果你的 9 个点不是这个排布（整体偏左上/右下/某个角落），**立刻停下来排查**，不要进下一章。最常见的原因是 `level_01.json` 改错了——应该是 `(2..4, 2..4)` 这 9 格，不是 `(1..3, 1..3)`。

---

## 易错点

### 易错 1：调用 `render()` 时 BoardView 还没创建好

```typescript
onLoad() {
    this.loadLevel(1);             // 加载是异步的
    this.boardView = ...;          // 还没创建，render 已经准备调用
}
```

资源加载是**异步回调**，回来时 boardView 可能还是 null。我们写的顺序是对的（先 createBoardView 再 loadLevel），但如果你图省事倒过来写就会 NPE。

**规则**：**初始化同步的东西先于异步的东西**。

### 易错 2：`this.dots.push` 忘了，`clear()` 清不掉

```typescript
render(data: LevelData) {
    this.clear();
    for (const [row, col] of allCells) {
        const dot = this.createDot(...);
        this.node.addChild(dot);
        // this.dots.push(dot);  ❌ 漏了
    }
}
```

结果：下次 render 时 `clear` 找不到旧节点，画面就叠了两层点。第 19 章切关卡一眼看见。

**规则**：**谁创建谁跟踪**。新增节点的同时就要 push 到跟踪数组里。

### 易错 3：把 BoardView 挂在 Canvas 的根位置（x=0 y=0）上，结果点的坐标是相对 Canvas 中心的

这一点其实**没错**，这是**对的**。但新手会疑惑："我给 BoardView 这个节点也设了 position 吗？"

**回答**：没有，BoardView 节点的 position 默认是 `(0, 0, 0)`，相对 Canvas 中心。所以子节点的 `(p.x, p.y)` 坐标直接就是屏幕坐标（以中心为原点）。

**如果你哪天给 BoardView 节点设了 position**，里面所有点的位置都会跟着偏移。这是第 06 章做窗口适配时我们要利用的特性（整体缩放）。

### 易错 4：颜色 alpha 用 0~1 而不是 0~255

```typescript
g.fillColor = new Color(86, 101, 246, 0.3);  // ❌ Cocos 3.8 里 alpha 是 0~255
```

Cocos 3.8 的 `Color` 四个通道统一是 **0~255 整数**。如果你写 `0.3`，Color 会把它截断成 0，结果点完全透明看不见。

**规则**：Cocos 3.8 的 Color 参数永远 `0~255`。想要 30% 透明度？传 `77`（= 0.3 × 255 取整）。

### 易错 5：BoardView 节点名字取错导致找不到

不要起这种名字：

```typescript
const node = new Node('');            // ❌ 空字符串
const node = new Node('board');       // 🟡 小写，后面 Find 查不准
const node = new Node('BoardView');   // ✅ 和组件名一致
```

节点名字调试时极其重要。在 Cocos 编辑器运行态能看到节点树，名字清楚才能一眼看出"点挂在哪"。

---

## 扩展练习

1. **换成方形点**：把 `createDot` 里的 `g.circle(0,0,r); g.fill();` 换成 `g.rect(-r,-r,r*2,r*2); g.fill();`，观察效果。哪种更好看？为什么 G3_FBase 用圆点？
   
   提示：圆点在箭头旋转时视觉上稳定，方点在斜向飞行时会有不自然的棱角。

2. **加一个"棋盘边框"**：在 `BoardView.render` 结束后，再画一个大矩形框住整个棋盘。需要算出棋盘的外包围盒（基于 `rows * gap` 和 `cols * gap`）。提示：参考 G3_FBase 的 `WindowSizeLogic.panel.width/height`。

3. **Show me the state**：在 Cocos 编辑器预览运行态下，打开 **Hierarchy 面板** 观察节点树。Canvas 下有 `BoardView` 节点，它下面有 9 个 `Dot_x_y` 子节点。**养成"遇到问题先看 Hierarchy 长什么样"的习惯**——数据错还是渲染错，一看节点树就知道。

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
        ├── BoardView.ts                ← 新增
        └── GameController.ts           ← 改造
```

下一章：**05 · 箭头的静态渲染（ArrowView）** —— 在点阵上叠加画 3 根朝右的灰色箭头。画完这一章，**屏幕上的东西已经像一关游戏了**。
