# 02 · Fisher–Yates 洗牌与难度

> **目标**：开局把 9 块打乱。让玩家看到一盘"乱七八糟"的拼图，而不是"已经拼好"。
>
> 完成后再点预览，**每次刷新都是不同的乱序状态**。

---

## 起点回顾

01 节末态：

- `slots: number[]` 长度 9，初值 `[0, 1, 2, ..., 8]`。
- `layoutAllPieces()` 按 slots 摆位：每个 `pieceNodes[pid]` 移到 `slotToPosition(slots.indexOf(pid))`。
- 9 块在屏幕上拼成完整图。

本节只改一件事：**`onLoad` 里在 `layoutAllPieces` 之前洗牌 slots**。

`layoutAllPieces` 一行不动——它读 slots 现算位置，slots 变了它自然跟着变。这就是 01 节"位置是 slots 的投影" 的红利。

---

## 1. Fisher–Yates 算法（10 行）

数学上等概率打乱长度 N 的数组。**最简版**：

```typescript
function shuffle<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}
```

**怎么走**：

- 从尾到头，i = N-1, N-2, ..., 1
- 每次在 `[0, i]` 闭区间随机选一个下标 j
- 交换 `arr[i]` 和 `arr[j]`

**为什么等概率**：

- i = N-1 时随便选谁放尾巴 → 任何元素都有 1/N 概率落在最后位
- i = N-2 时在剩下 N-1 个里随便选 → 倒数第二位概率也是 1/N
- ...
- 数学归纳：每个元素出现在每个位置的概率都是 1/N

**反例**：很多人初学时写"每个位置都和随机位置交换"：

```typescript
for (let i = 0; i < arr.length; i++) {
    const j = Math.floor(Math.random() * arr.length); // 错误！范围是 [0, N) 而不是 [0, i+1)
    [arr[i], arr[j]] = [arr[j], arr[i]];
}
```

这样写**不等概率**——靠后的元素会偏少出现在前面（数学证明请翻 Knuth 的《计算机程序设计艺术》）。

**Fisher–Yates 是 in-place + O(N) + 等概率，是 1938 年发明的算法，到现在没人能再优化**。

---

## 2. 散度阈值：避免"洗了等于没洗"

直接洗牌有概率洗出"几乎拼好"的局面（比如 9 块只有 2 块换了位置）。**玩家会以为"是不是 bug，怎么没洗"**。

引入"散度"概念：

```typescript
function countMisplaced(slots: number[]): number {
    let count = 0;
    for (let i = 0; i < slots.length; i++) {
        if (slots[i] !== i) count++;
    }
    return count;
}
```

`countMisplaced(slots)` = 不在正确位置的块数。完美洗牌后理论期望值 ≈ N（9 块基本都不在正确位置），实际值因随机波动可能低到 0~3。

**做法**：洗一次 → 数 misplaced → 不够散就重洗。

---

## 3. 改 `PuzzleBoard.ts`：加 `shuffleSlots`

打开 `PuzzleBoard.ts`，**在 `initSlots` 后面加一个新方法**，并改 `onLoad`：

```typescript
@property({ tooltip: '洗牌散度阈值（0~1，0.7 表示至少 70% 的块不在原位）' })
scatterRatio: number = 0.7;

@property({ tooltip: '洗牌最大重试次数（避免极端情况下的死循环）' })
maxShuffleAttempts: number = 100;

onLoad() {
    if (!this.sourceImage) {
        console.error('[PuzzleBoard] 源图未设置');
        return;
    }
    this.initSlots();
    this.shuffleSlots(); // ← 02 节新增
    this.createPieces();
    this.layoutAllPieces();
}

/**
 * 洗 slots 直到达到散度阈值。
 *
 * 逻辑：
 *   1. Fisher-Yates 打乱
 *   2. 数 misplaced 数
 *   3. 不够散 → 再洗（直到达标或超过 maxShuffleAttempts）
 *
 * 重试上限是兜底——3×3 时 N=9, scatterRatio=0.7 → 阈值 6 块错位，
 * 平均洗一次就达标，几乎不会重试。但 scatterRatio 设到 1.0 时
 * 数学上不可能达成（9 块全错位的"完全错排" 概率约 37%），需要这个上限。
 */
private shuffleSlots(): void {
    const minMisplaced = Math.floor(this.pieceCount * this.scatterRatio);
    let attempts = 0;
    while (attempts < this.maxShuffleAttempts) {
        this.fisherYates(this.slots);
        attempts++;
        const misplaced = this.countMisplaced(this.slots);
        if (misplaced >= minMisplaced) {
            console.log(
                `[PuzzleBoard] 洗牌完成 — pieceCount=${this.pieceCount}, ` +
                `misplaced=${misplaced}, attempts=${attempts}`,
            );
            return;
        }
    }
    console.warn(
        `[PuzzleBoard] 洗牌 ${this.maxShuffleAttempts} 次仍未达标，使用最后一次结果。`
        + ` 检查 scatterRatio 是否过高。`,
    );
}

/** Fisher-Yates 原地等概率打乱 */
private fisherYates(arr: number[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

/** 数有多少块不在正确位置（slots[i] !== i） */
private countMisplaced(arr: number[]): number {
    let count = 0;
    for (let i = 0; i < arr.length; i++) {
        if (arr[i] !== i) count++;
    }
    return count;
}
```

---

## 4. 跑起来

▶ 预览。**每次刷新看到不同的乱序拼图**。

**控制台预期**：

```
[PuzzleBoard] 洗牌完成 — pieceCount=9, misplaced=8, attempts=1
```

