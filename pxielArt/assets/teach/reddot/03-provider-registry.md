# Stage 3 — Provider 模式 + 集中注册

> **这一阶段结束，你会得到**：所有红点逻辑集中在一张"红点清单"里声明；业务代码只管改数据，**永远不需要 `import RedDotManager`**（至少在写红点规则时不需要）。
> **关键升级**：Stage 2 的 `setSelfCount` 是"推"，这一阶段改为"拉"（Provider 模式）。
> **代码量**：约 120 行新增/修改，动 3 个文件。
> **前置**：完成 [Stage 2](./02-tree-bubble.md)。

---

## 1. 要解决什么问题

Stage 2 结束时我们留了一个尾巴：

> "每次业务变化，必须**有人记得调 `setSelfCount`**。"

想象一下真实项目里的样子：

```typescript
// GamePage.ts
onLevelComplete() {
    StorageService.markLevelDone(levelId);
    RedDotManager.instance.setSelfCount(`home.level.${levelId}`, 0);  // ← 红点耦合
}

// MyWorksPage.ts
onDeleteWork(id: string) {
    StorageService.removeWork(id);
    RedDotManager.instance.setSelfCount(`home.myworks.${id}`, 1);     // ← 红点耦合
}

// MailBox.ts
onMailRead(mailId: string) {
    MailData.markRead(mailId);
    RedDotManager.instance.setSelfCount(`home.mail.${mailId}`, 0);    // ← 红点耦合
}
```

**三个问题：**

1. **业务代码污染**：`GamePage`、`MyWorksPage`、`MailBox` 都被迫知道红点存在
2. **容易漏改**：新增一个"改动数据"的入口（比如后端推送关卡解锁），就要去加一行红点代码
3. **"红点规则"散落**：如果产品说"关卡通关 + 被领取两个条件都满足才消红点"，你要改 N 个文件

根源是：**现在的红点系统不知道"自己的 count 应该是多少"，只能靠外人告诉它。**

---

## 2. 本章要新增/修改哪些脚本

> 先看全景，别急着看代码。

本章涉及 **3 个文件**，**2 个升级 + 1 个新增**：

| 文件 | 操作 | 职责 | 代码量 |
|------|------|------|-------|
| `RedDotNode.ts` | **升级** | 新增一个字段 `provider` 存"算 count 的函数" | +3 行 |
| `RedDotManager.ts` | **升级** | `register` 支持 config、新增 `refresh` / `refreshAll` / `_callProvider` | +50 行 |
| `RedDotRegistry.ts` | **新增** | 项目级红点清单，所有红点规则集中在这一个文件里声明 | ~30 行 |

> 💡 **为什么要拆出 `RedDotRegistry.ts`？**
> `RedDotManager` 是**通用框架代码**——它不知道"关卡"、"邮件"、"活动"是什么，也不该知道。
> `RedDotRegistry` 是**项目专属代码**——它知道你的游戏有哪些功能模块、每个模块的红点规则怎么算。
> 两者分离的意义：框架可以换项目复用，业务规则变了只改 Registry，不污染框架。

### 2.1 骨架预览

**`RedDotNode.ts`**（只加一个字段）：

```typescript
export type RedDotProvider = () => number;  // ← 新增类型

export class RedDotNode {
    // ... Stage 2 的字段不变 ...
    provider: RedDotProvider | null = null;  // ← 新增
}
```

**`RedDotManager.ts`**（升级 register + 新增 3 个方法）：

```typescript
export interface RedDotNodeConfig {
    provider?: RedDotProvider;
}

export class RedDotManager {
    // 升级：register 支持 config 参数
    register(path: string, config?: RedDotNodeConfig): RedDotNode { ... }

    // 新增：Stage 3 拉模式
    refresh(path: string): void { ... }
    refreshAll(): void { ... }

    // 新增：内部异常安全地调 provider
    private _callProvider(node: RedDotNode): number { ... }

    // Stage 2 的方法全部保留不变
    setSelfCount(...) { ... }
    subscribe(...) { ... }
    getTotalCount(...) { ... }
    // ...
}
```

