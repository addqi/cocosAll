# 11 · 碰撞检测纯函数（CollisionCheck）

## 本节目标

**写一个纯函数 `findCollision(shooterIdx, runtimes, rows, cols)`**，判断玩家即将点击的箭头前方是否被挡：

- 有挡 → 返回挡它的那根箭头的 index。
- 无挡 → 返回 -1。

并在 `GameController` 启动时跑一个"自检用例表"打印出来：

```
[Arrow] Collision self-test:
  arrow 0 → no collision (fire will Start)
  arrow 1 → no collision (fire will Start)
  arrow 2 → no collision (fire will Start)
```

再换个关卡（临时修改），让 1 号箭头必撞 2 号，验证输出 `arrow 1 → collided by 2`。

一句话：**为下一章"碰撞发生"准备好判定条件**。

---

## 需求分析

### 什么叫"碰撞"

箭头 A 点击后沿方向射出 → 飞过一格又一格 → 如果某一格被另一根**还没起飞**的箭头 B 占据，就算碰撞，碰在 B 身上。（已起飞 / 已逃脱的箭头让路，否则连射就崩了。）

需要判定的数据：

| 数据 | 来源 |
|------|------|
| 射手 A 的方向 | `deriveDirection(runtimes[i].coords)` —— **从 coords 末端两点派生** |
| 射手 A 当前 coords | `runtimes[i].coords` |
| 其他箭头 B 的 coords | `runtimes[j].coords` for j ≠ i |
| 只考虑 "还挡路" 的 B | `rt.mode < Start`（Idle / Collide / Back 挡路，Start / End 不挡） |

> 📖 **方向从哪来**：第 09 章已经统一——**玩法代码不读 `ArrowData.direction`**，永远从 coords 派生。好处：L 形箭头转弯后再被点击时，方向自动更新，不用额外同步。

### 对照 G3_FBase

参考项目有 `CollidePointsFunction / FindCollideTargetFunctionEx` 一组 Function Atom。从 `CombatFireLogic` 的 `collidePointsFunction(arrowIndex)` 调用看，它预计算出"这根箭头的路径上会经过哪些格子"，然后扫描这些格子检查有没有被其他箭头占。

**我们简化为"射线法"**：

从 A 头部沿方向一格一格走，检查每一格是否被某个 B 的 coords 占。走到超出棋盘就算无挡。

---

## 实现思路

### 算法

```text
输入：shooterIdx i，所有 runtimes，棋盘尺寸 rows/cols
输出：挡它的 arrowIdx（没挡就 -1）

1. 取 A.coords 派生出 direction（末端两点之差）
2. 取 A 的 head 格子（coords 最后一个）
3. cursor = head
4. 循环：
     cursor 前进一格（cursor += direction）
     如果 cursor 出了棋盘 → return -1
     对每个 j ≠ i，且 mode < Start 的 B（还没射出去的才挡路）：
         如果 cursor 在 B.coords 里 → return j
```

注意：**只判 head 前方格子是否被占**，不判 A 自己的身体。因为 A 的身体也沿方向前进，等到身体飞到那里时也已经过去了那些格子，前方的障碍才是关键。

### 数据结构：只读

`findCollision` 不能修改传入的 runtimes。加上 `readonly` 修饰：

```typescript
export function findCollision(
    shooterIdx: number,
    runtimes: readonly ArrowRuntime[],
    rows: number, cols: number,
): number;
```

**方向从 `runtimes[shooterIdx].coords` 派生**（贪吃蛇模型的定式：末尾两格之差），所以签名里没有 `direction` 参数——调用方不用关心这个细节。

---

## 代码实现

### 文件 1：`core/CollisionCheck.ts`（新增）

