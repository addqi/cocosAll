# Stage 5 — 脏标记 + 批量刷新

> **这一阶段结束，你会得到**：无论业务一帧内 emit 多少次事件、改多少个节点，**每个节点的 provider 最多只算一次，每个 UI 订阅最多只通知一次**。
> **关键升级**：从「改一次 → 冒泡一次 → 通知一次」变成「改 N 次 → 标记脏 → 帧末统一算一次、通知一次」。
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

## 2. Linus 式三连问

### 🟢 数据结构

**先标记，后算**。

每个节点增加一个"脏标记"位：

```typescript
class RedDotNode {
    // 原有字段 ...
    dirty: boolean = false;   // Stage 5 新增：待重算
}
```

管理器维护一个"待处理脏节点集合"：

```typescript
class RedDotManager {
    // ...
    private _dirtySet: Set<RedDotNode> = new Set();
    private _flushScheduled: boolean = false;
}
```

- **emit / refresh 只做"标记"**：把相关节点加入 `_dirtySet`，schedule 一次 flush
- **flush 时才真正算**：遍历 `_dirtySet`，每个节点算一次 provider + 冒泡
- **冒泡中"变更集"**：被 totalCount 变化影响的节点加入"待通知集"，flush 结尾统一通知

### 🟡 特殊情况

| 情况 | 糟糕设计 | 好设计 |
|------|---------|------|
| 一帧内 refresh 同一节点 10 次 | 算 10 次 provider | 脏集是 `Set`，自动去重 |
| flush 时 provider 又改数据导致 emit | 无限递归 | 用"版本号"或"正在 flush 中"标志位保护；Stage 5 简单做法：嵌套 flush 忽略 |
| 订阅者回调里再 setCount 其他节点 | 通知期间集合被改、迭代错乱 | 通知前把 `_dirtySet` 拷贝到局部变量；收到的新 dirty 进入下一帧 |
| `refreshAll` 启动时一次性标记所有节点 | 一帧内算几百个 provider | 允许；但 Stage 5 会加"同步 flush"模式专门给启动用 |

### 🔴 复杂度

**flush 函数是整个红点系统最容易写错的地方**。记住三个要点：
1. **快照迭代**：迭代前先把脏集拷贝出来，避免迭代时集合被修改
2. **冒泡延迟通知**：冒泡过程中只改 totalCount，listener 通知集中在最后
3. **可重入守护**：flush 期间别人再改节点 → 进下一帧，不要在当前 flush 里消化

---

## 3. 设计方案

### 3.1 关键思想：推迟到"下一个时机"

什么叫"下一个时机"？两种实现：

| 方案 | 触发时机 | 延迟 | 适用场景 |
|------|---------|-----|---------|
| A. **微任务**（`Promise.resolve().then`） | 当前同步代码跑完 | ~0ms | 纯逻辑合并，不跟帧 |
| B. **requestAnimationFrame / 引擎 tick** | 下一帧开始前 | ~16ms | 对齐渲染 |

**推荐方案 A**：
- 业务同步 emit 30 次事件 → 最后一次 emit 完，控制权返回引擎前 flush
- 对玩家而言视觉上没有延迟（比一帧还快）
- 不依赖 Cocos 引擎 API（便于单测）

### 3.2 新的 API 行为

**对外 API 不变**，内部语义升级：

| 方法 | Stage 4 语义 | Stage 5 语义 |
|------|-------------|-------------|
| `refresh(path)` | 立即算 + 立即冒泡 + 立即通知 | 只标记脏，待 flush |
| `emit(event)` | 立即触发所有依赖节点 refresh | 只把它们标记脏 |
| `setSelfCount(path, n)` | 立即冒泡 + 通知 | 写 selfCount，把节点标记脏 |
| `getTotalCount(path)` | 返回当前值 | 返回当前值（可能还没 flush，**读到旧值**） |

**新增两个方法**：

```typescript
flush(): void;                   // 强制立刻执行所有待处理脏节点
flushSync(): void;               // 同 flush，语义更清晰；启动时用
```

### 3.3 getTotalCount 要不要自动 flush？

不要。理由：
- **读取频繁**：UI 可能一帧内查询几百次
- **副作用**：读操作触发大量计算违反直觉
- **解决方案**：UI 订阅用 `subscribe` 回调（pull 变 push），不要主动 `getTotalCount`

如果真的需要准确值，手动 `flush()` 一下再读。

### 3.4 flush 算法伪代码

```
flush():
    if flushing return      # 可重入守护
    flushing = true

    # 第 1 阶段：处理所有脏源
    seeds = snapshot(_dirtySet)
    _dirtySet.clear()
    changedNodes = new Set()
    for node in seeds:
        oldTotal = node.totalCount
        node.selfCount = callProvider(node) if node.provider else node.selfCount
        # 冒泡（只改 totalCount，不通知）
        walker = node
        while walker:
            newTotal = walker.selfCount + sum(child.totalCount for child in walker.children)
            if walker.totalCount == newTotal: break
            walker.totalCount = newTotal
            changedNodes.add(walker)
            walker = walker.parent

    # 第 2 阶段：统一通知
    for node in changedNodes:
        for cb in node.listeners:
            cb(node.totalCount)

    flushing = false

    # 第 3 阶段：若通知回调又产生新脏节点，下一帧再处理
    if _dirtySet.size > 0:
        scheduleFlush()
```

