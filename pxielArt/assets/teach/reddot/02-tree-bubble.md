# Stage 2 — 树形结构 + 自动冒泡

> **这一阶段结束，你会得到**：一棵"红点树"。在叶子节点改一个数，父节点、祖父节点的总数**自动更新**，挂在它们上面的 UI **自动刷新**。
> **代码量**：约 150 行，两个文件（`RedDotNode.ts` + `RedDotManager.ts`）。
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

## 2. Linus 式三连问

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
| 重复 register 同一路径 | 报错 | 幂等：覆盖 provider 即可 |

消除特殊情况是 Linus 哲学里最重要的一条。

### 🔴 复杂度

冒泡算法 = 一个循环向上走 while (parent)。**不能递归**（栈爆），**不能深度优先重算整棵树**（性能）。
核心只有十几行。

---

## 3. 设计方案

### 3.1 路径 id 设计

用**点分隔字符串**：`'home.level.l1'`。

为什么不用对象引用（`root.home.level.l1`）？
- 字符串可序列化、可写配置表、可 log
- 对象引用要求调用方知道层级结构，耦合死
- 字符串查错快（搜全代码就能看到用了多少次）

### 3.2 API 形态

```typescript
// 初始化
const manager = RedDotManager.instance;

// 注册节点（路径自动推断父节点）
manager.register('home');
manager.register('home.level');
manager.register('home.level.l1');
manager.register('home.level.l2');

// 叶子节点设值（唯一的数据入口）
manager.setSelfCount('home.level.l1', 1);
manager.setSelfCount('home.level.l2', 3);

// 查询
manager.getTotalCount('home.level');  // 4
manager.getTotalCount('home');        // 4

// 订阅（UI 挂钩）
manager.subscribe('home.level', (total) => {
    redDotView.setCount(total);
});
```

### 3.3 冒泡流程

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
例子：`home.level.l1` 从 1 变 1（没变）→ 直接返回，不冒泡。

### 3.4 父节点何时"存在"

`register('home.level.l1')` 时，`'home'` 和 `'home.level'` 如果没注册过，**系统会自动建**（占位节点，selfCount=0）。
这避免了"必须按顺序注册"的特殊情况。

---

## 4. 完整代码

### 4.1 `assets/src/core/reddot/RedDotNode.ts`

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

### 4.2 `assets/src/core/reddot/RedDotManager.ts`

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

    /** 设置叶子节点的 selfCount；自动冒泡到根。 */
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
        cb(node.totalCount); // 立即派发一次初始值（符合新手直觉）
        return () => node.listeners.delete(cb);
    }

    /** 重算一个节点的 totalCount 并按需冒泡。 */
    private _bubble(startNode: RedDotNode): void {
        let node: RedDotNode | null = startNode;
        while (node) {
            const oldTotal = node.totalCount;
            let sum = node.selfCount;
            node.children.forEach(ch => { sum += ch.totalCount; });
            if (sum === oldTotal) return; // 剪枝：没变就不冒泡
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

### 关键解读

1. **单例（`.instance`）**：全游戏只有一棵红点树。不要给每个页面建一棵，那样冒泡无法跨页面。
2. **注册是幂等的**：重复 `register` 同一路径返回同一节点。避免"必须先检查再注册"的特殊情况。
3. **`subscribe` 立即派发初始值**：UI 订阅时马上能拿到当前数，避免首帧空白。
4. **`_bubble` 用 while 循环，不用递归**：树高即使 20 层也一样稳。

---

## 5. 怎么用（示例）

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

## 6. 验证清单

- [ ] 只注册叶子节点 `home.level.l1`，查询 `home`、`home.level` 都返回 0 且不报错
- [ ] `setSelfCount('home.level.l1', 2)` → 三个路径的 totalCount 分别是 **2 / 2 / 2**
- [ ] 再 `setSelfCount('home.mail.m1', 3)` → `home` = 5，`home.level` 仍 = 2
- [ ] 把 `l1` 从 2 设回 2（没变）→ **不触发任何 listener 回调**（log 不打印）
- [ ] 先 `subscribe`，再 `setSelfCount` —— subscribe 那一刻立即拿到 0；赋值后拿到新值

---

## 7. 这阶段的局限 → 下一阶段解决

现在有新问题：

> "每次业务变化，必须**有人记得调 `setSelfCount`**。"

比如玩家玩完一局，谁负责调 `setSelfCount('home.level.l1', 0)`？
如果写在 `GamePage` 里，`GamePage` 就和红点系统耦合了。换一个地方处理存档，又要再改 `GamePage`。

**我们需要反过来**：让红点节点自己知道怎么算，业务代码只管改数据。
这就是 **Provider 模式**，Stage 3 解决。

继续看 [`03-provider-registry.md`](./03-provider-registry.md)。
