# Stage 5 — 脏标记 + 批量刷新

> **这一阶段结束，你会得到**：无论业务一帧内 emit 多少次事件、改多少个节点，**每个节点的 provider 最多只算一次，每个 UI 订阅最多只通知一次**。
> **关键升级**：从「改一次 → 冒泡一次 → 通知一次」变成「改 N 次 → 标记脏 → 帧末统一算一次、通知一次」。
> **代码量**：约 80 行新增/修改，动 2 个文件。
> **前置**：完成 [Stage 4](./04-event-driven.md)。

---

## 1. 要解决什么问题

Stage 4 功能完整，但有性能陷阱。举一个真实场景：

> 玩家用炸弹道具一次涂色了 120 个格子。
> `PaintSaveManager` 每涂一格 emit 一次 `paint_changed`。

假设现在：
- 当前关卡的红点节点依赖 `paint_changed`
- 首页进度红点也依赖 `paint_changed`
- 它们又是 `home.level` 的子节点

Stage 4 的代价：
- 调 120 次 provider（每次都 IO localStorage）
- 冒泡 120 次（一路到 root）
- 通知 UI 120 次 `setCount`（每次都可能触发 Cocos 重排重绘）

**99% 是浪费**——外部观察的结果只取决于这 120 次之后的最终状态。

我们要让"**改 120 次 → UI 只被通知 1 次**"。

---

## 2. 本章要新增/修改哪些脚本

> 先看全景，别急着看代码。

本章**只动 2 个老文件，0 个新文件**：

| 文件 | 操作 | 职责 | 代码量 |
|------|------|------|-------|
| `RedDotNode.ts` | **升级** | 新增 `dirty: boolean` 字段，标记"需要重算" | +2 行 |
| `RedDotManager.ts` | **重构内部实现** | 新增 `_dirtySet` + `_flushScheduled` + `_flushing` 三个状态，`emit` / `refresh` / `setSelfCount` **不再立即冒泡**，改为"标脏 → schedule → 帧末 flush" | +60 行 |

> 💡 **关键认知**：这一章**对外 API 完全不变**，变的是**内部语义**。
> Stage 4 的调用方代码（Registry / StorageService / UI）**一个字都不用改**，但运行时从"每 emit 一次干一次活"变成"每帧最多干一次活"。
> 这是 Linus 说的"**在不破坏用户空间的前提下做性能优化**"的教科书案例。

### 2.1 骨架预览

**`RedDotNode.ts`**（只加一个字段）：

```typescript
export class RedDotNode {
    // ... 原有字段 ...
    dirty: boolean = false;   // Stage 5 新增
}
```

**`RedDotManager.ts`**（大改内部）：

```typescript
class RedDotManager {
    // 新增三个状态
    private _dirtySet: Set<RedDotNode>;
    private _flushScheduled: boolean;
    private _flushing: boolean;

    // 新增三个内部方法
    private _markDirty(node): void        // 所有写入都汇入这里
    private _scheduleFlush(): void        // 微任务调度
    flush(): void                          // 批量执行

    // 升级：emit / refresh / setSelfCount 改为"只标脏"
    // refreshAll 改为"批量标脏 + 同步 flush"
}
```

### 2.2 关键行为变化对照

| 方法 | Stage 4 语义 | Stage 5 语义 |
|------|-------------|-------------|
| `refresh(path)` | 立即算 + 立即冒泡 + 立即通知 | 只标记脏，待 flush |
| `emit(event)` | 立即触发所有依赖节点 refresh | 只把它们标记脏 |
| `setSelfCount(path, n)` | 立即冒泡 + 通知 | 写 selfCount，标记脏 |
| `getTotalCount(path)` | 返回当前值 | 返回当前值（**可能还没 flush，读到旧值**） |
| `refreshAll()` | 遍历所有 provider 节点，同步算 | 遍历标脏 + **同步 flush**（启动场景必须准确） |
| `flush()` | ❌ 不存在 | ✅ 新增：立刻执行所有待处理 |

---

## 3. Linus 式三连问

### 🟢 数据结构

**先标记，后算**。

每个节点增加一个"脏标记"位：

```typescript
class RedDotNode {
    dirty: boolean = false;   // Stage 5 新增：待重算
}
```

管理器维护一个"待处理脏节点集合"：

```typescript
class RedDotManager {
    private _dirtySet: Set<RedDotNode> = new Set();
    private _flushScheduled: boolean = false;
    private _flushing: boolean = false;
}
```

