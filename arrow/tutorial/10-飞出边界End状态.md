# 10 · 飞出边界 = End 状态

## 本节目标

**箭头飞到棋盘外之后停下来、标记为 End**，而不是无止境飞到屏幕外。

预期：

- 点箭头 0 → 向右飞 → 飞到 `col > cols` 时停下 → 标记 End。
- End 状态箭头仍然显示（在棋盘外一格位置），**颜色维持蓝色**或可选渐隐（本教程保持蓝色）。
- Console 打印：`[Arrow] Arrow 0 escaped (End)`。
- 已 End 的箭头不再被 update 推进，画面稳定。

一句话：**让 Start 能自然终止**。

---

## 需求分析

Start 状态需要一个"出口"。按照玩法，出口就是"飞出棋盘边界"。判定条件：**箭头头格子已经越过棋盘边界**。

对应 G3_FBase：`MovingStartLogic.onExecute` 里：

```typescript
if (this.insideCombatBackgroundFunction(coords[0][0], coords[0][1])) {
    // 继续飞
} else {
    arrowComponent.moveMode.set(eid, G3_FBase.ArrowMoveMode.End);
    ...
}
```

**注意 G3_FBase 判的是 `coords[0]`（箭头尾）还在棋盘内**。意思是：**只要尾还在棋盘内就继续飞，尾飞出了才停**——这样箭头会整根飞出。我们沿用这个规则。

---

## 实现思路

### 何时判边界

每次 `tickStart` 把 coords 前移一格后，检查 `coords[0]`（尾）是否还在棋盘内：

- 在 → 继续 Start
- 不在 → 调 `markEnd(rt)`，状态变 End

```typescript
if (!isInsideBoard(rt.coords[0][0], rt.coords[0][1], rows, cols)) {
    markEnd(rt);
}
```

**`isInsideBoard` 第 03 章已经写好**，直接用。

### 放哪里

两种选择：

- A. `tickStart` 函数内部自己判。
- B. GameController 的 `update` 里判。

**选 B**。理由：

- `tickStart` 是纯函数，**不应该关心棋盘边界**（棋盘尺寸不属于单个箭头的状态）。
- 边界判定需要 `rows / cols`，传给 tickStart 就污染了函数签名。
- 写在 update 里，逻辑在一处，容易理解。

对应参考项目：G3_FBase 把这判定耦合在 `MovingStartLogic` 里（它就是 tickStart），所以它要 bind `InsideCombatBackgroundFunction`。这是**过度绑定**。我们做得更干净。

> **Linus 的品味**：**消除不必要的参数传递**。函数只吃它真正需要的数据，不吃"方便起见顺便传进来"的东西。

---

## 代码实现

### 文件 1：`game/GameController.ts` 的 `update` 扩展

只改这一处：

```typescript
import { isInsideBoard } from '../core/Coord';
import {
    createRuntime, fire, canFire, tickStart, markEnd,
    ArrowRuntime, ArrowMoveMode,
} from '../core/ArrowState';

// ...

update(dt: number) {
    if (!this.levelData) return;

    const { rows, cols } = this.levelData;
    for (let i = 0; i < this.runtimes.length; i++) {
        const rt = this.runtimes[i];
        if (rt.mode !== ArrowMoveMode.Start) continue;

        const dir = this.levelData.arrows[i].direction;
        tickStart(rt, dir, dt, Config.arrowSpeed);

        // 箭头尾已离开棋盘 → End
        const tail = rt.coords[0];
        if (!isInsideBoard(tail[0], tail[1], rows, cols)) {
            markEnd(rt);
            console.log(`[Arrow] Arrow ${i} escaped (End)`);
        }

        this.refreshArrow(i);
    }
}
```

**注意**：

- **`markEnd` 后仍然 refreshArrow**。让画面更新到"停下来"的最终状态。
- **不把 End 状态的箭头从数组移除**。状态只是"标记成功"，数据还在，第 15 章胜利判定会遍历数组看所有箭头是不是都 `>= Start`。

### 文件 2：`ArrowView.ts` 的 `pickColor` 微调（可选）

End 状态继续用蓝色是合理的（参考项目 `arrowMoveColor` 覆盖 Start 和 End）。本教程沿用第 08 章写的 `pickColor`，**不需要改**。