```typescript
import { ArrowRuntime, ArrowMoveMode, deriveDirection } from './ArrowState';
import { isInsideBoard } from './Coord';

/**
 * 判断箭头 shooterIdx 沿 coords 派生方向射出后，前方是否有"还挡路"的其他箭头。
 * 返回挡路箭头的 index，没挡返回 -1。
 *
 * "还挡路" = mode < Start。即 Idle / Collide / Back 状态的箭头挡路；
 * 已 Start 或 End 的箭头不挡路（和 G3_FBase `mode >= Start 不挡` 语义对齐）。
 * 依赖 ArrowMoveMode 的数值顺序，改枚举顺序会破坏这个判定。
 */
export function findCollision(
    shooterIdx: number,
    runtimes: readonly ArrowRuntime[],
    rows: number, cols: number,
): number {
    const shooter = runtimes[shooterIdx];
    if (!shooter || shooter.coords.length === 0) return -1;

    const direction = deriveDirection(shooter.coords);
    if (direction[0] === 0 && direction[1] === 0) return -1;

    const head = shooter.coords[shooter.coords.length - 1];
    let r = head[0], c = head[1];

    while (true) {
        r += direction[0];
        c += direction[1];
        if (!isInsideBoard(r, c, rows, cols)) return -1;

        for (let j = 0; j < runtimes.length; j++) {
            if (j === shooterIdx) continue;
            const rt = runtimes[j];
            if (rt.mode >= ArrowMoveMode.Start) continue;  // 已起飞 / 已逃脱 → 不挡路
            if (rt.coords.some(p => p[0] === r && p[1] === c)) {
                return j;
            }
        }
    }
}
```

**关键点**：

- **`while (true)` 靠出棋盘跳出**。格子坐标是整数，`isInsideBoard` 必然在有限步内为 false。不会死循环。
- **`rt.mode >= ArrowMoveMode.Start` 才跳过**：这一条是和参考项目 G3_FBase 对齐的核心语义。
  - **Start**（正在飞）：已经起飞的箭头让路给后续点击，否则连射完全不可能——A 先飞、B 再点，B 算 A 挡？那 B 永远射不出去。
  - **End**（已逃脱）：飞出棋盘的箭头，coords 可能还留着最后几格但不应该挡。
  - **Idle / Collide / Back**（还没出去）：依然占格、依然挡路。
- **依赖枚举的数值顺序**：`Idle=0, Collide=1, Back=2, Start=3, End=4`。如果有人重排枚举，这里的 `>= Start` 就错了。`ArrowState.ts` 枚举处已有注释固定这个契约。
- **`rt.coords.some(...)` 复杂度 O(格子数)**：实际每根箭头也就 3~5 格，循环很快。不需要优化。

> **Linus 的品味**：朴素的 O(k×n×m) 循环（k = 射线长度，n = 箭头数，m = 每根箭头格子数）在真实数据量下就是最优解。**不要为了"看起来高级"引入 Map 索引和 Set 查找**。代码简单就是快。

### 文件 2：`GameController.ts` 的自检

在 `onLevelLoaded` 末尾加一段：

```typescript
import { findCollision } from '../core/CollisionCheck';

private collisionSelfTest() {
    if (!this.levelData) return;
    const lines: string[] = [];
    const { rows, cols } = this.levelData;
    for (let i = 0; i < this.runtimes.length; i++) {
        const target = findCollision(i, this.runtimes, rows, cols);
        if (target < 0) {
            lines.push(`arrow ${i} → no collision (fire will Start)`);
        } else {
            lines.push(`arrow ${i} → collided by ${target}`);
        }
    }
    console.log('[Arrow] Collision self-test:\n  ' + lines.join('\n  '));
}

// onLevelLoaded 末尾调用：
private onLevelLoaded(data: LevelData) {
    // ... 已有
    this.collisionSelfTest();
}
```

### 文件 3：改造 `onArrowClick` 使用 findCollision

在 GameController 里：

```typescript
import { findCollision } from '../core/CollisionCheck';

private onArrowClick(idx: number) {
    const rt = this.runtimes[idx];
    if (!canFire(rt)) return;

    const data = this.levelData!;
    const blocked = findCollision(idx, this.runtimes, data.rows, data.cols) >= 0;

    fire(rt, blocked);
    console.log(
        `[Arrow] Arrow ${idx} fired. blocked=${blocked} mode=${ArrowMoveMode[rt.mode]}`
    );
    this.refreshArrow(idx);
}
```

**关键**：08 章 `onArrowClick` 里的 `fire(rt, false)` 有一句注释"blocked 预检下一章再加"——这一章把它兑现。调用 `findCollision` 真的去算 `blocked`，传给 `fire`。如果前方有挡，`fire` 会把状态直接设为 `Collide`（07 章的 fire 函数里已经实现）。

**但第 12 章之前 Collide 状态还没有"动起来"的逻辑**，所以被挡的箭头会卡在 Collide 状态变红但不动。**这是预期行为**，下一章补齐。

---

## 运行效果

首关 `level_01.json` 下三根箭头方向都 `[0,1]`，从 `col 1~3` 到 `col 3~5`（等到各自出发位置），路径互不干扰。启动时 Console：