- **emit / refresh 只做"标记"**：把相关节点加入 `_dirtySet`，schedule 一次 flush
- **flush 时才真正算**：遍历 `_dirtySet`，每个节点算一次 provider + 冒泡
- **冒泡中"变更集"**：被 totalCount 变化影响的节点加入"待通知集"，flush 结尾统一通知

### 🟡 特殊情况

| 情况 | 糟糕设计 | 好设计 |
|------|---------|------|
| 一帧内 refresh 同一节点 10 次 | 算 10 次 provider | 脏集是 `Set`，自动去重 |
| flush 时 provider 又改数据导致 emit | 无限递归 | "正在 flush 中"标志位保护；新产生的脏进下一帧 |
| 订阅者回调里再 setCount 其他节点 | 通知期间集合被改、迭代错乱 | 通知前把 `_dirtySet` 拷贝到局部变量；新 dirty 进入下一帧 |
| `refreshAll` 启动时一次性标记所有节点 | 需要立刻拿到准确值才能渲染 UI | 内部直接调 `flush()` 同步执行 |

### 🔴 复杂度

**flush 函数是整个红点系统最容易写错的地方**。记住三个要点：
1. **快照迭代**：迭代前先把脏集拷贝出来，避免迭代时集合被修改
2. **冒泡延迟通知**：冒泡过程中只改 totalCount，listener 通知集中在最后
3. **可重入守护**：flush 期间别人再改节点 → 进下一帧，不要在当前 flush 里消化

---

## 4. 设计方案

### 4.1 关键思想：推迟到"下一个时机"

什么叫"下一个时机"？两种实现：

| 方案 | 触发时机 | 延迟 | 适用场景 |
|------|---------|-----|---------|
| A. **微任务**（`Promise.resolve().then`） | 当前同步代码跑完 | ~0ms | 纯逻辑合并，不跟帧 |
| B. **requestAnimationFrame / 引擎 tick** | 下一帧开始前 | ~16ms | 对齐渲染 |

**推荐方案 A**：
- 业务同步 emit 30 次事件 → 最后一次 emit 完，控制权返回引擎前 flush
- 对玩家而言视觉上没有延迟（比一帧还快）
- 不依赖 Cocos 引擎 API（便于单测）

### 4.2 getTotalCount 要不要自动 flush？

**不要**。理由：
- **读取频繁**：UI 可能一帧内查询几百次
- **副作用**：读操作触发大量计算违反直觉
- **解决方案**：UI 订阅用 `subscribe` 回调（pull 变 push），不要主动 `getTotalCount`

如果真的需要准确值，手动 `flush()` 一下再读（**测试代码常这么干**）。

### 4.3 flush 算法伪代码

```
flush():
    if flushing return      # 可重入守护
    if dirtySet.size == 0 return
    flushing = true

    # 第 1 阶段：快照脏集 + 清空
    seeds = snapshot(_dirtySet)
    _dirtySet.clear()
    seeds.forEach(n => n.dirty = false)
    changedNodes = new Set()

    # 第 2 阶段：处理每个脏源 —— 调 provider + 冒泡（只改 totalCount）
    for node in seeds:
        if node.provider:
            node.selfCount = callProvider(node)
        walker = node
        while walker:
            newTotal = walker.selfCount + sum(child.totalCount for child in walker.children)
            if walker.totalCount == newTotal: break
            walker.totalCount = newTotal
            changedNodes.add(walker)
            walker = walker.parent

    # 第 3 阶段：统一通知
    for node in changedNodes:
        for cb in node.listeners:
            cb(node.totalCount)

    flushing = false

    # 第 4 阶段：通知回调里产生新脏 → 下一帧再处理
    if _dirtySet.size > 0:
        scheduleFlush()
```

### 4.4 schedule 策略

```typescript
private _scheduleFlush(): void {
    if (this._flushScheduled || this._flushing) return;
    this._flushScheduled = true;
    Promise.resolve().then(() => {
        this._flushScheduled = false;
        this.flush();
    });
}
```

多次 `emit` / `refresh` / `setSelfCount` 只会产生一次 schedule。

---

## 5. 分步实现

### 5.1 升级 `RedDotNode`：加一个 `dirty` 字段

**这一步要做什么**：给节点数据结构加一个布尔字段，标记"该节点的 selfCount 需要重算"。

> 修改 `assets/src/core/reddot/RedDotNode.ts`

在类字段区域加一行（位置放在 `provider` 下方、`listeners` 上方）：