`misplaced` 从 6（minMisplaced）到 9（最大值，全错位）都正常，`attempts=1` 99% 的情况都是。

**不正常的信号**：

- **每次刷新都是同一个局面**：`Math.random` 在 Cocos Creator 编辑器里每次重启场景的种子可能一致——但浏览器预览不会，应该没问题。如果真重复，重启编辑器或 Cocos Dashboard。
- **`洗牌 100 次仍未达标` 警告**：scatterRatio 调太高（≥1.0 数学上不可能）。改回 0.7。
- **9 块全在原位（看起来是整图）**：`shuffleSlots` 没被调用，或调用顺序错了。检查 `onLoad` 里 shuffleSlots 在 layoutAllPieces 之前。
- **块的图错位**：layoutAllPieces 是按 `slots.indexOf(pid)` 找槽位——不是按 `slots[idx]`。两者是反的关系。如果你看到"3 号块的图出现在 5 号槽，但行为像 5 号块"，多半是 layoutAllPieces 的索引方向写反了，回 01 节核对。

---

## 5. 复盘：这节教了什么

**1. 位置是 slots 的投影**

01 节就埋下的红利在本节兑现：**洗牌只动 slots 这一个数组，layoutAllPieces 自动跟着变**。

如果 01 节我们 hard-code 了"块 N 永远在屏幕坐标 (X, Y)"，本节加洗牌就要一边改 slots 一边手动挪 9 个 Node——**两份真相** 立刻出 bug。

**坚持"位置是投影" 的好处**：

- 增加新玩法 → 只改 slots，view 跟着变。
- 修 bug → 看 slots 算错没，不用看 view。
- 重玩 / 重置 → 重写 slots 即可，不用重设 9 个 position。

这是后续每一节的基础。

**2. Fisher–Yates 是经典算法**

10 行代码，1938 年发明。**到现在没人能优化**——这是数据结构课该背下来的算法之一。

记住三个特点：

- **In-place**：不开新数组，O(1) 空间。
- **O(N) 时间**：每个元素只交换一次。
- **等概率**：每个元素出现在每个位置的概率都是 1/N。

写错了（比如范围 `[0, N)` 而不是 `[0, i+1)`）就**等概率不再成立**——很多商业游戏的洗牌都被发现过这种"不公平"的 bug。

**3. "重洗到达标" 是经典工程兜底**

有"概率达不到要求" 的随机算法，要带 **重试上限**。

`while (attempts < maxAttempts)`：

- **不带上限** → scatterRatio 过高时死循环，游戏卡死。
- **不带计数** → 不知道是"一次就成"还是"试了 50 次"——上线后调参时摸黑。
- **超限 + 警告** → 用户能看到出错原因，要么调阈值要么找 bug。

这种"概率算法 + 兜底" 的写法在游戏开发里很常见：随机怪物刷新、随机地图生成、随机奖励掉落，**全要带这个兜底**。

**4. `Math.random` 不是真随机**

JS 的 `Math.random` 返回 `[0, 1)` 区间的伪随机数，**生命周期内全靠引擎提供**。多数引擎用 xorshift / xoroshiro 之类的伪随机算法。**够用**——除非你做赌博类应用。

如果将来要"可重现的随机"（玩家分享同一个种子复现局面），换成 `seedrandom` npm 包：

```typescript
import seedrandom from 'seedrandom';
const rng = seedrandom('某个种子字符串');
const r = rng(); // [0, 1)
```

教学版用 `Math.random` 即可。

---

## 6. 常见坑

- **scatterRatio 设 1.0 死循环**：N=9 时全错位（"完全错排"）的概率约 e⁻¹ ≈ 36.8%。100 次重试达成的概率 ≈ 1 - 0.632¹⁰⁰ ≈ 100%——但万一没达成就走 maxAttempts 警告分支。**实操建议** scatterRatio ∈ [0.5, 0.85]。
- **`Math.floor(Math.random() * (i + 1))` 写成 `i` 而不是 `i + 1`**：范围变成 `[0, i)`，第 i 位永远不会跟自己交换 → **第一个元素永远不动** → 等概率不成立。**记住**：`Math.random() * N` 给出 `[0, N)` 区间，floor 后是 `[0, N-1]` 整数，刚好是 N 个候选。
- **`[arr[i], arr[j]] = [arr[j], arr[i]]` 解构赋值**：JS 这个语法**确实**等价于"用临时变量交换"，但有人会问"会不会先算 arr[j] 把它存了，再算 arr[i] 时已经被覆盖"？不会——右侧先创建一个临时数组 `[arr[j], arr[i]]`，再分别赋给左侧。**安全**。
- **洗完 slots 但块没动**：你可能洗完直接 `console.log` 了 slots，但忘了 `layoutAllPieces`。或者 layoutAllPieces 在洗牌**之前**调了——onLoad 顺序看好。
- **没改 onLoad 直接加方法**：方法定义在 class 里，但没人调用，等于没写。检查 onLoad 里是否真的调 `this.shuffleSlots()`。

---

## 7. 下一节预告

9 块打乱了——**玩家想拖却拖不动**，块都是死的。

**03 节**：让块**跟手**。

- 监听 Cocos 触摸事件 `touchstart / touchmove / touchend`。
- 拖动期间 Node.position 跟着手指走。
- **松手弹回**——本节不做命中判定，松手一律弹回原槽。
- 引入 "**零状态拖拽**" 设计：不存"按下时的位置"等中间状态，弹回靠 `slots.indexOf(pid)` 现算。

完成后你能"按住一块拖到半空 → 松手块滑回原位"。这是后续所有玩法的输入基础。
