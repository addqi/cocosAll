# 13 · Back 状态：贪吃蛇反走回原位 + HP 扣 1

## 本节目标

**被挡箭头撞到目标后自动沿"来时路"反向爬回原位，HP 扣 1，箭头保持红色（失败标记）**。

预期：

- 承接第 12 章，被挡箭头 Collide → 撞到目标 → Back 状态 → **沿前进时走过的路径倒放回来** → 回到 Idle。
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

- 从"当前位置（撞击点）"**沿来时路倒放**回"原始起点 coords"。
- 到位后切 Idle（同时保持 hasFailed）。
- 通知 GameController 扣 HP。

### 为什么不能"直接往反方向走"

直觉上好像"反向走"就是每格做 `coords.map(c - dir)`。但这在贪吃蛇模型下**错**，直接看例子：

```
原始 coords（L 形）:   [4,2], [3,2], [3,3], [3,4]
前进 2 格后:           [3,2], [3,3], [3,4], [3,5], [3,6]? 不，长度守恒
前进 2 格后（正确）:   [3,3], [3,4], [3,5], [3,6]
```

现在要回原位。如果"反向走"按当前末端派生的方向 `[0,1]` 取反 = `[0,-1]`，每次 `coords.map(c - [0,-1])`：

```
step back 1: [3,4], [3,5], [3,6], [3,7]   ❌ 越走越远，还走右边
```

显然错。即使写对符号，得到的也是"整根往左平移"——**转角丢了**，永远回不到 L 形。

### 真正的"贪吃蛇反走"是什么

把前进看成队列：

```
前进一步:  coords.push(newHead);   const dropped = coords.shift();
                                   // 记下 dropped 到 history
```

反走一步就是**前进的完美倒放**：

```
反走一步:  const revivedTail = history.pop();  coords.unshift(revivedTail);
          coords.pop();            // 头回一格
```

这样：

- 每次反走，**尾复活回一格**（从 history 里拿回最早被 shift 掉的那个）。
- 头退一格（pop 当前头）。
- **N 次前进 + N 次反走 = coords 精确回到初始**。
- **转角信息全在 history 里，自然被还原**。

### 终止条件

`history` 为空时说明已经倒放完所有前进记录——coords 此时等于初始 coords。**停在这里切 Idle 即可**，不需要再比较"head 是否等于 origin"。

> **Linus 的品味**：**用精确的条件代替近似的比较**。"history 空"是精确事实，"head == originHead" 只是一个**间接的副作用**。前者更稳健。

---

## 实现思路

### 数据结构扩展

`ArrowRuntime` 加 `history` 字段：

```typescript
interface ArrowRuntime {
    mode: ArrowMoveMode;
    coords: Cell[];
    hasFailed: boolean;
    progress: number;
    collideAim: Cell | null;
    hitFlashUntil: number;
    /** 前进过程中被 shift 走的尾格队列（最早 shift 的在 [0]） */
    history: Cell[];
}
```

**谁维护 history**？

- **只有 `stepOneCell` push，只有 `stepBackOneCell` pop**。其他函数一概不碰。
- `fire` 时**不用**清空 history——新一轮前进会自然 push 新记录；但为安全起见，在 `resetToIdle` / `markBack` 时清空。

### stepOneCell 升级

```typescript
function stepOneCell(rt: ArrowRuntime): void {
    const dir = deriveDirection(rt.coords);
    const [hr, hc] = rt.coords[rt.coords.length - 1];
    rt.coords.push([hr + dir[0], hc + dir[1]]);
    const dropped = rt.coords.shift()!;
    rt.history.push(dropped);
}
```

**一行新增**：被 shift 的尾 push 到 history。

### stepBackOneCell

```typescript
function stepBackOneCell(rt: ArrowRuntime): boolean {
    const revived = rt.history.pop();
    if (!revived) return false;      // 已经回到原点，没得再退
    rt.coords.unshift(revived);
    rt.coords.pop();
    return true;
}
```

**返回 false 意味着 history 空**，调用方据此 markBack 切 Idle。

### tickBack

对称 tickStart / tickCollide：

```typescript
export function tickBack(
    rt: ArrowRuntime, dt: number, speed: number,
): boolean {
    if (rt.mode !== ArrowMoveMode.Back) return false;
    rt.progress += speed * dt;
    while (rt.progress >= 1) {
        rt.progress -= 1;
        const stepped = stepBackOneCell(rt);
        if (!stepped) {
            rt.progress = 0;
            return true;        // history 空 → 到家
        }
    }
    return false;
}
```

**和 tickStart/tickCollide 三件套一致**：
- `while (progress >= 1)` 消耗整格。
- 每格调一次 step。
- 终止时 progress 清零、返回 true。