### 3.5 schedule 策略

```typescript
private _scheduleFlush(): void {
    if (this._flushScheduled) return;
    this._flushScheduled = true;
    Promise.resolve().then(() => {
        this._flushScheduled = false;
        this.flush();
    });
}
```

多次 `emit` / `refresh` / `setSelfCount` 只会产生一次 schedule。

---

## 4. 完整代码

### 4.1 升级 `RedDotNode.ts`

```typescript
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

### 4.2 重写 `RedDotManager.ts` 核心方法

只贴改动部分，其他（register / unregister / subscribe / _parentPath）保持 Stage 4 的实现。

```typescript
private _dirtySet: Set<RedDotNode> = new Set();
private _flushScheduled: boolean = false;
private _flushing: boolean = false;

/** 标记节点脏；不直接算 */
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

/** 立刻执行所有待处理脏节点 */
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
        // 1) 重算 selfCount（如果有 provider）
        if (seed.provider) {
            const v = this._callProvider(seed);
            if (seed.selfCount !== v) seed.selfCount = v;
        }
        // 2) 冒泡（只改 totalCount，不通知）
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

    // 3) 统一通知
    changed.forEach(node => {
        node.listeners.forEach(cb => cb(node.totalCount));
    });

    this._flushing = false;

    // 4) 通知回调里产生新脏 → 下一帧处理
    if (this._dirtySet.size > 0) this._scheduleFlush();
}

/** Stage 5：refresh 只标脏，不立刻算 */
refresh(path: string): void {
    const node = this._nodes.get(path);
    if (node) this._markDirty(node);
}

/** Stage 5：setSelfCount 写值后标脏冒泡 */
setSelfCount(path: string, count: number): void {
    const node = this.register(path);
    const c = Math.max(0, Math.floor(count));
    if (node.selfCount === c) return;
    node.selfCount = c;
    this._markDirty(node);
}

/** emit 只是批量标脏 */
emit(event: string): void {
    const paths = RedDotEventBus.instance.getSubscribedPaths(event);
    for (const p of paths) {
        const node = this._nodes.get(p);
        if (node) this._markDirty(node);
    }
}

/** 启动场景：把所有带 provider 的节点标脏，同步 flush */
refreshAll(): void {
    this._nodes.forEach(node => { if (node.provider) this._markDirty(node); });
    this.flush();
}
```

### 关键解读

1. **`_markDirty` 是所有写入路径的终点**：不管 emit / refresh / setSelfCount 来的，最终都汇入 `_markDirty`。**一个入口 = 一处改 bug**。
2. **冒泡不通知 listener**：第一轮只改 totalCount，所有变更收集到 `changed` Set；第二轮统一通知。这样即使同一节点被多个子节点触发，也**只通知一次**。
3. **`_flushing` 守卫防止重入**：listener 回调里再调 `emit` 不会导致死循环。新脏节点入集合等下一帧。
4. **`refreshAll` 仍是同步**：启动场景必须保证 UI 渲染首帧就能拿到准确值，所以直接 flush 不 schedule。

---

## 5. 怎么用（示例）

### 5.1 对外看不出任何差别

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

### 5.2 启动首帧

```typescript
// LaunchRoot.start()
registerAllRedDots();          // 内部调 refreshAll() 同步 flush
// 此时 HomePage 首次渲染，RedDotView 已能拿到正确 count
```

### 5.3 测试时的"我要立刻看结果"

```typescript
mgr.setSelfCount('home.level.l1', 1);
mgr.flush();                           // 手动强制 flush
expect(mgr.getTotalCount('home')).toBe(1);
```

单元测试不走微任务，显式 flush 方便断言。

---

## 6. 验证清单

- [ ] 同步连续 `emit('paint_changed')` 100 次，provider 只被调用 1 次（打 log 计数）
- [ ] 连续 `setSelfCount('x', 1)`、`setSelfCount('x', 2)`、`setSelfCount('x', 3)` → listener 最终只收到一次 `3`
- [ ] listener 回调里再 `emit` 新事件 → 下一帧处理，不死循环
- [ ] `refreshAll()` 后**同步读** `getTotalCount` 能拿到正确值（启动流程不依赖异步）
- [ ] 一个节点被多个子节点触发冒泡，listener 只收到一次通知（不是 N 次）
- [ ] `flush()` 在没有脏节点时调用，静默返回

---

## 7. 这阶段的局限 → 下一阶段解决

现在系统已经"又对又快"。但还缺少一个能力：

> **"邮件红点"**：你不知道玩家会有几封邮件。邮件到达时要新增一个节点，邮件删除时要移除节点。

前面所有 Stage 都假设节点是**静态声明**的。动态节点需要完善 `unregister` + "子路径批量查询 + 移除" + "生命周期绑定 UI 节点"。

然后我们会**在真实项目中接入**：给你这个像素涂色游戏的关卡选择加真正的红点。

继续看 [`06-dynamic-and-integration.md`](./06-dynamic-and-integration.md)。