```typescript
/** Stage 5：标记该节点的 selfCount 需要重算 */
dirty: boolean = false;
```

**关键解读**：

- **字段放在节点上、不放在 Manager 的 Set 里？其实两个都用**——节点上的 `dirty` 是"反向索引"，用于 `_markDirty` 里快速判断"这个节点是不是已经在脏集里"；Manager 的 `_dirtySet` 是"正向列表"，用于迭代。**两者配合避免 O(N) 的集合查找**。
- **默认 `false`**——新节点刚建出来时 totalCount/selfCount 都是 0，没脏。

---

### 5.2 升级 `RedDotManager`：新增三个状态字段

**这一步要做什么**：在 `RedDotManager` 类里加三个内部状态。

在 `_nodes` 字段下方加：

```typescript
/** 当前待 flush 的脏节点集合 */
private _dirtySet: Set<RedDotNode> = new Set();

/** 是否已经 schedule 了一次 flush（避免重复 schedule） */
private _flushScheduled: boolean = false;

/** 是否正在 flush 中（可重入守卫） */
private _flushing: boolean = false;
```

**关键解读**：

- **三个状态各司其职**，不要合并：
  - `_dirtySet` 是**数据**（谁要刷）
  - `_flushScheduled` 是**调度状态**（已经排好下次 flush 了吗？）
  - `_flushing` 是**执行状态**（正在干活吗？）
- 合并会引入"状态枚举"式的特殊情况分支，比三个独立布尔更难懂。

---

### 5.3 新增 `_markDirty`：所有写入的汇合点

**这一步要做什么**：写一个**统一入口**，所有"要刷这个节点"的请求最终都汇入这里。入口只有一个，出 bug 的地方也只有一个。

```typescript
/** 标记节点脏；不直接算。 */
private _markDirty(node: RedDotNode): void {
    if (node.dirty) return;   // 已经在脏集里，避免重复加入
    node.dirty = true;
    this._dirtySet.add(node);
    this._scheduleFlush();
}
```

**关键解读**：

- **`if (node.dirty) return` 是快路径**——靠节点自己的 `dirty` 字段做 O(1) 去重，不走 `Set.has`。
- **一个写入一个调度**——外部同步调用 1000 次 `_markDirty`，只有第一次会真正触发 `_scheduleFlush`，其他都在 `_flushScheduled` 那层被挡住。

---

### 5.4 新增 `_scheduleFlush`：微任务调度

**这一步要做什么**：用 `Promise.resolve().then()` 把 flush 推到**本轮同步代码跑完之后立刻执行**。

```typescript
private _scheduleFlush(): void {
    if (this._flushScheduled || this._flushing) return;
    this._flushScheduled = true;
    Promise.resolve().then(() => {
        this._flushScheduled = false;
        this.flush();
    });
}
```

**关键解读**：

- **`Promise.resolve().then()` 是微任务**——JavaScript 事件循环里比 setTimeout(0) 更早执行、比渲染更早。业务同步代码跑完后**立刻** flush，玩家根本感觉不到延迟。
- **双重守卫 `_flushScheduled || _flushing`**：
  - `_flushScheduled` 防止 scheduled 期间再次 schedule
  - `_flushing` 防止 flush **执行过程中**的 `_markDirty`（来自 provider 副作用或 listener 回调）重新 schedule——这些新脏会在当前 flush 结尾被处理（见 5.5 的第 4 阶段）。

---

### 5.5 新增 `flush`：真正干活的地方

**这一步要做什么**：按 4.3 伪代码实现 flush。这是整个 Stage 5 的**心脏**。

```typescript
/** 立刻执行所有待处理脏节点。 */
flush(): void {
    if (this._flushing) return;
    if (this._dirtySet.size === 0) return;
    this._flushing = true;

    // 1) 快照脏集，清空（新产生的 dirty 进入下一帧）
    const seeds: RedDotNode[] = [];
    this._dirtySet.forEach(n => seeds.push(n));
    this._dirtySet.clear();
    seeds.forEach(n => { n.dirty = false; });

    const changed: Set<RedDotNode> = new Set();

    // 2) 处理每个脏源：调 provider + 冒泡（只改 totalCount，不通知）
    for (const seed of seeds) {
        if (seed.provider) {
            const v = this._callProvider(seed);
            if (seed.selfCount !== v) seed.selfCount = v;
        }
        let walker: RedDotNode | null = seed;
        while (walker) {
            const oldTotal = walker.totalCount;
            let sum = walker.selfCount;
            walker.children.forEach(ch => { sum += ch.totalCount; });
            if (sum === oldTotal) break;
            walker.totalCount = sum;
            changed.add(walker);
            walker = walker.parent;
        }
    }

    // 3) 统一通知（一个节点不管被多少子节点触发，只通知一次）
    changed.forEach(node => {
        node.listeners.forEach(cb => cb(node.totalCount));
    });

    this._flushing = false;

    // 4) 通知回调里产生新脏 → 下一帧处理
    if (this._dirtySet.size > 0) this._scheduleFlush();
}
```