### ArrowView 的 progress 偏移

Back 状态的视觉前进方向和 coords 的派生方向**相反**——因为 history.pop() 已经把 coords 从"前进过的状态"拉回一步。具体来说：

- Start/Collide：progress 表示"头继续往 dir 走的百分比"。
- Back：progress 表示"头往 `-dir`（即 coords[N-1] → coords[N-2] 反向）走的百分比"。

最干净的做法：**都以 coords 末端的 deriveDirection 为基准，然后在 Back 下乘个 -1**。

```typescript
const sign = rt.mode === ArrowMoveMode.Back ? -1 : 1;
const dir = deriveDirection(rt.coords);
const tipPx = {
    x: headPx.x + dir[1] * Config.gap * rt.progress * sign,
    y: headPx.y - dir[0] * Config.gap * rt.progress * sign,
};
```

一个 `sign` 就搞定，**不增加 if**。

---

## 代码实现

### 文件 1：`core/ArrowState.ts`

```typescript
export interface ArrowRuntime {
    mode: ArrowMoveMode;
    coords: Cell[];
    hasFailed: boolean;
    progress: number;
    collideAim: Cell | null;
    hitFlashUntil: number;
    /** 前进时被 shift 出的尾格，用于 Back 倒放。Fire 时清空 */
    history: Cell[];
}

export function createRuntime(data: ArrowData): ArrowRuntime {
    return {
        mode: ArrowMoveMode.Idle,
        coords: cloneCoords(data.coords),
        hasFailed: false,
        progress: 0,
        collideAim: null,
        hitFlashUntil: 0,
        history: [],
    };
}

export function fire(rt: ArrowRuntime, blocked: boolean, collideAim: Cell | null = null): void {
    if (rt.mode !== ArrowMoveMode.Idle) return;
    rt.mode = blocked ? ArrowMoveMode.Collide : ArrowMoveMode.Start;
    rt.progress = 0;
    rt.collideAim = blocked ? collideAim : null;
    rt.history = [];
}

export function markBack(rt: ArrowRuntime): void {
    if (rt.mode !== ArrowMoveMode.Back) return;
    rt.mode = ArrowMoveMode.Idle;
    rt.progress = 0;
    rt.history = [];
}

export function resetToIdle(rt: ArrowRuntime, data: ArrowData): void {
    rt.mode = ArrowMoveMode.Idle;
    rt.coords = cloneCoords(data.coords);
    rt.hasFailed = false;
    rt.progress = 0;
    rt.collideAim = null;
    rt.hitFlashUntil = 0;
    rt.history = [];
}

/** 贪吃蛇前进一格：push 新头、shift 老尾并记录进 history */
function stepOneCell(rt: ArrowRuntime): void {
    const dir = deriveDirection(rt.coords);
    const [hr, hc] = rt.coords[rt.coords.length - 1];
    rt.coords.push([hr + dir[0], hc + dir[1]]);
    const dropped = rt.coords.shift()!;
    rt.history.push(dropped);
}

/** 贪吃蛇反走一格：从 history 取回尾，pop 掉当前头。返回是否成功 */
function stepBackOneCell(rt: ArrowRuntime): boolean {
    const revived = rt.history.pop();
    if (!revived) return false;
    rt.coords.unshift(revived);
    rt.coords.pop();
    return true;
}

/**
 * 每帧推进 Back 状态。返回 true 表示 history 已空、回到原位。
 * 调用方应在 true 时调用 markBack(rt) 切回 Idle 并扣 HP。
 */
export function tickBack(
    rt: ArrowRuntime, dt: number, speed: number,
): boolean {
    if (rt.mode !== ArrowMoveMode.Back) return false;
    rt.progress += speed * dt;
    while (rt.progress >= 1) {
        rt.progress -= 1;
        const stepped = stepBackOneCell(rt);
        if (!stepped) {
            rt.progress = 0;
            return true;
        }
    }
    return false;
}
```

**关键点解析**：

- **`history` 和 `coords` 长度守恒**：前进一步 push 1、shift 1、history.push 1；反走一步 history.pop 1、unshift 1、pop 1。三个原子永远同步。
- **`stepOneCell` 在第 09 章已写过**。这里升级了一行"记 history"。
- **Back 不再需要 direction 参数**。方向信息已经在 history 里，和 coords 一起构成完整的"来时路"。
- **fire 和 markBack 都清 history**。fire 是起点（新一轮记录），markBack 是终点（理论上此时已空，保险清一次）。

### 文件 2：`ArrowView.ts` 的 progress sign 处理

