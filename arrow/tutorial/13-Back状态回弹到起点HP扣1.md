# 13 · Back 状态：回弹到起点 + HP 扣 1

## 本节目标

**被挡箭头撞到目标后自动回弹到原位，HP 扣 1，箭头保持红色（失败标记）**。

预期：

- 承接第 12 章，被挡箭头 Collide → 撞到目标 → Back 状态 → **缓慢往回退到原点** → 回到 Idle。
- GameController 内部 `hp` 从 3 降到 2。
- 回弹完成后箭头**仍然是红色**（hasFailed = true），可以再次被点击。
- Console：
  ```
  [Arrow] Arrow 0 bounced back. HP = 2
  ```

一句话：**完整失败路径闭环**。

---

## 需求分析

### Back 要干什么

- 从"当前位置（撞击点）"**反向移动**回到"原始起点"。
- 到位后切 Idle，同时标记 hasFailed（这是 markCollide 已经做的事）。
- 通知 GameController 扣 HP。

### 原始起点 = ?

`ArrowData.coords` 是关卡配置里的**原始起点 coords**。箭头回到这里就是回原位。

### 怎么反向移动

和 tickStart 对称——每个 coord 往 `-direction` 方向挪一格。

```typescript
rt.coords = rt.coords.map(([r, c]) => [r - direction[0], c - direction[1]] as Cell);
```

停止条件：**head 回到原始 head 格子**（即 `originalCoords[last]`）。

---

## 实现思路

### 数据结构

需要知道"每根箭头的原始 coords"。有两个来源：

1. `LevelData.arrows[i].coords`：配置里有。
2. 给 runtime 加 `originCoords` 字段缓存。

**选 1**。理由：

- `levelData` 全局可得，数据已经在那里。
- 不增加 runtime 复杂度。

**`ArrowRuntime` 不加新字段**。

### tickBack

```typescript
export function tickBack(
    rt: ArrowRuntime, direction: Direction, originHead: Cell,
    dt: number, speed: number,
): boolean {  // 返回是否已回到原位
    if (rt.mode !== ArrowMoveMode.Back) return false;

    rt.progress += speed * dt;
    while (rt.progress >= 1) {
        rt.progress -= 1;
        rt.coords = rt.coords.map(
            ([r, c]) => [r - direction[0], c - direction[1]] as Cell
        );
        const head = rt.coords[rt.coords.length - 1];
        if (head[0] === originHead[0] && head[1] === originHead[1]) {
            rt.progress = 0;
            return true;
        }
    }
    return false;
}
```

**对称于 tickStart/tickCollide**。这是代码"好品味"的体现——**几乎相同的形状，用相同的结构写**。

### HP 存哪里

GameController 新增字段：

```typescript
private hp = 0;
```

关卡加载时初始化（从 Config 或 LevelData），Back 到位时 `hp -= 1`。第 14 章把 hp 显示到 HUD。

---

## 代码实现

### 文件 1：`core/ArrowState.ts` 加 `tickBack`

```typescript
/**
 * 每帧推进 Back 状态。返回 true 表示已回到 originHead。
 * 调用方应当在 true 时调用 markBack(rt) 切回 Idle。
 */
export function tickBack(
    rt: ArrowRuntime, direction: Direction, originHead: Cell,
    dt: number, speed: number,
): boolean {
    if (rt.mode !== ArrowMoveMode.Back) return false;

    rt.progress += speed * dt;
    while (rt.progress >= 1) {
        rt.progress -= 1;
        rt.coords = rt.coords.map(
            ([r, c]) => [r - direction[0], c - direction[1]] as Cell
        );
        const head = rt.coords[rt.coords.length - 1];
        if (head[0] === originHead[0] && head[1] === originHead[1]) {
            rt.progress = 0;
            return true;
        }
    }
    return false;
}
```

注意：**Back 状态的 progress 偏移是反方向的**，ArrowView 原先算 `offR = direction[0] * progress` 会朝错方向偏。下一步改 ArrowView。

### 文件 2：`ArrowView.ts` 的 progress 偏移处理 Back

