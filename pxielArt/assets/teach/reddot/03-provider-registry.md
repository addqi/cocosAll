# Stage 3 — Provider 模式 + 集中注册

> **这一阶段结束，你会得到**：所有红点逻辑集中在一张"红点清单"里声明；业务代码只管改数据，**永远不需要 `import RedDotManager`**。
> **关键升级**：Stage 2 的 `setSelfCount` 是"推"，这一阶段改为"拉"（Provider 模式）。
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

## 2. Linus 式三连问

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
代码不到 20 行。

---

## 3. 设计方案

### 3.1 两种写入模式并存

为了向后兼容 Stage 2，我们**保留 `setSelfCount`（推模式）**，**新增 `refresh`（拉模式）**：

```typescript
// 推（Stage 2，依然可用）
mgr.setSelfCount('home.level.l1', 1);

// 拉（Stage 3，推荐）
mgr.register('home.level.l1', {
    provider: () => StorageService.isLevelSeen('l1') ? 0 : 1,
});
mgr.refresh('home.level.l1');   // 业务数据变了，告诉红点"重算一下"
```

两种模式互不冲突，甚至可以混用（没 provider 的节点只能用 setSelfCount，有 provider 的两种都行）。

### 3.2 集中注册：RedDotRegistry

所有红点在**一个文件**里声明，业务代码**只负责改数据 + 调 refresh**：

```typescript
// RedDotRegistry.ts —— 全项目唯一的红点清单
export function registerAllRedDots(): void {
    const mgr = RedDotManager.instance;

    // —— 关卡 —— 
    for (const entry of LevelManifest) {
        mgr.register(`home.level.${entry.id}`, {
            provider: () => StorageService.isLevelSeen(entry.id) ? 0 : 1,
        });
    }

    // —— 邮件 —— （Stage 6 会讲动态节点）
    // —— 活动 —— 
    // —— ... —— 
}
```

项目启动时（`LaunchRoot` 或 `AppRoot`）调一次 `registerAllRedDots()` + `mgr.refreshAll()`，整棵树初始化完毕。

### 3.3 refresh 的两个层面

```typescript
mgr.refresh(path);       // 只重算这一个节点的 selfCount + 冒泡
mgr.refreshAll();        // 遍历所有注册了 provider 的节点，全部重算
```

- **局部 refresh**：业务知道只改了一个数据源时用（如玩家点了关卡 l1）
- **全量 refreshAll**：启动时、冷数据变动（如拉后端拉了一包数据）时用

**性能提示**：`refreshAll` 里仍然靠 `_bubble` 的剪枝避免重复计算；但 Stage 5 会用"脏标记 + 一帧 flush 一次"做更优雅的批量刷新。

### 3.4 API 最终形态

```typescript
interface RedDotNodeConfig {
    provider?: () => number;
}

class RedDotManager {
    // 升级：register 支持 provider
    register(path: string, config?: RedDotNodeConfig): RedDotNode;

    // Stage 2 保留
    setSelfCount(path: string, count: number): void;
    getTotalCount(path: string): number;
    subscribe(path: string, cb: RedDotListener): () => void;

    // Stage 3 新增
    refresh(path: string): void;
    refreshAll(): void;
}
```

---

## 4. 完整代码

### 4.1 升级 `RedDotNode.ts`

```typescript
export type RedDotListener = (totalCount: number) => void;
export type RedDotProvider = () => number;

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

### 4.2 升级 `RedDotManager.ts`

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
            if (node.provider) {
                const next = this._callProvider(node);
                if (node.selfCount !== next) {
                    node.selfCount = next;
                    this._bubble(node);
                }
            }
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

### 4.3 新增 `RedDotRegistry.ts`（项目级清单）

这一层是**项目特定的**，文件内容示意：

```typescript
import { RedDotManager } from './RedDotManager';
import { LevelManifest } from '../../config/LevelManifest';
import { StorageService } from '../../storage/StorageService';