**关键解读**：

1. **先快照再清空**（第 1 阶段）——如果 flush 过程中有人 `_markDirty`，这些新脏进入 `_dirtySet`，但我们已经拿到快照 `seeds` 在跑；新脏等下一帧。这样**迭代永远不会被干扰**。
2. **冒泡不通知**（第 2 阶段）——只改 `totalCount`，把变了的节点塞 `changed`。如果 A 有两个孩子都变了，A 只会进 `changed` 一次（`Set` 去重），第 3 阶段只通知一次。
3. **统一通知在最后**（第 3 阶段）——这就是"改 120 次 → UI 通知 1 次"的魔法所在。
4. **可重入处理**（第 4 阶段）——`_flushing = false` 之后，如果通知回调触发了新脏，`_markDirty` 会正常走 `_scheduleFlush`。我们这里再主动 schedule 一次是"双保险"，防止被 5.4 的 `_flushing` 守卫意外挡住（如果回调是同步的，上面 `_flushing = true` 期间它已经加入 `_dirtySet`，但没被 schedule）。

---

### 5.6 改造 `refresh`：只标脏

**这一步要做什么**：`refresh` 从"立即算"退化为"只标脏"。

替换 Stage 3/4 的 `refresh`：

```typescript
refresh(path: string): void {
    const node = this._nodes.get(path);
    if (node) this._markDirty(node);
}
```

**关键解读**：

- **比 Stage 3 还短**——真正的活交给 flush。
- **没处理"节点没 provider"的情况**？flush 里会处理：没 provider 的节点 selfCount 不变，冒泡时剪枝剪掉——**框架代码里不加特殊判断，让数据决定行为**。

---

### 5.7 改造 `setSelfCount`：写值后标脏

**这一步要做什么**：`setSelfCount` 不再立即冒泡，写完值标脏即可。

替换 Stage 2/3 的 `setSelfCount`：

```typescript
setSelfCount(path: string, count: number): void {
    const node = this.register(path);
    const c = Math.max(0, Math.floor(count));
    if (node.selfCount === c) return;
    node.selfCount = c;
    this._markDirty(node);
}
```

**关键解读**：

- **写值 + 标脏**——写值本身是同步完成的，只有冒泡和通知被推迟。
- **`setSelfCount` 的脏节点没有 provider 怎么办**？flush 第 2 阶段的 `if (seed.provider)` 分支就是为此——没 provider 跳过重算，直接冒泡。`selfCount` 是外面刚设好的，没问题。

---

### 5.8 改造 `emit`：批量标脏

**这一步要做什么**：`emit` 不再逐个 `refresh`，改成逐个 `_markDirty`。

替换 Stage 4 的 `emit`：

```typescript
emit(event: string): void {
    const paths = RedDotEventBus.instance.getSubscribedPaths(event);
    for (const p of paths) {
        const node = this._nodes.get(p);
        if (node) this._markDirty(node);
    }
}
```

**关键解读**：

- **比原来省一次函数调用**——原来 `emit → refresh → _markDirty`，现在直接 `emit → _markDirty`，少一层栈。
- **120 次同步 emit 的代价**：每次进来遍历 `paths`（通常很短）+ 每个节点 `_markDirty` 里 `if (node.dirty) return`——**几乎零开销**。

---

### 5.9 改造 `refreshAll`：批量标脏 + 同步 flush

**这一步要做什么**：启动场景必须立刻拿到准确值才能渲染首帧，所以 `refreshAll` 里直接调 `flush()`，不走微任务。

替换 Stage 3 的 `refreshAll`：

```typescript
refreshAll(): void {
    this._nodes.forEach(node => {
        if (node.provider) this._markDirty(node);
    });
    this.flush();
}
```

**关键解读**：

- **`this.flush()` 同步执行**——回到调用方时所有节点已经算完、通知过一轮 listener。
- **为什么启动必须同步？** UI 首帧渲染时要求 `RedDotView.setCount` 已经被调过了，否则玩家会看到"先空白后弹出红点"的闪烁。

