# Stage 2 — 树形结构 + 自动冒泡

> **这一阶段结束，你会得到**：一棵"红点树"。在叶子节点改一个数，父节点、祖父节点的总数**自动更新**，挂在它们上面的 UI **自动刷新**。
> **代码量**：约 150 行，两个文件。
> **前置**：完成 [Stage 1](./01-minimal-dot.md)。

---

## 1. 要解决什么问题

Stage 1 的红点是**孤岛**。真实游戏里红点是这样的：

```
                    [根节点]
                   /        \
              [关卡按钮]    [邮件按钮]
             /     |      \        |
         [关1] [关2] [关3]   [邮件1] [邮件2]
```

玩家点完 **关1**，**关1** 的红点灭了，**关卡按钮** 也该自动少一个，**根节点** 也该少一个。

**如果你手动写这个逻辑，每加一个新关卡就要去改父按钮的数数逻辑。系统会烂。**

这一阶段我们让系统"自己会数"。

---

## 2. 本章要新增哪些脚本

> 先看全景，别急着看代码。

我们要**新增 2 个文件**（都放在 `assets/src/core/reddot/` 下）：

| 文件 | 职责 | 代码量 |
|------|------|-------|
| `RedDotNode.ts` | **树节点**。纯数据容器，存路径、父子指针、两个计数、订阅者集合。不包含任何算法。 | ~25 行 |
| `RedDotManager.ts` | **树管理器**（单例）。所有节点的注册、查询、设值、订阅、冒泡算法都在这里。 | ~70 行 |

两个文件的**分工原则**：

- **`RedDotNode` 只负责"存"**，像一个被动的数据包。
- **`RedDotManager` 负责"算"**，包括创建节点、维护父子关系、冒泡更新、派发通知。

> 💡 **为什么要拆两个文件？**
> 这是 Linus 说的"好数据结构"——节点本身只是一堆字段，算法集中在一个地方。这样：
> - 节点类没有方法，你一眼能看完它有什么
> - 算法集中，以后改冒泡策略只改一处
> - 新手不会被"节点自己也会算、管理器也会算"的复杂性绕晕

两个文件的骨架（本章后面会逐步填肉）：

```typescript
// RedDotNode.ts —— 纯数据
export class RedDotNode {
    readonly path: string;
    parent: RedDotNode | null;
    children: Map<string, RedDotNode>;
    selfCount: number;
    totalCount: number;
    listeners: Set<(n: number) => void>;
    // ... 无方法（除了一个辅助 getter）
}
```

```typescript
// RedDotManager.ts —— 单例 + 算法
export class RedDotManager {
    static readonly instance: RedDotManager;

    register(path): RedDotNode        // 注册/查找节点，自动建父链
    setSelfCount(path, count): void   // 叶子设值，触发冒泡
    getTotalCount(path): number       // 查询当前总数
    subscribe(path, cb): () => void   // UI 订阅变化
    private _bubble(node): void       // 冒泡算法（内部）
}
```

看完这张图，你应该已经能猜到大致的调用流程：**外部只碰 Manager，Node 是内部细节。** 带着这个印象往下读。

---

## 3. Linus 式三连问

### 🟢 数据结构

每个节点只需要这些字段：

```typescript
class RedDotNode {
    path: string;                         // 路径式唯一 id，如 'home.level.l1'
    parent: RedDotNode | null;            // 向上的指针
    children: Map<string, RedDotNode>;    // 向下的指针
    selfCount: number;                    // 自己产生的红点数（叶子节点才 > 0）
    totalCount: number;                   // selfCount + 所有后代的 totalCount
    listeners: Set<(count: number) => void>;  // 挂了几个 UI 订阅者
}
```

**关键点：为什么分 `selfCount` 和 `totalCount`？**

如果只有 `totalCount`，冒泡时父节点要从零重新累加所有子节点 —— 但**父节点自己可能也有 `selfCount`**（比如某个标签页既自己有提示、下面还有子项）。
分成两个字段后，公式永远是：

```
totalCount = selfCount + Σ(children.totalCount)
```

简单、可重入、不会算错。

### 🟡 特殊情况识别

