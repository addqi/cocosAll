# 02 · 关卡数据结构与 JSON 加载

## 本节目标

**让游戏读取一个关卡 JSON 文件，并在 Console 里把它打印出来**。

启动游戏后，Console 应当看到：

```
[Arrow] Game scene loaded. I am alive.
[Arrow] Level 1 loaded: 5 x 5, arrows = 3
[Arrow] First arrow: direction=[0,1] coords=[[2,2],[2,3],[2,4]]
```

一句话：**把数据从磁盘读进内存，让代码"看得见"关卡**。

---

## 需求分析

### 为什么先做数据

游戏逻辑 = **数据 + 读写数据的规则**。

- 如果数据结构错了，代码再漂亮也救不回来。
- 如果数据加载流程不稳，后面每一章调试都会被"是不是没加载上"这个问题反复打扰。

所以第 02 章的唯一任务：**把数据这件事一次性做对**，之后所有章节都能放心地 `levelData.arrows` 直接用。

### 对照参考项目

G3_FBase 里这部分对应：

- `G3_FBase_Namespace.ts` 定义了 `LevelConfig` 接口和嵌套类型
- `res/configs/Level_00001.json` 是实际的关卡数据文件
- `src/configs/G3_FBase_LevelConfig.ts` 用 `ConfigAtom` 包装了 JSON URL
- `src/logics/G3_FBase_LevelConfigGenLogic.ts` 做加载后的数据转换

四个文件分了 4 个职责。**我们这里合并成两个文件**：一个类型定义 + 一个加载逻辑，不需要那么多层。

---

## 实现思路

### 数据结构（完全参考 G3_FBase 原始结构）

参考项目首关的 JSON 是这样：

```json
{
  "rows": 5,
  "cols": 5,
  "arrows": [
    {
      "direction": [0, 1],
      "origin": [1, 3],
      "coords": [[1,1], [1,2], [1,3]]
    },
    ...
  ]
}
```

我们**原样沿用**这个结构。理由：

1. 它已经经过生产验证。
2. 每个字段都有明确含义（见下表），没有冗余。
3. 将来如果要从 G3_FBase 拷关卡数据过来，零转换成本。

**字段含义**：

| 字段 | 类型 | 含义 |
|------|------|------|
| `rows` | number | 棋盘行数（竖直方向格子数量） |
| `cols` | number | 棋盘列数（水平方向格子数量） |
| `arrows` | 数组 | 关卡里的所有箭头 |
| `arrows[].direction` | `[dr, dc]` | 箭头方向向量。`[0, 1]` = 行不变、列 +1 = **向右**；`[1, 0]` = **向下**；`[-1, 0]` = **向上**；`[0, -1]` = **向左** |
| `arrows[].origin` | `[r, c]` | 箭头"头"所在的格子坐标（行, 列） |
| `arrows[].coords` | `[[r,c], ...]` | 箭头占据的所有格子，**从尾到头**顺序排列 |

> **坑预警**：坐标都是 **"行在前、列在后"**（`[row, col]` 即 `[y, x]`），不是数学习惯的 `(x, y)`。这是跟 G3_FBase 保持一致，且符合"二维数组第一维是行"的普遍约定。**第 03 章我们会把 `[row, col]` 转成像素 `(x, y)`**。

### 加载流程

Cocos 3.8 里有两种加载 JSON 的方式：

| 方式 | 适用场景 |
|------|----------|
| `@property(JsonAsset)` 拖拽引用 | 关卡是固定的、预先知道的 |
| `resources.load('levels/level_01', JsonAsset)` | 需要按关卡号动态加载 |

**我们选后者**。理由：

- 游戏是多关卡的，玩家打到第 5 关才加载 level_05.json，不应全量加载。
- 关卡号存在 GameData 里（第 18 章），配合 `resources.load()` 刚好。
- 对应 G3_FBase 里 `LevelConfigUrl.ConfigUrl = this.url('res/configs/Level_00001')` 的写法。

### 数据流

```
┌─────────────────────┐
│  level_01.json (磁盘) │
└──────────┬──────────┘
           │ resources.load()
           ▼
┌─────────────────────┐
│  JsonAsset (Cocos)  │
└──────────┬──────────┘
           │ asset.json （读出原始对象）
           ▼
┌─────────────────────┐      校验 + 类型标注
│  LevelData (纯 TS)  │  ◄── 后续章节都用这个
└─────────────────────┘
```

---

## 代码实现

### 文件 1：`assets/scripts/core/LevelData.ts`（类型定义）

在 `scripts/core/` 下新建 `LevelData.ts`。