```typescript
private drawArrow(rt: ArrowRuntime) {
    const g = this.graphics!;
    g.clear();

    const { direction } = this.data!;
    const coords = rt.coords;
    if (coords.length === 0) return;

    // Back 状态下往反方向偏（与 Start/Collide 相反）
    const sign = rt.mode === ArrowMoveMode.Back ? -1 : 1;
    const offR = direction[0] * rt.progress * sign;
    const offC = direction[1] * rt.progress * sign;

    // ... 其他不变
}
```

**只加了一个 `sign`**。用 `1/-1` 而不是 if-else，是 Linus 的那种"消除特殊情况"。

### 文件 3：`game/GameController.ts` 处理 Back

在 update 的 switch 里加一个分支，同时维护 HP：

```typescript
import { tickBack, markBack } from '../core/ArrowState';

/** 当前生命值（第 14 章会显示到 HUD） */
private hp = 0;
/** HP 初始值 */
private readonly HP_MAX = 3;

// onLevelLoaded 末尾加：
this.hp = this.HP_MAX;
console.log(`[Arrow] HP = ${this.hp}`);

// update 里加一个 else if 分支：
update(dt: number) {
    if (!this.levelData) return;
    const { rows, cols } = this.levelData;
    const now = director.getTotalTime() / 1000;

    for (let i = 0; i < this.runtimes.length; i++) {
        const rt = this.runtimes[i];
        const dir = this.levelData.arrows[i].direction;

        if (rt.mode === ArrowMoveMode.Start) {
            tickStart(rt, dir, dt, Config.arrowSpeed);
            const tail = rt.coords[0];
            if (!isInsideBoard(tail[0], tail[1], rows, cols)) {
                markEnd(rt);
                console.log(`[Arrow] Arrow ${i} escaped (End)`);
            }
            this.refreshArrow(i);

        } else if (rt.mode === ArrowMoveMode.Collide) {
            const arrived = tickCollide(rt, dir, dt, Config.arrowSpeed);
            if (arrived) {
                const target = this.findTargetAt(rt.collideAim!);
                if (target >= 0) {
                    markHitFlash(this.runtimes[target], now + 0.2);
                    this.refreshArrow(target);
                }
                markCollide(rt);
                console.log(`[Arrow] Arrow ${i} collided into arrow ${target}`);
            }
            this.refreshArrow(i);

        } else if (rt.mode === ArrowMoveMode.Back) {
            const originCoords = this.levelData.arrows[i].coords;
            const originHead = originCoords[originCoords.length - 1];
            const arrived = tickBack(rt, dir, originHead, dt, Config.arrowSpeed);
            if (arrived) {
                markBack(rt);  // Back → Idle
                this.hp -= 1;
                console.log(`[Arrow] Arrow ${i} bounced back. HP = ${this.hp}`);
            }
            this.refreshArrow(i);

        } else if (rt.hitFlashUntil > 0 && now >= rt.hitFlashUntil) {
            rt.hitFlashUntil = 0;
            this.refreshArrow(i);
        }
    }
}
```

**关键**：

- Back 的 `originHead` 直接从 `levelData.arrows[i].coords` 取最后一个。
- `markBack` 只负责切状态到 Idle，不扣 HP。**扣 HP 是 GameController 的职责**（core 不懂 HP 是什么）。这是**关注点分离**。

### 文件 4：调 `resetToIdle` 时也要清 `collideAim` 和 `hitFlashUntil`

回到第 07 章的 `resetToIdle` 补一下：

```typescript
export function resetToIdle(rt: ArrowRuntime, data: ArrowData): void {
    rt.mode = ArrowMoveMode.Idle;
    rt.coords = cloneCoords(data.coords);
    rt.hasFailed = false;
    rt.progress = 0;
    rt.collideAim = null;
    rt.hitFlashUntil = 0;
}
```

---

## 运行效果

还是用第 12 章那套 "箭头 0 必撞 1" 的临时关卡。

点击箭头 0：