**`RedDotRegistry.ts`**（新文件，项目级清单）：

```typescript
// 所有红点规则写在这一个函数里
export function registerAllRedDots(): void {
    const mgr = RedDotManager.instance;

    // —— 关卡 —— 
    // —— 邮件 ——（Stage 6 会加）
    // —— 活动 ——（Stage 6 会加）
    // ...
}
```

看完这张图，你应该能猜到下面的调用链：

```
启动时：LaunchRoot → registerAllRedDots() → mgr.register(..., {provider}) + mgr.refreshAll()
运行时：业务改数据 → mgr.refresh('home.level.xx') → provider 拉取 → 冒泡
UI 层：mgr.subscribe('home.level', cb) → 自动刷新
```

带着这个印象往下读。

---

## 3. Linus 式三连问

### 🟢 数据结构

关键洞察：

> **"红点 count 是多少" 是一个纯函数 `() => number`，由业务数据推导出来的。**

既然是纯函数，就把这个函数**交给红点系统**，让它自己算。

```typescript
interface RedDotNodeConfig {
    path: string;
    provider?: () => number;    // ← 新增：怎么算 selfCount
}
```

节点内部加一个字段存这个函数：

```typescript
class RedDotNode {
    // 原有字段不变 ...
    provider: (() => number) | null = null;
}
```

### 🟡 特殊情况

| 情况 | 糟糕设计 | 好设计 |
|------|---------|--------|
| 父节点没有 provider | 特判：父节点走一套，叶子走另一套 | 统一："没 provider" = `provider = null`，算 selfCount 时返回 0 |
| 运行时改 provider | 加 `setProvider` / `changeProvider` API | `register` 幂等，再 register 覆盖 provider |
| provider 抛异常 | 整个冒泡链崩溃 | try-catch 包住，异常时 selfCount=0 + console.error |

消除特殊情况的方法：**默认 provider = null，null 等价于返回 0 的函数**。这就是 Linus 说的"让特殊情况变成正常情况"。

### 🔴 复杂度

本阶段只增加一个方法 `refresh(path)`：拉一次 provider、写 selfCount、冒泡。
核心代码不到 20 行。

---

## 4. 设计方案

### 4.1 两种写入模式并存

为了向后兼容 Stage 2，我们**保留 `setSelfCount`（推模式）**，**新增 `refresh`（拉模式）**：

```typescript
// 推（Stage 2，依然可用）
mgr.setSelfCount('home.level.l1', 1);

// 拉（Stage 3，推荐）
mgr.register('home.level.l1', {
    provider: () => StorageService.isLevelDone('l1') ? 0 : 1,
});
mgr.refresh('home.level.l1');   // 业务数据变了，告诉红点"重算一下"
```

两种模式互不冲突，甚至可以混用（没 provider 的节点只能用 `setSelfCount`，有 provider 的两种都行）。

### 4.2 refresh 的两个层面

```typescript
mgr.refresh(path);       // 只重算这一个节点的 selfCount + 冒泡
mgr.refreshAll();        // 遍历所有注册了 provider 的节点，全部重算
```

- **局部 refresh**：业务知道只改了一个数据源时用（如玩家点了关卡 l1）
- **全量 refreshAll**：启动时、冷数据变动（如后端拉了一包新数据）时用

**性能提示**：`refreshAll` 里仍然靠 `_bubble` 的剪枝避免重复计算；Stage 5 会用"脏标记 + 一帧 flush 一次"做更优雅的批量刷新。

### 4.3 集中注册：RedDotRegistry

**原则**：全项目只能在**一个文件**里调 `register`，业务代码不允许直接调。

```typescript
// RedDotRegistry.ts —— 全项目唯一的红点清单
export function registerAllRedDots(): void {
    const mgr = RedDotManager.instance;

    for (const entry of LevelManifest) {
        mgr.register(`home.level.${entry.id}`, {
            provider: () => StorageService.isLevelDone(entry.id) ? 0 : 1,
        });
    }
    // ... 后续模块继续加 ...

    mgr.refreshAll();  // 初始化完马上算一次
}
```