```typescript
/** 箭头方向向量：[行增量, 列增量] */
export type Direction = [number, number];

/** 格子坐标：[行, 列] */
export type Cell = [number, number];

/** 一根箭头的数据 */
export interface ArrowData {
    direction: Direction;
    origin: Cell;
    coords: Cell[];
}

/** 一关的完整数据 */
export interface LevelData {
    rows: number;
    cols: number;
    arrows: ArrowData[];
}

/**
 * 校验 JSON 是不是合法的 LevelData。
 * 不合法直接抛错，因为错误的关卡数据没救。
 */
export function validateLevelData(data: unknown): LevelData {
    if (!data || typeof data !== 'object') {
        throw new Error('LevelData must be an object');
    }
    const d = data as LevelData;
    if (typeof d.rows !== 'number' || typeof d.cols !== 'number') {
        throw new Error('LevelData.rows / cols must be number');
    }
    if (!Array.isArray(d.arrows) || d.arrows.length === 0) {
        throw new Error('LevelData.arrows must be a non-empty array');
    }
    for (let i = 0; i < d.arrows.length; i++) {
        const a = d.arrows[i];
        if (!Array.isArray(a.direction) || a.direction.length !== 2) {
            throw new Error(`arrows[${i}].direction must be [dr, dc]`);
        }
        if (!Array.isArray(a.coords) || a.coords.length === 0) {
            throw new Error(`arrows[${i}].coords must be non-empty`);
        }
    }
    return d;
}
```

**注意几点**：

- **没有 `class`，全是 `interface` 和 `type`**。这是 `core/` 目录的铁律：纯数据，不挂方法。
- **没有 `import { ... } from 'cc'`**。`core/` 不依赖 Cocos，才能在任何地方跑。
- **`validateLevelData` 一旦不合法就抛错**，不做 fallback。理由：关卡数据坏了等于游戏坏了，静默容错只会让 bug 推迟暴露。对应 G3_FBase 里 `LevelConfig` 里用 `!` 断言字段必然存在的风格。

### 文件 2：`assets/resources/levels/level_01.json`（关卡数据）

在 Cocos 编辑器里打开 `assets/resources/levels/` 目录，**右键 → Create → JSON**，命名 `level_01`。

然后用系统文件管理器或 VS Code 直接打开这个 JSON 文件，把内容替换成：

```json
{
  "rows": 5,
  "cols": 5,
  "arrows": [
    { "direction": [0, 1], "origin": [2, 4], "coords": [[2, 2], [2, 3], [2, 4]] },
    { "direction": [0, 1], "origin": [3, 4], "coords": [[3, 2], [3, 3], [3, 4]] },
    { "direction": [0, 1], "origin": [4, 4], "coords": [[4, 2], [4, 3], [4, 4]] }
  ]
}
```

**为什么关卡里 3 根箭头放在 `row=2..4, col=2..4` 这 9 格、而不是 `row=1..3, col=1..3`？**

因为棋盘中心是 `(3, 3)`（`rows=5, cols=5` 的几何中心）。把有效格子放在 `(2..4, 2..4)`，9 个格子正好**以 `(3,3)` 为中心对称**——第 04 章渲染出来时，3×3 的点阵就会围绕屏幕中心均匀分布，而不是"偏左上"。这是**关卡数据的职责**：决定"哪些格子有意义"+"这些格子在棋盘里的位置"，渲染代码只做忠实翻译。参考项目 G3_FBase 的关卡数据也是这么设计的：**让有效内容自然落在棋盘中心**，而不是靠渲染层去补偿。

保存后**回到 Cocos 编辑器会自动重新导入**。Assets 面板里 `level_01` 前面的图标会变成"JSON 文件"图标。

### 文件 3：改造 `GameController.ts`（加载逻辑）

把 `scripts/game/GameController.ts` 替换为：

```typescript
import { _decorator, Component, resources, JsonAsset } from 'cc';
import { LevelData, validateLevelData } from '../core/LevelData';
const { ccclass } = _decorator;

@ccclass('GameController')
export class GameController extends Component {
    private levelData: LevelData | null = null;

    onLoad() {
        console.log('[Arrow] Game scene loaded. I am alive.');
        this.loadLevel(1);
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
                this.onLevelLoaded(levelNo, this.levelData);
            } catch (e) {
                console.error(`[Arrow] Level data invalid:`, e);
            }
        });
    }

    private onLevelLoaded(levelNo: number, data: LevelData) {
        console.log(
            `[Arrow] Level ${levelNo} loaded: ${data.rows} x ${data.cols}, arrows = ${data.arrows.length}`
        );
        const first = data.arrows[0];
        console.log(
            `[Arrow] First arrow: direction=${JSON.stringify(first.direction)} ` +
            `coords=${JSON.stringify(first.coords)}`
        );
    }
}
```

**关键点解释**：

- `resources.load(path, JsonAsset, callback)`：Cocos 3.8 加载 `resources/` 目录下资源的标准 API。第二个参数告诉引擎资源类型。
- `levels/level_01`（**不要带 `.json` 后缀**）：`resources.load` 路径规则。
  - 对：`levels/level_01` ✅
  - 错：`levels/level_01.json` ❌（Cocos 会找不到）
  - 错：`resources/levels/level_01` ❌（`resources/` 是根，不写）
