# 12 · Collide 状态：撞到前方的箭头

## 本节目标

**前方有挡的箭头点击后，向前撞到挡它的那根箭头的头部停下来，变红**。然后立刻标记为 `Back` 状态，进入下一章的回弹逻辑。

预期：

- 玩家点击被挡的箭头 → 变红（Collide）→ 向前飞一段 → 撞到前方箭头头部停下 → 状态切 Back（第 13 章会让它回弹）。
- 被撞的那根箭头**短暂闪红**（表示"我挨撞了"），然后恢复原状。
- Console：
  ```
  [Arrow] Arrow 1 collided into arrow 2 at [3,3]
  ```

一句话：**失败路径的第一步 —— "撞"要有视觉反馈**。

---

## 需求分析

Collide 状态和 Start 状态**几乎一模一样**（都是贪吃蛇"头进尾出"前进），只有两点区别：

1. **颜色**：红色（已经在 pickColor 里处理）。
2. **停止条件**：不是"尾飞出边界"，而是"**头到达指定目标格子**"。

**目标格子**：第 11 章的 `findCollision` 已经能算出挡路的那根箭头。我们只需要知道"撞点"——**头继续前进时遇到的第一个被占格子**。

**再看 G3_FBase 的逻辑**。从 `MovingCollideLogic.onExecute` 里：

```typescript
const pt1 = coords[coords.length - 1];   // 当前 head
const ptx = arrowComponent.collideAim[eid]; // 预先存的撞击目标点
...
if (this.checkArrive(pt1[0], pt1[1], ptx[0], ptx[1], velocity)) {
    arrowComponent.moveMode.set(eid, G3_FBase.ArrowMoveMode.Back);
}
```

**结论**：发射时预计算"撞击点" `collideAim`，每帧走一步直到 head 到达 collideAim 就切 Back。

撞击点本质上是"沿方向走到第一个被占的格子"——正是 `findCollision` 在 while 循环里遇到的那个 `(r, c)`。我们扩展 findCollision 返回这个坐标。

---

## 实现思路

### 扩展 `findCollision` 返回值

```typescript
export interface CollisionResult {
    /** 被撞的箭头 index，-1 表示没碰撞 */
    targetIdx: number;
    /** 碰撞点（头部抵达的格子），无碰撞时为 null */
    point: Cell | null;
}
```

### 存 `collideAim`

射手的 `ArrowRuntime` 加一个字段：

```typescript
interface ArrowRuntime {
    ...
    /** Collide 状态下，头部要抵达的目标格子；其他状态下为 null */
    collideAim: Cell | null;
}
```

fire 时如果 blocked，就把 collideAim 设为 findCollision 返回的 point。

### tickCollide 函数

和 tickStart **几乎一模一样**——都用 `stepOneCell`（push 新头 + shift 尾），只是结束条件不同：

```typescript
export function tickCollide(
    rt: ArrowRuntime, dt: number, speed: number,
): boolean {  // 返回是否已到达
    if (rt.mode !== ArrowMoveMode.Collide) return false;
    if (!rt.collideAim) return false;

    rt.progress += speed * dt;
    while (rt.progress >= 1) {
        rt.progress -= 1;
        stepOneCell(rt);
        const head = rt.coords[rt.coords.length - 1];
        if (head[0] === rt.collideAim[0] && head[1] === rt.collideAim[1]) {
            rt.progress = 0;
            return true;
        }
    }
    return false;
}
```

**注意**：

- **没有 direction 参数**。和 tickStart 一致，方向由 `stepOneCell` 内部的 `deriveDirection(coords)` 派生。
- **复用 `stepOneCell`**。第 09 章写好的那个私有函数——`tickCollide` 和 `tickStart` 共用同一条"前进原语"。这就是贪吃蛇模型的漂亮之处：**一个 step 函数，两个上层调用**。
- 撞到时**把 progress 置零**，避免进入 Back 状态时残留。

### 撞击反馈：被撞箭头的"闪红"

参考 G3_FBase `MovingCollideLogic`：