```typescript
private drawArrow(rt: ArrowRuntime) {
    const g = this.graphics!;
    g.clear();

    const coords = rt.coords;
    if (coords.length === 0) return;

    const color = this.pickColor(rt);
    g.strokeColor = color;
    g.lineWidth = Config.arrowLineWidth;

    const points = coords.map(([r, c]) => gridToPixel(r, c, this.rows, this.cols));

    const sign = rt.mode === ArrowMoveMode.Back ? -1 : 1;
    const dir = deriveDirection(coords);
    const headPx = points[points.length - 1];
    const tipPx = {
        x: headPx.x + dir[1] * Config.gap * rt.progress * sign,
        y: headPx.y - dir[0] * Config.gap * rt.progress * sign,
    };

    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        g.lineTo(points[i].x, points[i].y);
    }
    if (rt.progress > 0) {
        g.lineTo(tipPx.x, tipPx.y);
    }
    g.stroke();

    // Back 状态下箭头头的朝向保持"当前 dir"（正向）——否则玩家看到"反向箭头"太违和
    this.drawArrowHead(tipPx.x, tipPx.y, dir, color);
}
```

**和第 09 章 drawArrow 的差别**：

- 加了 `sign`。就一行。
- **三角形箭头头永远指向 `dir`**（正向），不因为 Back 而翻转。参考项目 G3_FBase 也是这样——**失败的箭头仍然带着朝向**，玩家看它"红着倒回来"就知道失败。

### 文件 3：`GameController.ts` 加 Back 分支 + HP