| 情况 | 糟糕设计 | 好设计 |
|------|---------|-------|
| 叶子节点改 `selfCount` | 特殊分支：叶子一套流程，非叶子另一套 | 统一公式，叶子的 `children` 是空 Map，`Σ` 就是 0 |
| 订阅一个还没注册的路径 | 抛异常 | 延迟创建"占位节点"，之后注册时合并 |
| 重复 register 同一路径 | 报错 | 幂等：返回已有节点即可 |

消除特殊情况是 Linus 哲学里最重要的一条。

### 🔴 复杂度

冒泡算法 = 一个循环向上走 `while (parent)`。**不能递归**（栈爆），**不能深度优先重算整棵树**（性能）。
核心只有十几行。

---

## 4. 设计方案

### 4.1 路径 id 设计

用**点分隔字符串**：`'home.level.l1'`。

为什么不用对象引用（`root.home.level.l1`）？
- 字符串可序列化、可写配置表、可 log
- 对象引用要求调用方知道层级结构，耦合死
- 字符串查错快（搜全代码就能看到用了多少次）

### 4.2 外部 API 形态

```typescript
const manager = RedDotManager.instance;

// 注册节点（路径自动推断父节点）
manager.register('home.level.l1');

// 叶子节点设值（唯一的数据入口）
manager.setSelfCount('home.level.l1', 1);

// 查询
manager.getTotalCount('home.level');  // 1

// 订阅（UI 挂钩）
manager.subscribe('home.level', (total) => {
    redDotView.setCount(total);
});
```

### 4.3 冒泡流程

`setSelfCount('home.level.l1', 2)` 触发的动作：

```
1. node('home.level.l1').selfCount = 2
2. 重算 node('home.level.l1').totalCount
3. 通知 'home.level.l1' 的 listeners
4. 回到父节点 'home.level'：重算其 totalCount
5. 若变了 → 通知 'home.level' 的 listeners
6. 回到父节点 'home'：重算
7. ... 直到没有父节点或 totalCount 没变（剪枝）
```

**剪枝：若某层 totalCount 没变，立即停。** 这是性能的关键。

### 4.4 父节点何时"存在"

`register('home.level.l1')` 时，`'home'` 和 `'home.level'` 如果没注册过，**系统会自动建**（占位节点，selfCount=0）。
这避免了"必须按顺序注册"的特殊情况。

---

## 5. 分步实现

从最简单的 `RedDotNode` 开始，它只是个数据袋。然后逐个方法实现 `RedDotManager`。

### 5.1 实现 `RedDotNode`（纯数据节点）

**这一步要做什么**：写一个只有字段、没有方法的节点类。唯一的例外是一个**辅助 getter `segmentKey`**，用于拿路径最后一段当作父节点 `children` map 的 key。

> 文件路径：`assets/src/core/reddot/RedDotNode.ts`

```typescript
export type RedDotListener = (totalCount: number) => void;

/**
 * 红点树节点。纯数据，不包含任何算法逻辑（算法在 RedDotManager 里）。
 * 设计原则：只负责"存"，不负责"算"。
 */
export class RedDotNode {
    readonly path: string;
    parent: RedDotNode | null = null;
    readonly children: Map<string, RedDotNode> = new Map();

    selfCount: number = 0;
    totalCount: number = 0;

    readonly listeners: Set<RedDotListener> = new Set();

    constructor(path: string) {
        this.path = path;
    }

    /** path 的最后一段，用作 parent.children 的 key */
    get segmentKey(): string {
        const i = this.path.lastIndexOf('.');
        return i < 0 ? this.path : this.path.substring(i + 1);
    }
}
```

**关键解读**：

- `path` 是 `readonly` —— 节点一旦创建就永远属于这个路径，不允许改。
- `children` 用 `Map` 不用数组 —— 按 key 查找 O(1)，而且避免重复。
- `RedDotListener` 单独导出 —— Manager 会用到，其他地方也可能复用。
- **没有任何方法**。有人想在这里加 `addChild` 或 `bubble`？**不要**。所有修改都应该走 Manager，否则就有两条路径改同一份数据，早晚出 bug。

这个文件写完就放着。**剩下所有代码都写在 `RedDotManager.ts` 里**。

---

### 5.2 搭 `RedDotManager` 的骨架 + 单例