项目启动时（`LaunchRoot`）调一次 `registerAllRedDots()`，整棵树初始化完毕。

### 4.4 API 最终形态

```typescript
interface RedDotNodeConfig {
    provider?: () => number;
}

class RedDotManager {
    register(path: string, config?: RedDotNodeConfig): RedDotNode;  // 升级

    setSelfCount(path: string, count: number): void;     // Stage 2 保留
    getTotalCount(path: string): number;                 // Stage 2 保留
    subscribe(path: string, cb: RedDotListener): () => void;  // Stage 2 保留

    refresh(path: string): void;                         // Stage 3 新增
    refreshAll(): void;                                  // Stage 3 新增
}
```

---

## 5. 分步实现

从最简单的数据结构升级开始，再到 Manager 每一个新方法，最后新建 Registry 文件。

### 5.1 升级 `RedDotNode`：加一个 provider 字段

**这一步要做什么**：在节点数据结构里新增一个可选字段 `provider`，用来存"怎么算 selfCount"的函数。同时导出一个类型别名 `RedDotProvider` 方便复用。

> 修改 `assets/src/core/reddot/RedDotNode.ts`

在类定义顶部加一行类型别名：

```typescript
export type RedDotProvider = () => number;
```

在类字段区域加一行（位置放在 `totalCount` 下方、`listeners` 上方）：

```typescript
/** Stage 3 新增：selfCount 的推导函数。null = 纯父节点 / 只能用 setSelfCount */
provider: RedDotProvider | null = null;
```

**关键解读**：

- **默认 `null`** 而不是 `() => 0`——省一次函数调用，而且 `null` 是"明确没有"的语义，比"返回 0 的函数"更直白。
- `RedDotProvider` 导出到外部——后面 `RedDotManager` 和 `RedDotRegistry` 都会用到。
- **其他字段完全不动**。这个改动是**纯加法**，不破坏 Stage 2 的任何功能。

---

### 5.2 定义 `RedDotNodeConfig` 接口（Manager 入口类型）

**这一步要做什么**：在 `RedDotManager.ts` 顶部定义一个"注册配置"接口。这是 `register(path, config)` 的第二个参数类型。

> 修改 `assets/src/core/reddot/RedDotManager.ts`

顶部 import 升级：

```typescript
import { RedDotNode, RedDotListener, RedDotProvider } from './RedDotNode';
```

在 class 定义前加接口：

```typescript
export interface RedDotNodeConfig {
    /** 可选的 selfCount 推导函数 */
    provider?: RedDotProvider;
}
```

**关键解读**：

- **用接口，不用直接的参数列表**——将来要加 `priority`、`tag` 等字段，只改接口定义不破坏调用方。这是"**让数据结构决定 API，而不是反过来**"的品味。
- **`provider?` 是可选的**——允许注册"纯父节点"（`mgr.register('home')` 没 provider），表达"这个节点只是容器，它的 count 由子节点汇总"。

---

### 5.3 升级 `register`：支持 config 参数

**这一步要做什么**：让 `register` 同时能（a）建节点、（b）设/覆盖 provider。**幂等**：重复 register 不会复建节点，但会更新 provider。

替换 Stage 2 的 `register` 方法：

```typescript
/** 注册/覆盖节点。幂等：同路径重复调只会更新 provider。 */
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
    if (config?.provider !== undefined) {
        node.provider = config.provider;
    }
    return node;
}
```

**关键解读**：

- **"建节点"和"设 provider"是两个阶段**：进函数先看节点在不在，不在就建、建完把父子关系挂好；**无论是否新建**，最后都看一眼 config 要不要覆盖 provider。
- **`config?.provider !== undefined` 而不是 `config?.provider`**：前者能区分"没传 provider 字段"和"显式传了 `undefined`"，更严格。
- **Stage 2 调用方不受影响**：`register('home')` 不传 config，行为跟 Stage 2 完全一致。

---

### 5.4 新增 `_callProvider`：异常安全地调 provider

**这一步要做什么**：把"调用 provider 函数"这件事封装到一个内部方法里，统一处理"没 provider"和"provider 抛异常"两种情况。