- `levelNo < 10 ? '0${levelNo}' : '${levelNo}'`：把 `1` 变成 `'01'`。这样文件名 `level_01.json` 比 `level_1.json` 排序更友好（`level_10` 不会排在 `level_1` 和 `level_2` 之间）。为什么不用 `String.prototype.padStart`？它是 ES2017 引入的，Cocos 3.x 默认的 `tsconfig` `lib` 目标比它低，直接用会报 `属性"padStart"在类型"string"上不存在`。与其为一句话改全局编译选项，不如用三元表达式——零 API 依赖，解决问题。
- `asset.json`：Cocos 加载完 JsonAsset 之后，原始 JS 对象就挂在 `.json` 属性上。
- **先 `validate` 再用**：不 validate 直接用 `asset.json as LevelData` 也能跑，但运行时万一字段缺失会在很远的地方炸。**数据边界必须校验**，这是老生常谈。

---

## 运行效果

保存所有文件，Cocos 编辑器右上角点 **▶ 预览**，浏览器 F12 打开 Console，Filter 输入 `Arrow`，预期看到：

```
[Arrow] Game scene loaded. I am alive.
[Arrow] Level 1 loaded: 5 x 5, arrows = 3
[Arrow] First arrow: direction=[0,1] coords=[[2,2],[2,3],[2,4]]
```

三条日志缺一不可。

**画面依然是空白的**，这一章我们不碰画面。

---

## 易错点

### 易错 1：JSON 文件放错位置

```
assets/levels/level_01.json         ❌（不在 resources/ 下）
assets/resources/level_01.json      ❌（不在 levels/ 子目录）
assets/resources/levels/level_01.json  ✅
```

`resources.load('levels/level_01', ...)` 的路径是相对于 `assets/resources/` 的，子目录是 `levels/`，文件名是 `level_01`。三段都对才能加载到。

### 易错 2：直接 `require('./level_01.json')` 或 `import ... from ...`

```typescript
import levelData from '../../resources/levels/level_01.json';  // ❌
```

这种写法**在 Cocos 3.8 里运行时不一定有效**（打包策略不同），而且失去了"按关卡号动态加载"的能力。**始终用 `resources.load()`**。

### 易错 3：改了 JSON 内容，预览没生效

Cocos 有资源缓存。改完 JSON 后：

1. 切回编辑器窗口**等 1~2 秒**，让编辑器重新导入资源（Assets 面板那个 JSON 文件图标会闪一下）。
2. 浏览器页面 **Cmd+Shift+R / Ctrl+Shift+F5** 强制刷新（绕过浏览器缓存）。

还不行就重启 Cocos 编辑器。

### 易错 4：`validateLevelData` 里写得太松

新手常见写法：

```typescript
if (!data.arrows) data.arrows = [];  // ❌ "修复" 数据
```

这是**把错误吞掉**。关卡没有 arrows 根本不能玩，你让它"回落到空数组"结果就是游戏打开就赢了（胜利条件是所有箭头飞出 = 零箭头显然满足）。

**数据错就让它崩。早崩早好。** 这是 G3_FBase 里大量 `!` 非空断言的底层思路。

### 易错 5：为啥坐标是 `[row, col]` 不是 `[x, y]`？

因为二维数组 `grid[row][col]` 是更通用的写法（访问第 `row` 行第 `col` 列）。如果用 `[x, y]`：

- `x` 通常指列（水平）、`y` 通常指行（垂直且向上为正）
- 但 Cocos 的屏幕 y 向上、数组行索引向下，**很容易混**

我们**在 core 层统一用 `[row, col]`**，只在渲染层（第 03 章）做一次转换到 `(x, y)` 像素。**转换只发生一次**，错也只错一个地方。

---

## 扩展练习

1. **再造一关**：在 `assets/resources/levels/` 下新建 `level_02.json`，数据改成：
   ```json
   { "rows": 5, "cols": 5, "arrows": [
     { "direction": [1, 0], "origin": [3, 2], "coords": [[1,2],[2,2],[3,2]] }
   ]}
   ```
   然后改 `GameController` 的 `this.loadLevel(1)` 为 `this.loadLevel(2)`，验证 Console 打出新关卡数据。做完记得改回 `loadLevel(1)`。

2. **故意写坏**：把 `level_01.json` 的 `rows` 字段删掉，预览，观察 Console 里的报错信息。然后改回来。这一步让你记住 `validateLevelData` 的错误格式。

3. **思考题**：如果将来关卡除了 `arrows` 还要加障碍物 `obstacles`，你会：
   - (a) 直接在 `LevelData` 里加字段
   - (b) 把 `LevelData` 拆成 `LevelDataV1 / LevelDataV2` 两个类型
   - (c) 用 `extends` 搞继承
   
   你的选择和理由是什么？提示：看一下 G3_FBase 里 `LevelConfig` 有没有多版本的影子，它怎么处理的。

---

**本章结束时的工程状态**：

```
arrow/assets/
├── resources/levels/level_01.json     ← 新增
├── scenes/Game.scene
└── scripts/
    ├── core/LevelData.ts              ← 新增
    └── game/GameController.ts         ← 改造
```

下一章：**03 · 坐标系统：格子坐标 ↔ 像素坐标** —— 搞清楚 `[row=1, col=1]` 应该画在屏幕上的哪个像素。