**这一步要做什么**：新建 `RedDotManager.ts`，先把类壳子、单例入口、节点容器搭好。其他方法先留空。

> 文件路径：`assets/src/core/reddot/RedDotManager.ts`

```typescript
import { RedDotNode, RedDotListener } from './RedDotNode';

export class RedDotManager {
    private static _instance: RedDotManager | null = null;
    static get instance(): RedDotManager {
        if (!this._instance) this._instance = new RedDotManager();
        return this._instance;
    }

    /** 所有节点的扁平映射：path → node。便于 O(1) 查找。 */
    private _nodes: Map<string, RedDotNode> = new Map();

    // 后续方法逐步添加 ...
}
```

**关键解读**：

- **单例**：全游戏只有一棵红点树。不要给每个页面建一棵——那样冒泡无法跨页面传递。
- **`_nodes` 是扁平 Map**，不是递归树结构。树的父子关系存在节点自己的 `parent`/`children` 上。查节点时用 Map 做 O(1) 查找，遍历树时用指针。这是"**索引 vs 结构**"两种视角，各司其职。

---

### 5.3 实现 `register`：注册节点，自动建父链

**这一步要做什么**：实现 `register(path)`。给一个路径，如果没注册过就建节点，并**递归确保父节点也存在**（自动建占位节点）；如果已注册就直接返回。必须幂等。

```typescript
/** 注册节点。若路径中间段不存在，会自动创建占位节点。幂等。 */
register(path: string): RedDotNode {
    let node = this._nodes.get(path);
    if (node) return node;

    node = new RedDotNode(path);
    this._nodes.set(path, node);

    const parentPath = this._parentPath(path);
    if (parentPath !== null) {
        const parent = this.register(parentPath);  // ← 递归：父节点不在就自动建
        node.parent = parent;
        parent.children.set(node.segmentKey, node);
    }
    return node;
}

private _parentPath(path: string): string | null {
    const i = path.lastIndexOf('.');
    return i < 0 ? null : path.substring(0, i);
}
```

**关键解读**：

- **先查再建**：第一行 `this._nodes.get(path)` 保证幂等。任何时候调用 `register('home')` 都拿到同一个节点。
- **递归建父**：调 `register('home.level.l1')` 时，父 `'home.level'` 没注册？没关系，递归一行搞定，自动补齐父链。
- **这里的递归是安全的**：递归深度 = 路径段数（通常 3~5 层），远远到不了栈溢出。**真正危险的递归是冒泡**（树可能很宽），所以 5.5 那里会用循环。
- `_parentPath('home.level.l1')` → `'home.level'`；`_parentPath('home')` → `null`（根节点没有父）。

---

### 5.4 实现 `getTotalCount`：查询

**这一步要做什么**：给一个路径，返回当前的 `totalCount`。**没注册过也不报错**，返回 0。

```typescript
getTotalCount(path: string): number {
    return this._nodes.get(path)?.totalCount ?? 0;
}
```

**关键解读**：

一行。**没注册就返回 0，不是抛异常**。UI 代码经常会问"这个按钮有几个红点？"，这时候它可能比业务代码更早问到——返回 0 最合理。

这就是"**消除特殊情况**"：调用者不需要先 `if (exists) ... else ...`，直接用返回值即可。

---

### 5.5 实现 `setSelfCount` + `_bubble`：设值 & 冒泡

**这一步要做什么**：

- `setSelfCount(path, count)` 是**唯一的数据入口**：把某个节点的 `selfCount` 改掉，然后触发冒泡。
- `_bubble(node)` 是内部算法：从当前节点开始向上走，重算每层的 `totalCount`，每层都通知 listeners；如果某层没变就停（剪枝）。

```typescript
/** 设置某个节点的 selfCount；自动冒泡到根。 */
setSelfCount(path: string, count: number): void {
    const node = this.register(path);          // 不在就自动建
    const c = Math.max(0, Math.floor(count));  // 夹到非负整数
    if (node.selfCount === c) return;          // 值没变就彻底不动
    node.selfCount = c;
    this._bubble(node);
}

/** 从 startNode 开始向上冒泡，重算每层 totalCount 并派发。 */
private _bubble(startNode: RedDotNode): void {
    let node: RedDotNode | null = startNode;
    while (node) {
        const oldTotal = node.totalCount;

        let sum = node.selfCount;
        node.children.forEach(ch => { sum += ch.totalCount; });

        if (sum === oldTotal) return;          // 剪枝：没变就停
        node.totalCount = sum;
        node.listeners.forEach(cb => cb(sum)); // 通知这一层
        node = node.parent;                     // 继续向上
    }
}
```