/**
 * 全项目红点清单。LaunchRoot 启动时调用一次。
 * 规则：只能在这里声明，业务代码不允许直接调 register。
 */
export function registerAllRedDots(): void {
    const mgr = RedDotManager.instance;

    // 关卡红点：玩家未"见过"的关卡都亮
    for (const entry of LevelManifest) {
        mgr.register(`home.level.${entry.id}`, {
            provider: () => StorageService.isLevelSeen(entry.id) ? 0 : 1,
        });
    }

    // "关卡" Tab 按钮（纯父节点，没有 provider；total = 所有子的 total 之和）
    mgr.register('home.level');
    mgr.register('home');

    // 启动时全量刷新一次
    mgr.refreshAll();
}
```

### 关键解读

1. **register 拆成"建节点"和"设 provider"两步**：第一次注册建节点；后续注册只更新 provider。避免重复创建。
2. **`_callProvider` 集中异常处理**：一个 provider 抛错不能影响整棵树。业务代码里的 bug 会被 log 捕获。
3. **`refreshAll` 不递归，顺序无关**：每个节点独立算自己的 selfCount，冒泡由 `_bubble` 自行处理。即使按随机顺序调用 provider，最终 totalCount 也是正确的（数学归纳可证）。
4. **`registerAllRedDots` 单一入口**：全项目只有一个地方注册。未来 review 红点逻辑只看这个文件。

---

## 5. 怎么用（示例）

### 5.1 在 `LaunchRoot` 启动时调用一次

```typescript
import { registerAllRedDots } from './core/reddot/RedDotRegistry';

// LaunchRoot.start()
registerAllRedDots();
```

### 5.2 业务代码变干净了

**Before（Stage 2）：**
```typescript
// HomePage.ts
onClickLevelCard(entry: LevelEntry) {
    StorageService.markLevelSeen(entry.id);
    RedDotManager.instance.setSelfCount(`home.level.${entry.id}`, 0);  // ← 耦合
    this._onSelectLevel?.(entry);
}
```

**After（Stage 3）：**
```typescript
// HomePage.ts
onClickLevelCard(entry: LevelEntry) {
    StorageService.markLevelSeen(entry.id);
    RedDotManager.instance.refresh(`home.level.${entry.id}`);   // ← 这行还在
    this._onSelectLevel?.(entry);
}
```

好像只是改了一个方法名？别急，**真正的价值在下一阶段**：Stage 4 会让 `refresh` 也消失，业务代码完全不提红点。

### 5.3 UI 订阅不变

```typescript
// LevelCard.ts
RedDotManager.instance.subscribe(`home.level.${entry.id}`, (count) => {
    this._redDotView.setCount(count);
});
```

---

## 6. 验证清单

- [ ] 注册 `home.level.l1` 带 provider，**未调 refresh 前** totalCount 仍是 0（provider 懒调用）
- [ ] 调 `refreshAll()` 后，`home.level.l1.totalCount` 正确反映 provider 返回值
- [ ] 改变 `StorageService` 里的数据（模拟玩家点了 l1），调 `refresh('home.level.l1')` → 订阅者收到新值
- [ ] provider 里故意抛异常，整个冒泡不崩；console 打出错误；该节点 selfCount = 0
- [ ] 重复调 `register('home.level.l1', { provider: 新函数 })`，**节点不复建**，provider 被替换
- [ ] 只注册了叶子带 provider，父节点没 provider → 父节点 totalCount 仍正确（等于子节点之和）

---

## 7. 这阶段的局限 → 下一阶段解决

现在业务代码还残留一行：

```typescript
RedDotManager.instance.refresh(`home.level.${entry.id}`);
```

这还是耦合。如果一份业务数据被 5 个入口修改（玩家点击、广告回调、后端推送、离线同步、管理员改档），**每个入口都要手动 refresh**，又要漏改。

**根本解法**：业务代码发出"我改数据了"的事件，红点节点在注册时声明"我依赖这个事件"，事件一发红点自己 refresh。

继续看 [`04-event-driven.md`](./04-event-driven.md)。