如果你想让已 End 的箭头半透明，改成：

```typescript
private pickColor(rt: ArrowRuntime): Color {
    if (rt.mode === ArrowMoveMode.End) {
        // 半透明蓝色
        return new Color(0x5b, 0x72, 0xfe, 0x80);
    }
    // ... 其他不变
}
```

可选，美化练习。

---

## 运行效果

点击箭头 0 → 向右匀速飞 → **尾离开棋盘的瞬间**箭头停下（head 应该在 col=6 或 7 那儿，彻底飞出 col=5 边界）。

Console：

```
[Arrow] Arrow 0 fired. mode = Start
[Arrow] Arrow 0 escaped (End)
```

画面：箭头停在棋盘右侧外 1~2 格位置，颜色仍蓝。

---

## 易错点

### 易错 1：判的是 `coords[head]` 而不是 `coords[0]`

```typescript
const head = rt.coords[rt.coords.length - 1];
if (!isInsideBoard(head[0], head[1], rows, cols)) markEnd(rt);  // ❌
```

结果：**头刚离开边界就停**，整个箭头还在棋盘内 → 看起来没飞出去。

**规则**：**判尾**。尾走到棋盘外才算整根飞出。

### 易错 2：markEnd 之后 update 继续 tickStart

```typescript
update(dt) {
    for (const rt of runtimes) {
        tickStart(rt, ...);       // ❌ 没判状态
        if (边界外) markEnd(rt);
    }
}
```

看起来能跑，但本帧先 tick 了一步（progress 推进）才 markEnd，markEnd 把 progress 清零——**数据没错**，但**下一帧**这个 rt.mode 已经是 End，tickStart 会 noop（内部有前置检查）。所以实际行为等价。

**但写法上不干净**。规范：**for 循环开头 `if (rt.mode !== Start) continue;` 跳过**，让意图清晰。

### 易错 3：边界检查用 `<=` 而不是 `<`

```typescript
if (rt.coords[0][0] > rows || rt.coords[0][0] < 1) markEnd(rt);
```

这个没问题。但新手常写：

```typescript
if (row >= rows) markEnd(rt);  // ❌ row 到了 rows（最后一行）就停
```

**规则**：`isInsideBoard` 已经封装对了（`row >= 1 && row <= rows`）。**直接用 `isInsideBoard` 的非，不要自己重新比较**。

### 易错 4：update 里 console.log 刷屏

```typescript
console.log('tick', dt);  // ❌ 每帧一条，很快把 Console 打爆
```

**规则**：**`update` 里绝对不写日志**，除非你明确知道什么时候打。"状态变化时打一条"（比如 markEnd 时）是 OK 的，"每帧都打"一定是坏味道。

---

## 扩展练习

1. **End 后移除节点**（美化选项）：在 markEnd 时同步调用 `arrowView.node.destroy()`，让飞出去的箭头真的消失。注意同步清理 `BoardView` 的 `arrowViews` 数组。

2. **飞太快的边界情况**：把 `Config.arrowSpeed` 调到 100，看 End 判定是否仍然精确。如果画面瞬移到屏幕外很远，说明你没用 `while` 吃 progress（第 09 章讲过）。

3. **思考题**：游戏中途如果玩家切换到其他 app 再切回来，dt 可能会传入一个 1~2 秒的大值。这时候 `tickStart` 用 while 消耗 progress 可能一次处理十几格——此时边界判定仍然对吗？（Hint：while 循环内部也要判边界！）

   进阶做法：把"tick + 边界检查"都写在 `tickStart` 里的 while 循环里，每走一格都判一次。但这又污染了 tickStart 的签名。怎么取舍？

---

**工程状态**（10 章累计）：

```
core/
├── ArrowState.ts
├── Coord.ts
└── LevelData.ts
common/
└── Config.ts
game/
├── ArrowView.ts
├── BoardView.ts
├── GameController.ts       ← update 加边界 → End
└── InputController.ts
```

**第三部分（状态机核心）收尾**：Idle → Start → End 的"成功路径"全部打通。

下一章：**11 · 碰撞检测纯函数** —— 判断"一根箭头点击时前方是否有挡"。从这里开始进入失败路径。