**关键解读**：

- **`while` 不是递归**：树再深也只是一个循环变量在走，绝对不会栈溢出。
- **`sum === oldTotal` 剪枝**：假设 100 层的树，只有叶子改了 selfCount 但 totalCount 没变（比如从 1 设回 1），根本不会冒泡。这是性能的关键。
- **先算完 sum 再通知**：保证 listener 回调里拿到的 `totalCount` 就是 node.totalCount 的最新值，一致性干净。
- **通知用 `forEach`**：如果一个 listener 在回调里再次调 `setSelfCount`，只会在下一次冒泡里生效，不会污染本次。

---

### 5.6 实现 `subscribe`：UI 订阅

**这一步要做什么**：让 UI 能挂钩到某个路径的变化。订阅时**立即派发一次当前值**（UI 首次拿数据），返回一个反订阅函数。

```typescript
/** 订阅某个路径的 totalCount 变化。返回反订阅函数。 */
subscribe(path: string, cb: RedDotListener): () => void {
    const node = this.register(path);
    node.listeners.add(cb);
    cb(node.totalCount);                        // 立即派发一次初始值
    return () => node.listeners.delete(cb);
}
```

**关键解读**：

- **自动注册目标节点**：UI 可能比业务代码先订阅，这时节点还不存在，`register` 会自动建好。
- **立即派发初始值** `cb(node.totalCount)`：避免 UI 首帧空白。订阅那一刻就让 UI 拿到"当前是几"。
- **返回反订阅函数**：UI 组件销毁时调一次就能干净移除。调用方无需关心节点内部怎么存的。

---

### 5.7 再加一个测试辅助（可选）

Stage 2 的代码很容易写错，加一个清空方法方便单测或 console 重试：

```typescript
/** 仅用于测试：清空所有节点 */
_resetForTest(): void {
    this._nodes.clear();
}
```

**加下划线前缀**是我的偏好——提示调用方"这是内部/测试方法，生产代码别用"。

---

## 6. 完整代码（汇总）

把上面各步拼起来就是最终版。方便你整体复制。

### 6.1 `assets/src/core/reddot/RedDotNode.ts`

```typescript
export type RedDotListener = (totalCount: number) => void;

/**
 * 红点树节点。纯数据，不包含任何算法逻辑（算法在 RedDotManager 里）。
 * 设计原则：只负责"存"，不负责"算"。
 */
export class RedDotNode {
    readonly path: string;
    parent: RedDotNode | null = null;
    readonly children: Map<string, RedDotNode> = new Map();

    selfCount: number = 0;
    totalCount: number = 0;

    readonly listeners: Set<RedDotListener> = new Set();

    constructor(path: string) {
        this.path = path;
    }

    /** path 的最后一段，用作 parent.children 的 key */
    get segmentKey(): string {
        const i = this.path.lastIndexOf('.');
        return i < 0 ? this.path : this.path.substring(i + 1);
    }
}
```

### 6.2 `assets/src/core/reddot/RedDotManager.ts`