```typescript
const targets = this.collidedWithRelation.getTargets(eid);
if (targets.length > 0) {
    const collidedArrowEid = targets[0];
    arrowComponent.collidedTime.set(collidedArrowEid, this.worldMeta.worldTime);
    arrowComponent.color.set(collidedArrowEid, getSchemeValueFunction('arrowCollidedColor', 0xc13c52));
}
```

它给被撞的箭头记一个 `collidedTime`，渲染时根据这个时间戳让颜色短暂变红。我们**简化成**："被撞时 ArrowRuntime 设 `hitFlashUntil = now + 0.2s`，pickColor 里判断"。

---

## 代码实现

### 文件 1：`core/CollisionCheck.ts` 改成返回对象

```typescript
import { Cell } from './LevelData';
import { ArrowRuntime, ArrowMoveMode, deriveDirection } from './ArrowState';
import { isInsideBoard } from './Coord';

export interface CollisionResult {
    targetIdx: number;
    point: Cell | null;
}

export function findCollision(
    shooterIdx: number,
    runtimes: readonly ArrowRuntime[],
    rows: number, cols: number,
): CollisionResult {
    const shooter = runtimes[shooterIdx];
    if (!shooter || shooter.coords.length === 0) {
        return { targetIdx: -1, point: null };
    }

    const direction = deriveDirection(shooter.coords);
    if (direction[0] === 0 && direction[1] === 0) {
        return { targetIdx: -1, point: null };
    }

    const head = shooter.coords[shooter.coords.length - 1];
    let r = head[0], c = head[1];

    while (true) {
        r += direction[0];
        c += direction[1];
        if (!isInsideBoard(r, c, rows, cols)) return { targetIdx: -1, point: null };

        for (let j = 0; j < runtimes.length; j++) {
            if (j === shooterIdx) continue;
            const rt = runtimes[j];
            if (rt.mode === ArrowMoveMode.End) continue;
            if (rt.coords.some(p => p[0] === r && p[1] === c)) {
                return { targetIdx: j, point: [r, c] };
            }
        }
    }
}
```

**变化**：

- **返回对象替代原先 number**，新增 `point` 字段记录撞点坐标。
- **`direction` 不再是参数**，沿用第 11 章的签名调整。调用方如果之前已经按第 11 章改过，只需把赋值左边从 `number` 改成 `CollisionResult`。

### 文件 2：`core/ArrowState.ts` 加 `collideAim` 和 `tickCollide`

```typescript
export interface ArrowRuntime {
    mode: ArrowMoveMode;
    coords: Cell[];
    hasFailed: boolean;
    progress: number;
    /** Collide 状态目标点，其他状态 null */
    collideAim: Cell | null;
    /** 被撞闪红结束时间（worldTime 秒），0 表示无 */
    hitFlashUntil: number;
}

export function createRuntime(data: ArrowData): ArrowRuntime {
    return {
        mode: ArrowMoveMode.Idle,
        coords: cloneCoords(data.coords),
        hasFailed: false,
        progress: 0,
        collideAim: null,
        hitFlashUntil: 0,
    };
}

// 扩展 fire，允许传 collideAim
export function fire(rt: ArrowRuntime, blocked: boolean, collideAim: Cell | null = null): void {
    if (rt.mode !== ArrowMoveMode.Idle) return;
    rt.mode = blocked ? ArrowMoveMode.Collide : ArrowMoveMode.Start;
    rt.progress = 0;
    rt.collideAim = blocked ? collideAim : null;
}

// 每帧推 Collide 状态（贪吃蛇模型，方向由 coords 派生）
export function tickCollide(
    rt: ArrowRuntime, dt: number, speed: number,
): boolean {
    if (rt.mode !== ArrowMoveMode.Collide) return false;
    if (!rt.collideAim) return false;

    rt.progress += speed * dt;
    while (rt.progress >= 1) {
        rt.progress -= 1;
        stepOneCell(rt);
        const head = rt.coords[rt.coords.length - 1];
        if (head[0] === rt.collideAim[0] && head[1] === rt.collideAim[1]) {
            rt.progress = 0;
            return true;
        }
    }
    return false;
}

// 标记被撞（让另一根的 hitFlashUntil 亮起）
export function markHitFlash(rt: ArrowRuntime, until: number): void {
    rt.hitFlashUntil = until;
}
```