---

## 6. 完整代码（汇总）

### 6.1 `assets/src/core/reddot/RedDotNode.ts`（全量）

```typescript
export type RedDotListener = (totalCount: number) => void;
export type RedDotProvider = () => number;

export class RedDotNode {
    readonly path: string;
    parent: RedDotNode | null = null;
    readonly children: Map<string, RedDotNode> = new Map();

    selfCount: number = 0;
    totalCount: number = 0;

    provider: RedDotProvider | null = null;

    /** Stage 5：标记该节点的 selfCount 需要重算 */
    dirty: boolean = false;

    readonly listeners: Set<RedDotListener> = new Set();

    constructor(path: string) { this.path = path; }

    get segmentKey(): string {
        const i = this.path.lastIndexOf('.');
        return i < 0 ? this.path : this.path.substring(i + 1);
    }
}
```

### 6.2 `assets/src/core/reddot/RedDotManager.ts`（全量）

```typescript
import { RedDotNode, RedDotListener, RedDotProvider } from './RedDotNode';
import { RedDotEventBus } from './RedDotEventBus';

export interface RedDotNodeConfig {
    provider?: RedDotProvider;
    deps?: string[];
}

export class RedDotManager {
    private static _instance: RedDotManager | null = null;
    static get instance(): RedDotManager {
        if (!this._instance) this._instance = new RedDotManager();
        return this._instance;
    }

    private _nodes: Map<string, RedDotNode> = new Map();

    private _dirtySet: Set<RedDotNode> = new Set();
    private _flushScheduled: boolean = false;
    private _flushing: boolean = false;

    register(path: string, config?: RedDotNodeConfig): RedDotNode {
        let node = this._nodes.get(path);
        if (!node) {
            node = new RedDotNode(path);
            this._nodes.set(path, node);

            const parentPath = this._parentPath(path);
            if (parentPath !== null) {
                const parent = this.register(parentPath);
                node.parent = parent;
                parent.children.set(node.segmentKey, node);
            }
        }
        if (config?.provider !== undefined) node.provider = config.provider;
        if (config?.deps) {
            for (const ev of config.deps) {
                RedDotEventBus.instance.subscribe(ev, path);
            }
        }
        return node;
    }

    unregister(path: string): void {
        const node = this._nodes.get(path);
        if (!node) return;
        RedDotEventBus.instance.unsubscribeAll(path);
        node.parent?.children.delete(node.segmentKey);
        this._nodes.delete(path);
        this._dirtySet.delete(node);
        node.dirty = false;
        if (node.parent) this._markDirty(node.parent);
    }

    setSelfCount(path: string, count: number): void {
        const node = this.register(path);
        const c = Math.max(0, Math.floor(count));
        if (node.selfCount === c) return;
        node.selfCount = c;
        this._markDirty(node);
    }

    refresh(path: string): void {
        const node = this._nodes.get(path);
        if (node) this._markDirty(node);
    }

    refreshAll(): void {
        this._nodes.forEach(node => {
            if (node.provider) this._markDirty(node);
        });
        this.flush();
    }

    emit(event: string): void {
        const paths = RedDotEventBus.instance.getSubscribedPaths(event);
        for (const p of paths) {
            const node = this._nodes.get(p);
            if (node) this._markDirty(node);
        }
    }

    getTotalCount(path: string): number {
        return this._nodes.get(path)?.totalCount ?? 0;
    }

    subscribe(path: string, cb: RedDotListener): () => void {
        const node = this.register(path);
        node.listeners.add(cb);
        cb(node.totalCount);
        return () => node.listeners.delete(cb);
    }

    flush(): void {
        if (this._flushing) return;
        if (this._dirtySet.size === 0) return;
        this._flushing = true;

        const seeds: RedDotNode[] = [];
        this._dirtySet.forEach(n => seeds.push(n));
        this._dirtySet.clear();
        seeds.forEach(n => { n.dirty = false; });

        const changed: Set<RedDotNode> = new Set();

        for (const seed of seeds) {
            if (seed.provider) {
                const v = this._callProvider(seed);
                if (seed.selfCount !== v) seed.selfCount = v;
            }
            let walker: RedDotNode | null = seed;
            while (walker) {
                const oldTotal = walker.totalCount;
                let sum = walker.selfCount;
                walker.children.forEach(ch => { sum += ch.totalCount; });
                if (sum === oldTotal) break;
                walker.totalCount = sum;
                changed.add(walker);
                walker = walker.parent;
            }
        }

        changed.forEach(node => {
            node.listeners.forEach(cb => cb(node.totalCount));
        });

        this._flushing = false;

        if (this._dirtySet.size > 0) this._scheduleFlush();
    }

    private _markDirty(node: RedDotNode): void {
        if (node.dirty) return;
        node.dirty = true;
        this._dirtySet.add(node);
        this._scheduleFlush();
    }

    private _scheduleFlush(): void {
        if (this._flushScheduled || this._flushing) return;
        this._flushScheduled = true;
        Promise.resolve().then(() => {
            this._flushScheduled = false;
            this.flush();
        });
    }

    private _callProvider(node: RedDotNode): number {
        if (!node.provider) return 0;
        try {
            const v = node.provider();
            return Math.max(0, Math.floor(v));
        } catch (e) {
            console.error(`[RedDot] provider error at '${node.path}':`, e);
            return 0;
        }
    }

    private _parentPath(path: string): string | null {
        const i = path.lastIndexOf('.');
        return i < 0 ? null : path.substring(0, i);
    }

    _resetForTest(): void {
        this._nodes.clear();
        this._dirtySet.clear();
        this._flushScheduled = false;
        this._flushing = false;
    }
}
```