```typescript
import { RedDotNode, RedDotListener } from './RedDotNode';

export class RedDotManager {
    private static _instance: RedDotManager | null = null;
    static get instance(): RedDotManager {
        if (!this._instance) this._instance = new RedDotManager();
        return this._instance;
    }

    private _nodes: Map<string, RedDotNode> = new Map();

    /** 注册节点。若路径中间段不存在，会自动创建占位节点。幂等。 */
    register(path: string): RedDotNode {
        let node = this._nodes.get(path);
        if (node) return node;

        node = new RedDotNode(path);
        this._nodes.set(path, node);

        const parentPath = this._parentPath(path);
        if (parentPath !== null) {
            const parent = this.register(parentPath);
            node.parent = parent;
            parent.children.set(node.segmentKey, node);
        }
        return node;
    }

    /** 设置某个节点的 selfCount；自动冒泡到根。 */
    setSelfCount(path: string, count: number): void {
        const node = this.register(path);
        const c = Math.max(0, Math.floor(count));
        if (node.selfCount === c) return;
        node.selfCount = c;
        this._bubble(node);
    }

    getTotalCount(path: string): number {
        return this._nodes.get(path)?.totalCount ?? 0;
    }

    /** 订阅某个路径的 totalCount 变化。返回反订阅函数。 */
    subscribe(path: string, cb: RedDotListener): () => void {
        const node = this.register(path);
        node.listeners.add(cb);
        cb(node.totalCount);
        return () => node.listeners.delete(cb);
    }

    /** 从 startNode 开始向上冒泡，重算每层 totalCount 并派发。 */
    private _bubble(startNode: RedDotNode): void {
        let node: RedDotNode | null = startNode;
        while (node) {
            const oldTotal = node.totalCount;
            let sum = node.selfCount;
            node.children.forEach(ch => { sum += ch.totalCount; });
            if (sum === oldTotal) return;
            node.totalCount = sum;
            node.listeners.forEach(cb => cb(sum));
            node = node.parent;
        }
    }

    private _parentPath(path: string): string | null {
        const i = path.lastIndexOf('.');
        return i < 0 ? null : path.substring(0, i);
    }

    /** 仅用于测试：清空所有节点 */
    _resetForTest(): void {
        this._nodes.clear();
    }
}
```

---

## 7. 怎么用（示例）

用 console 就能看到效果，不需要 UI：

```typescript
import { RedDotManager } from './core/reddot/RedDotManager';

const mgr = RedDotManager.instance;

mgr.register('home.level.l1');
mgr.register('home.level.l2');
mgr.register('home.mail.m1');

mgr.subscribe('home', (n) => console.log(`home: ${n}`));
mgr.subscribe('home.level', (n) => console.log(`home.level: ${n}`));

mgr.setSelfCount('home.level.l1', 1);
// 输出：
//   home.level: 1
//   home: 1

mgr.setSelfCount('home.level.l2', 3);
// 输出：
//   home.level: 4
//   home: 4

mgr.setSelfCount('home.mail.m1', 2);
// 输出：
//   home: 6
//   （home.level 没变，不被通知）

mgr.setSelfCount('home.level.l1', 0);
// 输出：
//   home.level: 3
//   home: 5
```

把上面代码贴到任意启动脚本，F12 打开控制台就能看到。

### UI 接入示例

```typescript
import { RedDotView } from '../core/reddot/RedDotView';
import { RedDotManager } from '../core/reddot/RedDotManager';

// 假设 levelTabButton 节点上挂了 RedDotView
const view = levelTabButton.getComponent(RedDotView)!;
RedDotManager.instance.subscribe('home.level', (n) => view.setCount(n));
```

一行订阅代码，永远不用再手动刷新这个按钮的红点。

---

## 8. 验证清单

- [ ] 只注册叶子节点 `home.level.l1`，查询 `home`、`home.level` 都返回 0 且不报错
- [ ] `setSelfCount('home.level.l1', 2)` → 三个路径的 totalCount 分别是 **2 / 2 / 2**
- [ ] 再 `setSelfCount('home.mail.m1', 3)` → `home` = 5，`home.level` 仍 = 2
- [ ] 把 `l1` 从 2 设回 2（没变）→ **不触发任何 listener 回调**（log 不打印）
- [ ] 先 `subscribe`，再 `setSelfCount` —— subscribe 那一刻立即拿到 0；赋值后拿到新值

---

## 9. 这阶段的局限 → 下一阶段解决

现在有新问题：

> "每次业务变化，必须**有人记得调 `setSelfCount`**。"

比如玩家玩完一局，谁负责调 `setSelfCount('home.level.l1', 0)`？
如果写在 `GamePage` 里，`GamePage` 就和红点系统耦合了。换一个地方处理存档，又要再改 `GamePage`。

**我们需要反过来**：让红点节点自己知道怎么算，业务代码只管改数据。
这就是 **Provider 模式**，Stage 3 解决。

继续看 [`03-provider-registry.md`](./03-provider-registry.md)。