```typescript
/** 安全地调用 provider，异常时返回 0 + 打错误日志。 */
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
```

**关键解读**：

- **没 provider 返回 0**——让"纯父节点"这种情况完全消失，父节点也能走和叶子一样的流程。
- **try-catch 包住**——业务代码里的 provider 如果抛异常（比如 `StorageService` 还没初始化），**只会让这一个红点变 0**，不影响整棵树。Linus 的哲学："**永远不破坏用户空间**"，在库代码里体现为"永远不让业务错误污染框架"。
- **`Math.max(0, Math.floor(v))`** 做类型防御——业务传个负数或小数进来不会炸，直接夹成非负整数。

这个方法是接下来 `refresh` 和 `refreshAll` 共用的地基，必须先有它。

---

### 5.5 新增 `refresh`：单点拉取

**这一步要做什么**：接受一个路径，拉一次 provider，算出新的 `selfCount`，触发冒泡。

```typescript
/** Stage 3 拉模式：调用 provider 算出新 selfCount 并冒泡。 */
refresh(path: string): void {
    const node = this._nodes.get(path);
    if (!node) return;

    const next = this._callProvider(node);
    if (node.selfCount === next) return;
    node.selfCount = next;
    this._bubble(node);
}
```

**关键解读**：

- **节点不存在直接 `return`**——UI 代码可能比 Registry 初始化更早就调 refresh，不报错更友好。
- **值没变就不冒泡**——和 `setSelfCount` 一样的剪枝，避免无意义通知。
- **只管自己这一个节点**——父节点的 totalCount 会被 `_bubble` 自动带起来，不需要 refresh 也跟着跑。

---

### 5.6 新增 `refreshAll`：全量拉取

**这一步要做什么**：遍历所有注册了 provider 的节点，挨个拉取 + 冒泡。启动时调一次、冷数据大改时调一次。

```typescript
/** 全量刷新：所有有 provider 的节点依次 refresh。 */
refreshAll(): void {
    this._nodes.forEach((node) => {
        if (!node.provider) return;
        const next = this._callProvider(node);
        if (node.selfCount === next) return;
        node.selfCount = next;
        this._bubble(node);
    });
}
```

**关键解读**：

- **只处理有 provider 的节点**——纯父节点没 provider，不用调（它的 totalCount 会被子节点冒泡带起来）。
- **顺序无关**：每个节点独立算自己的 selfCount，不会互相影响。冒泡由 `_bubble` 自行处理。即使按随机顺序遍历，最终 totalCount 一定是正确的。这是"**独立性**"的设计，避免"必须先算 A 再算 B"的特殊情况。
- **性能**：每个节点最多冒泡一次，剪枝兜底。`N` 个带 provider 的节点、树高 `H` → 最差 `O(N·H)`。Stage 5 会把这个优化到一帧只冒泡一次。

---

### 5.7 新增 `RedDotRegistry.ts`：项目级清单

**这一步要做什么**：新建一个文件，把所有红点规则集中在一个函数里声明。这是**项目专属**代码，和通用框架解耦。

> 新建 `assets/src/core/reddot/RedDotRegistry.ts`

```typescript
import { RedDotManager } from './RedDotManager';
import { LevelManifest } from '../../config/LevelManifest';
import { StorageService } from '../../storage/StorageService';

/**
 * 全项目红点清单。LaunchRoot 启动时调用一次。
 *
 * 规则：只能在这里声明红点，业务代码不允许直接调 mgr.register。
 *      这样所有"红点应该在什么条件下亮"的规则都集中可见。
 */
export function registerAllRedDots(): void {
    const mgr = RedDotManager.instance;

    // —— 关卡红点：玩家没通关过的关卡亮一个红点 —— 
    for (const entry of LevelManifest) {
        mgr.register(`home.level.${entry.id}`, {
            provider: () => StorageService.isLevelDone(entry.id) ? 0 : 1,
        });
    }

    // —— 父节点：纯容器，没 provider，total 自动来自子节点之和 —— 
    mgr.register('home.level');
    mgr.register('home');

    // —— 其他模块（邮件 / 活动 / ...） —— 
    // Stage 6 讲动态节点时再加

    // 启动时全量刷新一次，让 UI 能拿到初始值
    mgr.refreshAll();
}
```