1. 变红向右飞（Collide）。
2. 撞到箭头 1 头部停下（状态切 Back）。
3. **开始慢慢向左退**（progress 反向偏移）。
4. 退到原点 `[3,1]~[3,2]` 停下，切 Idle。
5. 仍然显示红色（hasFailed=true）。
6. Console：
   ```
   [Arrow] Arrow 0 fired. blocked=true
   [Arrow] Arrow 0 collided into arrow 1
   [Arrow] Arrow 0 bounced back. HP = 2
   ```

**再次点击箭头 0**：它仍可 fire（Idle 状态），继续撞 → 回弹 → HP=1。第三次撞 → HP=0。再撞 → HP=-1（没有停止保护，第 16 章会加）。

**验证完改回 `level_01.json`**。

---

## 易错点

### 易错 1：Back 的 progress 偏移方向搞反

```typescript
// ArrowView.drawArrow
const offR = direction[0] * rt.progress;  // ❌ 没 sign，Back 也朝前偏
```

视觉上 Back 时箭头一边整体反向移动一边"头向前冒一截"，非常鬼畜。

**规则**：记住 Back 是 "反向" 的 tick。任何 progress 偏移都要 `* sign`。

### 易错 2：`originHead` 拿成了 runtime 当前 head

```typescript
const originHead = rt.coords[rt.coords.length - 1];  // ❌ 当前位置
```

结果：Back tick 第一帧立刻"到达"，箭头瞬移回去。

**规则**：Back 要回的是**配置原点**，不是 runtime 当前位置。**`levelData.arrows[i].coords[last]`**。

### 易错 3：HP 扣在了错误的地方

常见错位置：

- `markCollide` 里扣 HP ❌（撞到就扣，还没回弹完）
- `fire(rt, true)` 里扣 HP ❌（点一下就扣，即使后来取消）
- `update` Back 分支**到达原点时**扣 HP ✅

**规则**：HP 是"失败代价"，**失败流程完整结束时**（回到原点）才结算。参考 G3_FBase 的逻辑也是这样——在 `MovingBackLogic` 里 distance <= velocity 时切 Idle，然后（虽然代码里没直接写扣 hp，它应该在别处）完成失败循环。

### 易错 4：Back 状态下玩家点击同一根箭头

```typescript
private onArrowClick(idx) {
    if (!canFire(rt)) return;  // ✅ canFire 只允许 Idle
    ...
}
```

第 07 章的 `canFire(rt)` 已经限定 `rt.mode === Idle`，Back 时点击无效。**自动挡住了**。这是状态机设计的红利——不需要"专门为 Back 加个判断"。

### 易错 5：reset 没清干净字段

上面补完 `resetToIdle` 清所有字段。如果漏了 `hitFlashUntil`，重试关卡时某些箭头会突然闪红（上次残留）。

**规则**：**有新字段就立刻同步 resetToIdle**。可以通过 TypeScript 的 satisfies 约束，但最简单就是每次改 runtime 接口都过一遍 resetToIdle。

---

## 扩展练习

1. **回弹加速**：让 Back 速度比 Start 快 2 倍（回弹比射出更快，玩家感受"失败代价过得快一点"）。改 `tickBack` 调用时的 speed 参数。

2. **箭头先停顿再回弹**：在 Collide → Back 切换时插入 200ms 停顿（视觉上"撞了一下再弹回"）。提示：给 rt 加一个 `backDelayUntil` 字段，tickBack 里判断 `now < backDelayUntil` 就不动 progress。

3. **思考题**：现在 Back 到原点后 `markBack` 把 mode 设成 Idle，玩家可以立刻再点击这根箭头。好不好？如果要加"冷却时间"（Back 后 1 秒才能再点），从数据结构层面怎么设计？

---

**工程状态**：

```
core/
├── ArrowState.ts             ← 加 tickBack + resetToIdle 清字段
├── CollisionCheck.ts
├── Coord.ts
└── LevelData.ts
game/
├── ArrowView.ts               ← progress sign 判别 Back
├── BoardView.ts
├── GameController.ts          ← update 加 Back 分支 + hp
└── InputController.ts
```

**第四部分（碰撞与回弹）收尾**。失败路径完整闭环。

下一章：**14 · HUD 顶栏：HP + 关卡编号** —— 把数字显示到屏幕上，玩家终于能看到进度。