**关键解读**：

1. **`_markDirty` 是所有写入路径的终点**：不管 emit / refresh / setSelfCount 来的，最终都汇入 `_markDirty`。**一个入口 = 一处改 bug**。
2. **冒泡不通知 listener**：第一轮只改 totalCount，所有变更收集到 `changed` Set；第二轮统一通知。这样即使同一节点被多个子节点触发，也**只通知一次**。
3. **`_flushing` 守卫防止重入**：listener 回调里再调 `emit` 不会导致死循环，新脏节点入集合等下一帧。
4. **`refreshAll` 仍是同步**：启动场景必须保证 UI 渲染首帧就能拿到准确值，所以直接 `flush()` 不 schedule。
5. **`_resetForTest` 也要清脏集和调度状态**——不然上次测试的残留会污染下次。

---

## 7. 怎么用（示例）

### 7.1 对外看不出任何差别

```typescript
mgr.emit('paint_changed');
mgr.emit('paint_changed');
mgr.emit('paint_changed');
// ... 同步调用 120 次

// 此时 UI 一次都没被通知
// 控制权交还给事件循环的一刹那：
//   → 微任务触发 flush
//   → 每个依赖节点只调 provider 一次
//   → UI setCount 只被调一次
```

### 7.2 启动首帧

```typescript
// LaunchRoot.start()
registerAllRedDots();          // 内部调 refreshAll() 同步 flush
// 此时 HomePage 首次渲染，RedDotView 已能拿到正确 count
```

### 7.3 测试时的"我要立刻看结果"

```typescript
mgr.setSelfCount('home.level.apple', 1);
mgr.flush();                            // 手动强制 flush
console.log(mgr.getTotalCount('home'));  // 1
```

单元测试不走微任务，显式 `flush()` 方便断言。

---

## 8. 验证清单

- [ ] 同步连续 `emit(RedDotEvents.LevelDoneChanged)` 100 次，provider 只被调用 1 次（在 provider 里打 log 计数）
- [ ] 连续 `setSelfCount('x', 1)`、`setSelfCount('x', 2)`、`setSelfCount('x', 3)` → listener 最终只收到一次 `3`
- [ ] listener 回调里再 `emit` 新事件 → 下一帧处理，不死循环
- [ ] `refreshAll()` 后**同步读** `getTotalCount` 能拿到正确值（启动流程不依赖异步）
- [ ] 一个节点被多个子节点触发冒泡，listener 只收到一次通知（不是 N 次）
- [ ] `flush()` 在没有脏节点时调用，静默返回
- [ ] `_resetForTest` 后，所有状态（节点、脏集、调度位）都清零

---

## 9. 这阶段的局限 → 下一阶段解决

现在系统已经"又对又快"。但还缺少一个能力：

> **"邮件红点"**：你不知道玩家会有几封邮件。邮件到达时要新增一个节点，邮件删除时要移除节点。

前面所有 Stage 都假设节点是**静态声明**的。动态节点需要完善 `unregister` + "子路径批量查询 + 移除" + "生命周期绑定 UI 节点"。

然后我们会**在真实项目中接入**：给这个像素涂色游戏的关卡选择加真正的红点。

继续看 [`06-dynamic-and-integration.md`](./06-dynamic-and-integration.md)。