### 文件 3：`ArrowView.ts` 的 `pickColor` 加入 hitFlash

```typescript
import { director } from 'cc';

private pickColor(rt: ArrowRuntime): Color {
    // hitFlash 优先
    if (rt.hitFlashUntil > 0) {
        const now = director.getTotalTime() / 1000;
        if (now < rt.hitFlashUntil) {
            return new Color(0xc1, 0x3c, 0x52, 0xff); // 被撞闪红
        }
    }
    if (rt.mode === ArrowMoveMode.Start || rt.mode === ArrowMoveMode.End) {
        return COLOR_MOVE;
    }
    if (rt.mode === ArrowMoveMode.Collide || rt.mode === ArrowMoveMode.Back) {
        return COLOR_STOP;
    }
    if (rt.hasFailed) return COLOR_STOP;
    return COLOR_IDLE;
}
```

**注意**：`director.getTotalTime()` 返回毫秒，除以 1000 换算秒。

### 文件 4：`GameController.ts` 的 `update` 和 `onArrowClick`

```typescript
import {
    createRuntime, fire, canFire, tickStart, tickCollide,
    markEnd, markCollide, markHitFlash,
    ArrowRuntime, ArrowMoveMode,
} from '../core/ArrowState';
import { findCollision } from '../core/CollisionCheck';
import { director } from 'cc';

private onArrowClick(idx: number) {
    const rt = this.runtimes[idx];
    if (!canFire(rt)) return;

    const data = this.levelData!;
    const result = findCollision(idx, this.runtimes, data.rows, data.cols);
    const blocked = result.targetIdx >= 0;

    fire(rt, blocked, result.point);
    console.log(
        `[Arrow] Arrow ${idx} fired. blocked=${blocked} mode=${ArrowMoveMode[rt.mode]}`
    );
    this.refreshArrow(idx);
}

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
                // 找被撞的那根箭头，让它闪红
                const target = this.findTargetAt(rt.collideAim!);
                if (target >= 0) {
                    markHitFlash(this.runtimes[target], now + 0.2);
                    this.refreshArrow(target);
                }
                markCollide(rt);  // Collide → Back
                console.log(
                    `[Arrow] Arrow ${i} collided into arrow ${target} at ` +
                    `[${rt.collideAim![0]},${rt.collideAim![1]}]`
                );
            }
            this.refreshArrow(i);
        } else if (rt.hitFlashUntil > 0 && now >= rt.hitFlashUntil) {
            // hitFlash 结束，刷新一次让颜色恢复
            rt.hitFlashUntil = 0;
            this.refreshArrow(i);
        }
    }
}

/** 查找 coords 包含指定格子的箭头 index */
private findTargetAt(cell: Cell): number {
    for (let i = 0; i < this.runtimes.length; i++) {
        const rt = this.runtimes[i];
        if (rt.mode === ArrowMoveMode.End) continue;
        if (rt.coords.some(c => c[0] === cell[0] && c[1] === cell[1])) return i;
    }
    return -1;
}
```

**变化要点**：

- **`update` 里不再读 `this.levelData.arrows[i].direction`**。`tickStart` / `tickCollide` 都自己从 coords 派生方向。
- **`tickStart` 返回 escaped**（第 10 章新签名）。边界检查和推进绑在一起，`GameController` 不再手动判边界。
- **需要补的 import**：`Cell` 从 `../core/LevelData`。`isInsideBoard` 这一章**不再用**，如果没有其他地方引用可以删掉。

---

## 运行效果

**构造一个必撞场景**：临时改 `level_01.json`：

