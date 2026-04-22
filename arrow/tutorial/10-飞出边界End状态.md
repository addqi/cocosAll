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

Start 状态需要一个"出口"。按照玩法，出口就是"飞出棋盘边界"。判定条件：**箭头尾格子已经离开棋盘**——意思是"整根都飞出去了"。

对应 G3_FBase：`MovingStartLogic.onExecute` 里：

```typescript
if (this.insideCombatBackgroundFunction(coords[0][0], coords[0][1])) {
    // 继续飞
} else {
    arrowComponent.moveMode.set(eid, G3_FBase.ArrowMoveMode.End);
    ...
}
```

**注意 G3_FBase 判的是 `coords[0]`（箭头尾）还在棋盘内**。我们沿用：**只要尾还在棋盘内就继续飞，尾飞出了才停**。

### 为什么贪吃蛇模型这里要特别讲"何时判"

第 09 章 `tickStart` 的 while 循环每次调 `stepOneCell`——**一帧可能 step 好几格**（页面切回来 dt 巨大的情况）。如果我们只在 while 之外判一次边界，就会出现：

- 某一 step 尾已经出界 → 继续 step → 尾又可能"被 shift 到下一格"，但它本来就不该再动了。

所以 Linus 的结论是：**判定要和推进绑在一起**。在 `tickStart` 的 while 循环里，**每 step 一格都判一次**，出界立刻 `markEnd` 并 break。

---

## 实现思路

### 每 step 判一次边界

把"尾是否出界"的检查**下放到 tickStart 内部的 while 循环**：

```typescript
while (rt.progress >= 1) {
    rt.progress -= 1;
    stepOneCell(rt);
    if (tailOutOfBoard(rt, rows, cols)) {
        markEnd(rt);
        break;
    }
}
```

这样：

- 小 dt 正常情况：每帧最多 step 1 次，判 1 次，和老版本等价。
- 大 dt 异常情况：连 step N 次，第一次尾出界就 break，不会多走一格。
- markEnd 之后 `rt.mode !== Start`，下一帧外层 update 早就跳过了。

### tickStart 的签名变化

新签名：

```typescript
tickStart(rt, dt, speed, rows, cols)
```

比第 09 章多了 `rows / cols`。**这是一次有意识的取舍**：

- 老教程（刚体平移）里把边界检查放在 `GameController.update`，因为"tickStart 不该管棋盘尺寸"。
- 但在贪吃蛇模型下，**边界检查必须和 step 原子绑定**，否则有大 dt 穿透 bug（见上）。
- 两害相权：**多两个参数，换一致性和正确性**。

> **Linus 的品味**：**消除特殊情况优先于保持函数签名干净**。如果"干净签名"导致调用方必须复现内部循环逻辑来补判定，那不是干净，是把复杂性推给了上层。

---

## 代码实现

### 文件 1：`core/ArrowState.ts` 里重写 `tickStart`

把第 09 章的 tickStart 替换为：

```typescript
import { isInsideBoard } from './Coord';

export function tickStart(
    rt: ArrowRuntime, dt: number, speed: number,
    rows: number, cols: number,
): boolean {
    if (rt.mode !== ArrowMoveMode.Start) return false;
    rt.progress += speed * dt;
    let escaped = false;
    while (rt.progress >= 1) {
        rt.progress -= 1;
        stepOneCell(rt);
        const tail = rt.coords[0];
        if (!isInsideBoard(tail[0], tail[1], rows, cols)) {
            markEnd(rt);
            escaped = true;
            break;
        }
    }
    return escaped;
}
```

**关键点**：

- **返回值 `escaped: boolean`**。true 表示本次 tick 刚刚触发 End。调用方可用来打日志/触发音效——**不返回 void 是因为"刚 End"这一事件调用方需要感知**，而 `rt.mode` 查不出"是不是本帧刚变的"。
- **循环内 break**。markEnd 一次就够，后续 step 没意义。
- **判尾 `coords[0]` 而不是头**。尾在棋盘内意味着"还有身体没飞出去"，继续动；尾都出去了才算整根逃脱。

### 文件 2：`game/GameController.ts` 的 `update` 调用方

签名变了，调用方跟着改：

```typescript
import {
    createRuntime, fire, canFire, tickStart,
    ArrowRuntime, ArrowMoveMode,
} from '../core/ArrowState';

// ...

update(dt: number) {
    if (!this.levelData) return;

    const { rows, cols } = this.levelData;
    for (let i = 0; i < this.runtimes.length; i++) {
        const rt = this.runtimes[i];
        if (rt.mode !== ArrowMoveMode.Start) continue;

        const escaped = tickStart(rt, dt, Config.arrowSpeed, rows, cols);
        if (escaped) {
            console.log(`[Arrow] Arrow ${i} escaped (End)`);
        }
        this.refreshArrow(i);
    }
}
```

**注意**：

- **rt.mode === End 之后 refreshArrow 仍然执行一次**。让画面更新到"停下来"的最终状态（尾在棋盘边缘外一格）。
- **不把 End 状态的箭头从数组移除**。状态只是"标记成功"，数据还在，第 15 章胜利判定会遍历数组看所有箭头是不是都 `>= Start`。
- **不传 direction 了**。贪吃蛇模型里方向由 coords 派生，`GameController.update` 干脆不用知道方向——这是上一章改造的直接收益。

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

### 易错 2：把边界判定放回 GameController.update 外层

```typescript
update(dt) {
    for (const rt of runtimes) {
        tickStart(rt, dt, speed);            // ❌ 不传 rows/cols
        if (!isInsideBoard(rt.coords[0][0], rt.coords[0][1], rows, cols)) {
            markEnd(rt);
        }
    }
}
```

看起来更"干净"，但在贪吃蛇模型下有个隐蔽 bug：**大 dt 时 tickStart 内部 while 会一次走多格**。假设一帧 step 5 次，第 2 次尾就出界了，但 while 继续往下推——**尾出界后又被 shift 走两格**，等外层判时位置已经"过度离开棋盘"了。

**规则**：**边界检查必须和 step 原子绑定**。参数多一点，换正确性。

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

3. **思考题（回顾）**：游戏切后台再切回来 dt 可能 1~2 秒。本章的 tickStart 已经在 while 内部判边界、一出界就 break——**这就是我们解决大 dt 的办法**。请自己走一遍代码，确认"一次 tick 最多 step N+1 格"（N = 初始 coords 长度）。

4. **L 形箭头的逃脱路径**：加载 level_02.json，点击那根 L。看它"爬"出棋盘的过程——**转角是什么时候消失的？尾什么时候判出界的？**（预期：coords 先从 L 变直线，再整根向右爬，最后尾在 col=6 的下一步出界 → End）

---

**工程状态**（10 章累计）：

```
core/
├── ArrowState.ts           ← tickStart 签名扩展为 (rt, dt, speed, rows, cols)
├── Coord.ts
└── LevelData.ts
common/
└── Config.ts
game/
├── ArrowView.ts
├── BoardView.ts
├── GameController.ts       ← update 改为 tickStart 返回 escaped 时打日志
└── InputController.ts
resources/levels/
├── level_01.json
└── level_02.json           ← 可切到这关验证 L 形逃脱
```

**第三部分（状态机核心）收尾**：Idle → Start → End 的"成功路径"全部打通。

下一章：**11 · 碰撞检测纯函数** —— 判断"一根箭头点击时前方是否有挡"。从这里开始进入失败路径。