**关键解读**：

- **`for (const entry of LevelManifest)`**——把 4 关一次性注册完。以后 `LevelManifest` 加新关卡，**这个文件一个字都不用改**，是所谓"**开闭原则**"。
- **`isLevelDone` 的语义刚好反着**：done = 通关 = 消红点 → `done ? 0 : 1`。理解这种语义翻转，避免以后写错方向。
- **纯父节点也要注册**：`'home'` 和 `'home.level'` 没有 provider，但显式 register 一下是好习惯——让 Registry 这个文件**完整反映树形结构**，读代码的人一眼看懂整棵树。
- **最后调 `refreshAll`**：注册完马上算一次，让订阅的 UI 拿到的不是 0 而是真实值。

---

### 5.8 `LaunchRoot` 接入（1 行）

**这一步要做什么**：在启动入口调一次 `registerAllRedDots()`。

> 在你的 `LaunchRoot` 合适位置（比如 `start()` 末尾）：

```typescript
import { registerAllRedDots } from './core/reddot/RedDotRegistry';

// LaunchRoot.start() 或你已有的"初始化"阶段
registerAllRedDots();
```

到此，所有红点在启动的瞬间就已经算好初始值。UI 只要订阅就能拿到最新数。

---

## 6. 完整代码（汇总）

把上面各步拼起来就是最终版。方便你整体复制。

### 6.1 `assets/src/core/reddot/RedDotNode.ts`

```typescript
export type RedDotListener = (totalCount: number) => void;
export type RedDotProvider = () => number;

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

    /** Stage 3 新增：selfCount 的推导函数。null = 纯父节点 / 只能用 setSelfCount */
    provider: RedDotProvider | null = null;

    readonly listeners: Set<RedDotListener> = new Set();

    constructor(path: string) {
        this.path = path;
    }

    get segmentKey(): string {
        const i = this.path.lastIndexOf('.');
        return i < 0 ? this.path : this.path.substring(i + 1);
    }
}
```

### 6.2 `assets/src/core/reddot/RedDotManager.ts`

```typescript
import { RedDotNode, RedDotListener, RedDotProvider } from './RedDotNode';

export interface RedDotNodeConfig {
    provider?: RedDotProvider;
}

export class RedDotManager {
    private static _instance: RedDotManager | null = null;
    static get instance(): RedDotManager {
        if (!this._instance) this._instance = new RedDotManager();
        return this._instance;
    }

    private _nodes: Map<string, RedDotNode> = new Map();

    /** 注册/覆盖节点。幂等。 */
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
        if (config?.provider !== undefined) {
            node.provider = config.provider;
        }
        return node;
    }

    /** Stage 2 推模式：直接写 selfCount。 */
    setSelfCount(path: string, count: number): void {
        const node = this.register(path);
        const c = Math.max(0, Math.floor(count));
        if (node.selfCount === c) return;
        node.selfCount = c;
        this._bubble(node);
    }

    /** Stage 3 拉模式：调用 provider 算出新 selfCount 并冒泡。 */
    refresh(path: string): void {
        const node = this._nodes.get(path);
        if (!node) return;

        const next = this._callProvider(node);
        if (node.selfCount === next) return;
        node.selfCount = next;
        this._bubble(node);
    }

    /** 全量刷新：所有有 provider 的节点依次 refresh。 */
    refreshAll(): void {
        this._nodes.forEach((node) => {
            if (!node.provider) return;
            const next = this._callProvider(node);
            if (node.selfCount === next) return;
            node.selfCount = next;
            this._bubble(node);
        });
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

    _resetForTest(): void {
        this._nodes.clear();
    }
}
```

### 6.3 `assets/src/core/reddot/RedDotRegistry.ts`（新增）