```typescript
import { tickBack, markBack } from '../core/ArrowState';

/** 当前生命值（第 14 章会显示到 HUD） */
private hp = 0;
/** HP 初始值 */
private readonly HP_MAX = 3;

// onLevelLoaded 末尾加：
this.hp = this.HP_MAX;
console.log(`[Arrow] HP = ${this.hp}`);

update(dt: number) {
    if (!this.levelData) return;
    const { rows, cols } = this.levelData;
    const now = director.getTotalTime() / 1000;

    for (let i = 0; i < this.runtimes.length; i++) {
        const rt = this.runtimes[i];

        if (rt.mode === ArrowMoveMode.Start) {
            const escaped = tickStart(rt, dt, Config.arrowSpeed, rows, cols);
            if (escaped) {
                console.log(`[Arrow] Arrow ${i} escaped (End)`);
            }
            this.refreshArrow(i);

        } else if (rt.mode === ArrowMoveMode.Collide) {
            const arrived = tickCollide(rt, dt, Config.arrowSpeed);
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
            const arrived = tickBack(rt, dt, Config.arrowSpeed);
            if (arrived) {
                markBack(rt);
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

- **Back 分支不读 levelData.arrows[i]**。路径信息已经在 rt.history 里——完全自给自足。
- **markBack 只切状态，不扣 HP**。扣 HP 是 GameController 的职责（core 不懂 HP 是什么）。这就是**关注点分离**。

---

## 运行效果

还是用第 12 章那套 "箭头 0 必撞 1" 的临时关卡。

点击箭头 0：

1. 变红、沿当前方向向右飞（Collide）。前进过程中每一格都把被 shift 的尾存进 history。
2. 撞到箭头 1 头部停下（状态切 Back）。此时 `rt.history` 里记录了前进走过的所有尾格。
3. **开始慢慢反走**：history.pop() 复活老尾，当前头 pop 掉。
4. history 空 → markBack → Idle。
5. coords 此时和 `levelData.arrows[0].coords` **逐格相等**。
6. 仍然显示红色（hasFailed=true）。
7. Console：
   ```
   [Arrow] Arrow 0 fired. blocked=true
   [Arrow] Arrow 0 collided into arrow 1
   [Arrow] Arrow 0 bounced back. HP = 2
   ```

### L 形箭头的失败路径验证

构造一个更挑战的临时关卡：一根 L 形箭头 + 前方一根直箭头挡住：

```json
{
  "rows": 5, "cols": 5,
  "arrows": [
    { "direction": [0, 1], "origin": [3, 3], "coords": [[4, 2], [3, 2], [3, 3]] },
    { "direction": [0, 1], "origin": [3, 5], "coords": [[3, 5]] }
  ]
}
```

（箭头 1 是单格，仅作为障碍。当然单格意味着 deriveDirection=[0,0]，无法 fire，这里只当挡路用。）

点箭头 0：
1. L 形向右前进一格 → `coords = [[3,2], [3,3], [3,4]]`，history = `[[4,2]]`。转角消失。
2. 再前进一格 → coords = `[[3,3], [3,4], [3,5]]` ？不对，[3,5] 被箭头 1 占——**所以 findCollision 会在 fire 时直接返回 blocked**，Collide 模式触发，collideAim = [3,5]。
3. tickCollide 每格 step 直到 head 到 [3,5]：
   - step 1: coords = [[3,2],[3,3],[3,4]], history = [[4,2]]
   - step 2: coords = [[3,3],[3,4],[3,5]], history = [[4,2],[3,2]]。head = [3,5] = collideAim → 到达。
4. 切 Back → tickBack 开始倒放：
   - step back 1: history.pop → [3,2]。coords = [[3,2],[3,3],[3,4]]。history = [[4,2]]。
   - step back 2: history.pop → [4,2]。coords = [[4,2],[3,2],[3,3]]。history = []。→ 到家。
5. **最终 coords 精确等于 `[[4,2], [3,2], [3,3]]`**——**L 形完整复原**。

转角是怎么复原的？**history 里存着 [4,2]**。倒放时它被 unshift 回 coords 的尾端，L 形的那"拐"自然重新出现。

**测试完改回 `level_01.json`**。

---

## 易错点

### 易错 1：用 `coords.map(c - dir)` 实现反走

```typescript
rt.coords = rt.coords.map(([r, c]) => [r - dir[0], c - dir[1]]);  // ❌
```

这是**刚体反向平移**，直箭头看起来能用，但 L 形会变形成直线、永远回不到 L。**贪吃蛇模型下只能用 history 倒放**。

### 易错 2：history 没在 fire 时清

```typescript
export function fire(rt, blocked, aim) {
    rt.mode = blocked ? Collide : Start;
    rt.progress = 0;
    rt.collideAim = blocked ? aim : null;
    // rt.history = [];  ❌
}
```

表现：第一次 Back 正常，第二次 fire 后 Back 会把"上一次的 history"也倒放回去——**箭头"穿墙回老位置"**，非常诡异。

**规则**：**fire 是新一轮的起点，所有属于"这一轮的记录"都要清**。

### 易错 3：`stepBackOneCell` 返回值没检查

```typescript
while (rt.progress >= 1) {
    rt.progress -= 1;
    stepBackOneCell(rt);   // ❌ 忽略返回值
}
```

history 早就空了还在循环 → 空 pop → pop 越界虽然 JS 会返回 undefined 不崩，但 unshift(undefined) 会让 coords 末尾多个 undefined，下一帧渲染 `[r,c]` 解构 undefined 立刻崩。

**规则**：**stepBack 返回 false 时立刻 break，同帧内不要再循环**。

### 易错 4：Back 的 progress 偏移方向搞反

```typescript
const offR = direction[0] * rt.progress;   // ❌ Back 下也朝 +dir 偏
```

视觉：Back 时整根箭头在反向爬，但头还朝前冒一截，**像头断了在前面跳**。

**规则**：**sign = Back ? -1 : 1**。一行代码搞定，别用 if-else 把结构搞大。

### 易错 5：HP 扣在了错误的地方

- `markCollide` 里扣 HP ❌（撞到就扣，还没回弹完）
- `fire(rt, true)` 里扣 HP ❌（点一下就扣，即使后来取消）
- `update` Back 分支**到达原点时**扣 HP ✅

**规则**：HP 是"失败代价"，**失败流程完整结束时**（history 空、回到原点）才结算。

### 易错 6：reset 没清 history

`resetToIdle` 漏了 `rt.history = []` → 重试关卡时原来失败过的那根箭头第一次 fire 成功后，走到一半开始 Back 会倒放上一把的老历史 → 乱飞。

**规则**：**新增字段必同步 `resetToIdle`**。

---

## 扩展练习

1. **回弹加速**：让 Back 速度比 Start 快 2 倍。改 `tickBack` 调用时 speed 参数即可。

2. **撞击停顿再回弹**：在 Collide → Back 切换时插入 200ms 停顿。提示：给 rt 加一个 `backDelayUntil`，tickBack 开头判断 `now < backDelayUntil` 直接 return false。

3. **思考题**：为什么 `history` 存的是"尾格"而不是"整个 coords 快照"？存快照需要多少内存、存尾格需要多少？（提示：每 step 数据量差 N 倍，N 是 coords 长度。）

4. **思考题 2**：如果关卡有"箭头能穿过特定格子"的机制，只改 `stepOneCell` 判定"能否落新头"就够了，**tickBack 一个字都不用动**——因为 history 记录的是"实际走过的路径"。能解释为什么吗？

---

**工程状态**：

```
core/
├── ArrowState.ts             ← 加 history + stepBackOneCell + tickBack + resetToIdle 清字段
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