```json
{
  "rows": 5, "cols": 5,
  "arrows": [
    { "direction": [0, 1], "origin": [3, 2], "coords": [[3,1],[3,2]] },
    { "direction": [0, 1], "origin": [3, 5], "coords": [[3,3],[3,4],[3,5]] }
  ]
}
```

预览：

- 点击箭头 0（左侧那根）。
- 它变红、向右移动一格到 `[3,3]` 停下。
- 同时箭头 1（右侧那根）的尾部 `[3,3]` 被撞，**短暂变亮红（c13c52）0.2 秒**。
- 箭头 0 的 mode 切到 Back，画面上它保持红色。
- Console：
  ```
  [Arrow] Arrow 0 fired. blocked=true mode=Collide
  [Arrow] Arrow 0 collided into arrow 1 at [3,3]
  ```

第 13 章会让撞完的箭头 0 回弹回原位。

**测试完记得改回 `level_01.json`**。

---

## 易错点

### 易错 1：`findCollision` 返回对象后调用方没跟进

```typescript
const target: number = findCollision(...);  // ❌ 现在是 CollisionResult
```

编译错。改成 `const result = findCollision(...); result.targetIdx / result.point`。

### 易错 2：`fire` 没传 `collideAim`

```typescript
fire(rt, blocked);  // ❌ collideAim 默认 null
```

Collide 状态下 `tickCollide` 检测 `!rt.collideAim` 直接 return → 箭头卡住不动。

**规则**：**发现箭头卡在 Collide 不动，先看 fire 的第三个参数有没有传对**。

### 易错 3：到达 collideAim 时 progress 没清零

```typescript
if (head === collideAim) {
    // 没 rt.progress = 0;
    return true;
}
```

progress 残留 → markCollide 切 Back → tickBack（下一章）第一帧就跳一格。**状态切换时把 progress 清零**是铁律。

### 易错 4：`director.getTotalTime()` 和 G3_FBase 的 `worldMeta.worldTime` 不一样

G3_FBase 的 `worldMeta.worldTime` 是**自定义的世界时间**（可能暂停）。Cocos 的 `director.getTotalTime()` 是**引擎启动到现在的毫秒数**，不受暂停影响。

我们没有"暂停"需求，用 `director.getTotalTime() / 1000` 就够。但**要注意除 1000**，忘除的话 `hitFlashUntil = now + 0.2` 会变成毫秒级+秒级混算，条件立刻 true，闪红永不结束或永不开始。

### 易错 5：被撞箭头是 Start 状态时还搞 hitFlash

```typescript
if (target >= 0) {
    markHitFlash(runtimes[target], ...);
}
```

如果 target 正好处于 Start 状态（罕见），它自己在飞，pickColor 会被 hitFlash 覆盖成红。

**讨论**：G3_FBase 同样行为（任何状态被撞都会闪红），视觉上合理。**保留**。但要意识到这是有意的。

---

## 扩展练习

1. **不同强度 hitFlash**：让被撞者闪红时间和**射手速度**成正比（速度快撞击强度大，红更久）。

2. **撞击音效位**：在 `markCollide` 处加一条 `console.log('[SFX] collide')` 作为以后接音频的"插槽"。注释注明是 SFX 占位。

3. **思考题**：G3_FBase 的 `MovingCollideLogic` 里用 `CollidedWithRelation.remove(eid, collidedArrowEid)` 手动管理"谁撞了谁"的关系。我们直接从 `collideAim` 反查被撞者，根本没存关系。为什么可以简化？提示：关系数据是**派生值**，可以现算。

---

**工程状态**：

```
core/
├── ArrowState.ts             ← 加 collideAim + tickCollide + markHitFlash
├── CollisionCheck.ts         ← 返回 CollisionResult 对象
├── Coord.ts
└── LevelData.ts
game/
├── ArrowView.ts               ← pickColor 加 hitFlash 判断
├── BoardView.ts
├── GameController.ts          ← update 分支处理 Collide
└── InputController.ts
```

下一章：**13 · Back 状态：回弹到起点 + HP -1** —— 失败路径闭环。