```typescript
import { RedDotManager } from './RedDotManager';
import { LevelManifest } from '../../config/LevelManifest';
import { StorageService } from '../../storage/StorageService';

/**
 * 全项目红点清单。LaunchRoot 启动时调用一次。
 *
 * 规则：只能在这里声明红点，业务代码不允许直接调 mgr.register。
 *      这样所有"红点应该在什么条件下亮"的规则都集中可见。
 */
export function registerAllRedDots(): void {
    const mgr = RedDotManager.instance;

    // —— 关卡红点：玩家没通关过的关卡亮一个红点 —— 
    for (const entry of LevelManifest) {
        mgr.register(`home.level.${entry.id}`, {
            provider: () => StorageService.isLevelDone(entry.id) ? 0 : 1,
        });
    }

    // —— 父节点：纯容器，没 provider —— 
    mgr.register('home.level');
    mgr.register('home');

    // 启动时全量刷新一次
    mgr.refreshAll();
}
```

---

## 7. 怎么用（示例）

### 7.1 业务代码变干净了

**Before（Stage 2）：**
```typescript
// HomePage.ts
onClickLevelCard(entry: LevelEntry) {
    StorageService.markLevelDone(entry.id);
    RedDotManager.instance.setSelfCount(`home.level.${entry.id}`, 0);  // ← 耦合
    this._onSelectLevel?.(entry);
}
```

**After（Stage 3）：**
```typescript
// HomePage.ts
onClickLevelCard(entry: LevelEntry) {
    StorageService.markLevelDone(entry.id);
    RedDotManager.instance.refresh(`home.level.${entry.id}`);   // ← 这行还在
    this._onSelectLevel?.(entry);
}
```

好像只是改了一个方法名？别急，**真正的价值在下一阶段**：Stage 4 会让 `refresh` 也消失，业务代码完全不提红点。

### 7.2 UI 订阅不变

```typescript
// LevelCard.ts
RedDotManager.instance.subscribe(`home.level.${entry.id}`, (count) => {
    this._redDotView.setCount(count);
});
```

### 7.3 控制台验证（测试脚本）

在 `DemoButton._testRedDotManager` 末尾追加一段：

```typescript
import { registerAllRedDots } from './RedDotRegistry';

// 接着 Stage 2 的测试后面
mgr._resetForTest();
registerAllRedDots();
console.log('home.level.apple =', mgr.getTotalCount('home.level.apple'));
// 预期：如果 apple 没通关 → 输出 1；已通关 → 输出 0

console.log('home.level =', mgr.getTotalCount('home.level'));
// 预期：所有未通关关卡数量之和（比如 4 关都没通 → 4）

console.log('home =', mgr.getTotalCount('home'));
// 预期：和 home.level 相同（目前只有 level 这一个子模块）
```

---

## 8. 验证清单

- [ ] 注册 `home.level.l1` 带 provider，**未调 refresh 前** totalCount 仍是 0（provider 懒调用）
- [ ] 调 `refreshAll()` 后，`home.level.xxx.totalCount` 正确反映 provider 返回值
- [ ] 改变 `StorageService` 数据（模拟玩家通关），调 `refresh('home.level.xxx')` → 订阅者收到新值
- [ ] provider 里故意抛异常，整个冒泡不崩；console 打出错误；该节点 selfCount = 0
- [ ] 重复调 `register('home.level.l1', { provider: 新函数 })`，**节点不复建**，provider 被替换
- [ ] 只注册了叶子带 provider，父节点没 provider → 父节点 totalCount 仍正确（等于子节点之和）
- [ ] Stage 2 的 `setSelfCount` 依然可用，和 Stage 3 的 refresh 可混用

---

## 9. 这阶段的局限 → 下一阶段解决

现在业务代码还残留一行：

```typescript
RedDotManager.instance.refresh(`home.level.${entry.id}`);
```

这还是耦合。如果一份业务数据被 5 个入口修改（玩家点击、广告回调、后端推送、离线同步、管理员改档），**每个入口都要手动 refresh**，又要漏改。

**根本解法**：业务代码发出"我改数据了"的事件，红点节点在注册时声明"我依赖这个事件"，事件一发红点自己 refresh。

继续看 [`04-event-driven.md`](./04-event-driven.md)。