```
[Arrow] Collision self-test:
  arrow 0 → no collision (fire will Start)
  arrow 1 → no collision (fire will Start)
  arrow 2 → no collision (fire will Start)
```

**人工构造碰撞场景**（验证测试）：

临时改 `level_01.json`，让箭头 0 的前方有箭头 1 挡：

```json
{
  "rows": 5, "cols": 5,
  "arrows": [
    { "direction": [0, 1], "origin": [3, 2], "coords": [[3,1],[3,2]] },
    { "direction": [0, 1], "origin": [3, 5], "coords": [[3,3],[3,4],[3,5]] }
  ]
}
```

箭头 0：coords `[[3,1],[3,2]]` → `deriveDirection = [3,2]-[3,1] = [0,1]`（向右）。
箭头 0 head 是 `[3,2]`，沿 `[0,1]` 前进一格到 `[3,3]` —— **被箭头 1 的 coords 占** → 返回 1。

预期 Console：

```
[Arrow] Collision self-test:
  arrow 0 → collided by 1
  arrow 1 → no collision (fire will Start)
```

测试完记得把 `level_01.json` 改回来。

---

## 易错点

### 易错 1：路径从 `head` 开始（包含 head 自己）

```typescript
let r = head[0], c = head[1];
while (true) {
    // 先检查再走
    if (runtimes.some(... includes (r, c) ...)) return j;
    r += direction[0]; c += direction[1];
}
```

这里的问题：**第一次检查 head 所在格**，head 本来就是 shooter 自己，会误报。

**规则**：**先走一格再检查**。路径从 head+direction 开始，不含 head。

### 易错 2：忘了跳过 shooter 自己

```typescript
for (let j = 0; j < runtimes.length; j++) {
    // if (j === shooterIdx) continue;  ❌ 忘了
    ...
}
```

shooter 自己的 coords 包含 head，路径上扫描到 head 的**下一格**还好，但如果方向反了（未来扩展），瞬间报自己撞自己。

**规则**：**遍历他人时永远显式跳过自己**。

### 易错 3：用 `isInsideBoard` 时 rows / cols 传反

```typescript
isInsideBoard(r, c, cols, rows);  // ❌ 参数顺序错
```

5×5 看不出来，长方形棋盘立刻暴露。

**规则**：**API 参数按字典序记**。isInsideBoard(row, col, rows, cols) 一套到底。

### 易错 4：处理 `direction === [0,0]` 这种退化情况

贪吃蛇模型下，方向是 `deriveDirection(coords)` 派生的。如果某根箭头 coords 只剩 1 格（被 Back 回弹到只剩头的瞬间，或者极端关卡配了单格箭头），派生结果是 `[0, 0]`，while 循环永远 `cursor` 不动——**死循环**。

**防御式写法**（已在 findCollision 开头加好）：

```typescript
const direction = deriveDirection(shooter.coords);
if (direction[0] === 0 && direction[1] === 0) return -1;
```

这一道保险不多余：**派生值不存** ≠ **派生结果总合理**，层与层之间要有兜底。

### 易错 5：测试验证没改回 level_01.json

改 JSON 验证完了忘改回，第 12 章运行时箭头配置错乱。**做完立刻改回**。**永远保持 level_01.json 是标准首关**。

---

## 扩展练习

1. **统计全场碰撞对**：写一个 `collisionMatrix(runtimes, levelData): Map<number, number>`，返回所有 `{shooter → target}` 对。用于后面的"提示系统"或关卡难度分析。

2. **动态刷新**：`collisionSelfTest` 只在加载时跑一次。思考：当玩家已经让箭头 0 飞出去（End）后，原本被它挡住的某根箭头的碰撞状态是不是变了？如果要实时维护这张表，代价是什么？

3. **思考题**：`findCollision` 是 O(path × n × m)。如果 n=100 根箭头、path=50 格、m=10 格/根，一次判定是 50000 次比较。每帧跑一次也才 300 万次比较，现代 CPU 毫无压力。**什么样的场景才需要优化？** Linus 说："Premature optimization is the root of all evil."

---

**工程状态**：

```
core/
├── ArrowState.ts
├── CollisionCheck.ts        ← 新增
├── Coord.ts
└── LevelData.ts
common/Config.ts
game/
├── ArrowView.ts
├── BoardView.ts
├── GameController.ts         ← onArrowClick 使用 findCollision
└── InputController.ts
```

下一章：**12 · Collide 状态：撞到前方的箭头** —— 让前方有挡的箭头真的撞过去。
