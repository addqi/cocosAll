# Stage 4 — 事件驱动

> **这一阶段结束，你会得到**：业务代码**彻底不知道红点存在**。业务只发事件，红点自己订阅、自己 refresh、自己冒泡。
> **关键升级**：Stage 3 的 `refresh(path)` 调用退出业务代码，改由红点系统内部响应事件自动触发。
> **代码量**：约 100 行新增/修改，动 3 个老文件 + 1 个新文件。
> **前置**：完成 [Stage 3](./03-provider-registry.md)。

---

## 1. 要解决什么问题

Stage 3 把红点逻辑集中了，但业务代码里还有这一行：

```typescript
StorageService.markLevelDone(entry.id);
RedDotManager.instance.refresh(`home.level.${entry.id}`);   // ← 还在耦合
```

当改动入口有 5 个（玩家点击、广告回调、后端推送、离线同步、活动发奖），你就要在 5 个地方写 5 次 `refresh`。漏掉一个，红点永远不刷新。

**根本问题：业务数据变化 和 红点重算 之间是 N : M 的关系**。
- N 个数据源（玩家、广告、后端、...）
- M 个红点依赖（关卡红点、首页 tab 红点、邮件...）

**硬编码的耦合数量是 N × M**。加一个数据源要改 M 处，加一个红点要改 N 处。

事件总线把它拆成 **N + M**：
- 数据源发事件（只发 1 次）
- 红点节点订阅事件（只订阅 1 次）

---

## 2. 本章要新增/修改哪些脚本

> 先看全景，别急着看代码。

本章涉及 **4 个文件**，**1 个新增 + 3 个升级**：

| 文件 | 操作 | 职责 | 代码量 |
|------|------|------|-------|
| `RedDotEventBus.ts` | **新增** | 订阅关系表：`event → 依赖此事件的节点路径集合` | ~30 行 |
| `RedDotEvents.ts` | **新增** | 事件名常量表（字符串集中管理） | ~8 行 |
| `RedDotManager.ts` | **升级** | `register` 支持 `deps`、新增 `emit` / `unregister` | +30 行 |
| `StorageService.ts` | **升级** | `markLevelDone` 末尾 emit 一次事件 | +2 行 |

> 💡 **为什么要拆出 `RedDotEventBus`？**
> 可以全塞进 `RedDotManager`，但订阅表和树算法是**两件事**。拆开后：
> - `EventBus` 只管"谁订阅了谁"，可独立单测
> - `Manager` 只管"刷新 + 冒泡"，逻辑更干净
> - 将来想换事件实现（比如用项目已有的 `Signal`）只改一个文件

### 2.1 骨架预览

**`RedDotEventBus.ts`**（新文件）：

```typescript
export class RedDotEventBus {
    static readonly instance: RedDotEventBus;

    subscribe(event: string, path: string): void     // 订阅：path 关心 event
    unsubscribe(event: string, path: string): void   // 退订一对
    unsubscribeAll(path: string): void                // 退订某 path 的所有订阅（节点销毁时）
    getSubscribedPaths(event: string): string[]       // 查谁订阅了 event
}
```

**`RedDotEvents.ts`**（新文件，常量集合）：

```typescript
export const RedDotEvents = {
    LevelDoneChanged: 'level_done_changed',
    // 后续模块继续加 ...
} as const;
```

**`RedDotManager.ts`**（升级已有文件）：

```typescript
export interface RedDotNodeConfig {
    provider?: RedDotProvider;
    deps?: string[];    // ← 新增
}

class RedDotManager {
    // 升级：register 支持 deps
    register(path, config): RedDotNode { ... }

    // 新增：根据事件名批量触发 refresh
    emit(event: string): void { ... }

    // 新增：销毁节点（子节点级联 + 退订所有事件）
    unregister(path: string): void { ... }
}
```

**`StorageService.ts`**（升级已有文件）：

```typescript
static markLevelDone(levelId: string): void {
    // ... 原有逻辑 ...
    RedDotManager.instance.emit(RedDotEvents.LevelDoneChanged);  // ← 新增一行
}
```

### 2.2 数据流全景

带着这张图读下面的实现：

```
业务代码改数据（StorageService.markLevelDone）
        ↓ emit('level_done_changed')
RedDotManager.emit
        ↓ 查订阅表
RedDotEventBus.getSubscribedPaths('level_done_changed')
        ↓ 返回 ['home.level.apple', 'home.level.mountain', ...]
RedDotManager.refresh(path) × N
        ↓ 调 provider → 冒泡 → 通知 UI
RedDotView.setCount(新值)
```

**关键：业务代码 `StorageService` 不需要 `import RedDotEventBus`，只需要 `import RedDotManager + RedDotEvents`**。

---

## 3. Linus 式三连问

### 🟢 数据结构

新增一个"事件名 → 依赖该事件的节点列表"的映射：

```typescript
class RedDotEventBus {
    private _subs: Map<string, Set<string>> = new Map();
    //                ^event       ^依赖它的 path 集合
}
```

节点注册时声明依赖：

```typescript
interface RedDotNodeConfig {
    provider?: RedDotProvider;
    deps?: string[];   // ← 新增：依赖的事件名列表
}
```

### 🟡 特殊情况

| 情况 | 糟糕设计 | 好设计 |
|------|---------|--------|
| 事件先发、节点后注册 | 丢失事件 | 红点系统不做"事件回放"；启动阶段统一 `refreshAll` 一次即可 |
| 一个节点依赖多个事件 | 数组遍历，多套逻辑 | 注册时把节点路径加到**每个事件**的订阅列表里，自然支持 |
| 同一事件一帧内被发 N 次 | 节点被 refresh N 次 | 本阶段先不合并（留给 Stage 5 解决） |
| 节点被注销，事件还发 | 崩溃或脏数据 | 注销时从所有事件订阅列表里删除该路径 |

### 🔴 复杂度

事件总线 **30 行**足矣。**不要引入外部库**（RxJS / mitt / EventEmitter3），你只需要「订阅、退订、查订阅者」三个方法。

---

## 4. 设计方案

### 4.1 API 形态

**注册时声明依赖：**

```typescript
mgr.register('home.level.apple', {
    provider: () => StorageService.isLevelDone('apple') ? 0 : 1,
    deps: [RedDotEvents.LevelDoneChanged],   // ← 关心这个事件
});
```

**业务代码发事件（取代原先的 refresh 调用）：**

```typescript
class StorageService {
    static markLevelDone(levelId: string): void {
        // 原有写入逻辑 ...
        RedDotManager.instance.emit(RedDotEvents.LevelDoneChanged);  // ← 取代 refresh
    }
}
```

**红点系统内部自动响应：**
`RedDotManager.emit` 收到 `'level_done_changed'` → 去 `RedDotEventBus` 查依赖它的路径 → 逐个调 `this.refresh(path)` → 冒泡完成。

### 4.2 事件命名规范（强约束）

| 好 | 坏 | 原因 |
|---|---|------|
| `level_done_changed` | `level_clicked` | 事件名描述**数据变化**，不描述动作。动作可能有多种（点击、后端推、自动解锁）都会改数据，不该用动作命名 |
| `mail_unread_changed` | `update_mail` | "update" 什么意思？改了已读状态？还是收了新邮件？含义模糊 |
| `tool_count_changed` | `on_refill` | 补充是动作之一；扣减也得发事件。统一用 `changed` |

**规则：`<数据域>_<状态>_changed`**

为什么重要？系统大了有几十上百个事件，命名不统一你会疯掉。

### 4.3 为什么事件名集中在一个常量表

不要散字符串：

```typescript
// 坏写法
mgr.emit('level_done_changed');       // 这里写成字符串
mgr.register(path, { deps: ['level_done_changed'] });  // 那里又手打一遍

// 好写法
mgr.emit(RedDotEvents.LevelDoneChanged);
mgr.register(path, { deps: [RedDotEvents.LevelDoneChanged] });
```

字符串散落的问题：哪天有人把 `_done_` 打成 `_dono_`，编译器**不会报错**——运行时红点就是不刷新，debug 到天亮。常量表让编译器帮你找打错。

---

## 5. 分步实现

按 "先有地基、再盖上层" 的顺序：先建 `EventBus` → 再建事件常量表 → 再升级 `Manager` → 最后改 `StorageService`。

### 5.1 新建 `RedDotEventBus`（订阅关系表）

**这一步要做什么**：写一个专门存"谁订阅了谁"的单例。**故意做得极简**：不支持参数、不支持优先级、不支持异步——这些都是通用事件库的特性，红点系统**不需要**。

> 新建 `assets/src/core/reddot/RedDotEventBus.ts`

```typescript
/**
 * 红点系统内部事件总线（不要拿去做通用事件！）
 * 故意不支持带参数：红点 provider 自己会从数据源读取最新值。
 * 故意不支持优先级：所有订阅者平权，顺序无意义。
 */
export class RedDotEventBus {
    private static _instance: RedDotEventBus | null = null;
    static get instance(): RedDotEventBus {
        if (!this._instance) this._instance = new RedDotEventBus();
        return this._instance;
    }

    /** event → 依赖此事件的节点路径集合 */
    private _subs: Map<string, Set<string>> = new Map();

    /** 订阅：把 path 注册到 event 的订阅列表 */
    subscribe(event: string, path: string): void {
        let set = this._subs.get(event);
        if (!set) {
            set = new Set();
            this._subs.set(event, set);
        }
        set.add(path);
    }

    /** 注销一对（event, path） */
    unsubscribe(event: string, path: string): void {
        this._subs.get(event)?.delete(path);
    }

    /** 注销一个 path 的所有订阅（节点销毁时用） */
    unsubscribeAll(path: string): void {
        this._subs.forEach(set => set.delete(path));
    }

    /** 查询：谁订阅了这个事件 */
    getSubscribedPaths(event: string): string[] {
        const set = this._subs.get(event);
        return set ? Array.from(set) : [];
    }

    _resetForTest(): void {
        this._subs.clear();
    }
}
```

**关键解读**：

- **不直接调 `mgr.refresh`**——它只回答"谁订阅了这个事件"。真正的派发在 `RedDotManager.emit` 里。这是**单一职责**：EventBus 只管订阅关系，不管触发什么动作。便于单测。
- **用 `Set` 不用数组**——同一对 `(event, path)` 重复 subscribe 只存一次，避免"意外订了两次导致刷两次"。
- **`unsubscribeAll`**——节点销毁时一次清干净。否则节点删了订阅还留着，事件一发就引用幽灵路径，会进 `refresh` 里的 `if (!node) return` 分支——不会崩，但是泄漏。
- **`getSubscribedPaths` 返回数组副本**——调用方拿到后即使修改也不会影响内部 `Set`，防御性编程。

---

### 5.2 新建 `RedDotEvents`（事件名常量表）

**这一步要做什么**：建一个只存字符串常量的文件，全项目所有事件名都写在这里。

> 新建 `assets/src/core/reddot/RedDotEvents.ts`

```typescript
/**
 * 全项目红点事件名常量。
 * 规则：事件名只能在这里定义，业务/Registry 代码只能 import 使用。
 */
export const RedDotEvents = {
    /** 关卡通关状态变化（markLevelDone 时触发） */
    LevelDoneChanged: 'level_done_changed',

    // 后续新模块事件继续加 ...
    // MailUnreadChanged: 'mail_unread_changed',
    // ToolCountChanged: 'tool_count_changed',
} as const;

/** 强类型事件名（任何 emit/deps 都应该用这个类型） */
export type RedDotEventName = typeof RedDotEvents[keyof typeof RedDotEvents];
```

**关键解读**：

- **`as const`**——让 TS 把字符串字面量作为类型保留下来，`RedDotEvents.LevelDoneChanged` 的类型是 `'level_done_changed'` 而不是 `string`。后面 `RedDotEventName` 就能精确到这些字面量。
- **字符串和常量名分开**——字段名 `LevelDoneChanged` 是给代码读的（驼峰，好看），字符串 `'level_done_changed'` 是实际派发时用的（下划线，规范）。
- **文件超薄，就是一张表**——读代码的人想知道"项目有哪些红点事件"，看这一个文件就够。

---

### 5.3 升级 `RedDotNodeConfig`：支持 `deps`

**这一步要做什么**：在 `RedDotManager.ts` 里给 `RedDotNodeConfig` 加一个可选字段 `deps`。

> 修改 `assets/src/core/reddot/RedDotManager.ts`

顶部 import 加一行：

```typescript
import { RedDotEventBus } from './RedDotEventBus';
```

把接口升级：

```typescript
export interface RedDotNodeConfig {
    provider?: RedDotProvider;
    deps?: string[];            // ← 新增：依赖的事件名列表
}
```

**关键解读**：

- **类型是 `string[]` 不是 `RedDotEventName[]`**——虽然更严格的类型是 `RedDotEventName[]`，但那会让 `RedDotManager` 强依赖业务层的 `RedDotEvents`。框架代码不应该知道业务事件，所以退一步用 `string[]`，由调用方（Registry）保证传入合法的事件名。这是**依赖方向**的考量。

---

### 5.4 升级 `register`：自动订阅事件

**这一步要做什么**：`register` 拿到 `deps` 之后，把当前路径在 `EventBus` 里注册到每一个事件上。

替换 Stage 3 的 `register`：

```typescript
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
    if (config?.deps) {
        for (const ev of config.deps) {
            RedDotEventBus.instance.subscribe(ev, path);
        }
    }
    return node;
}
```

**关键解读**：

- **`deps` 处理在 provider 之后**——先把"算什么"设好，再把"什么时候算"挂上，顺序自然。
- **幂等保持**：`EventBus.subscribe` 底层是 `Set.add`，重复 register 同一对 `(event, path)` 自动去重。所以 Registry 即使被意外调两次也不会炸。

---

### 5.5 新增 `emit`：事件派发入口

**这一步要做什么**：让 `RedDotManager` 成为"事件派发入口"。业务代码只需要 `RedDotManager.instance.emit(...)`，内部去 EventBus 查订阅者、逐个 refresh。

在 `RedDotManager` 里新增：

```typescript
/** 派发事件：触发所有依赖该事件的节点 refresh。 */
emit(event: string): void {
    const paths = RedDotEventBus.instance.getSubscribedPaths(event);
    for (const p of paths) {
        this.refresh(p);
    }
}
```

**关键解读**：

- **业务的唯一入口就是 `mgr.emit`**——业务代码不用 `import RedDotEventBus`。这让事件总线成为纯**内部细节**，将来想换实现（用项目里的 `Signal`？用 `EventTarget`？）只改 `RedDotManager.emit` 一处。
- **没订阅者时 `paths` 为空数组**，for 循环静默结束——不报错，符合"缺省友好"原则。
- **复用现有 `refresh`**——不是重新写一遍调 provider + 冒泡的逻辑。这是"**一个入口 = 一处改 bug**"的体现。

---

### 5.6 新增 `unregister`：节点销毁 + 事件退订

**这一步要做什么**：Stage 3 没做节点删除，本章补上。动态节点（如邮件）需要这个能力。

在 `RedDotManager` 里新增：

```typescript
/** 销毁节点：从树上摘除 + 退订所有事件 + 让父节点重算。 */
unregister(path: string): void {
    const node = this._nodes.get(path);
    if (!node) return;

    // 1) 退订所有事件
    RedDotEventBus.instance.unsubscribeAll(path);

    // 2) 从父节点的 children 里摘掉
    node.parent?.children.delete(node.segmentKey);

    // 3) 从总 map 里删掉
    this._nodes.delete(path);

    // 4) 冒泡让父节点少掉它原先贡献的 totalCount
    if (node.parent) this._bubble(node.parent);
}
```

**关键解读**：

- **顺序不能乱**：先退订（避免退订时节点已被删）→ 再摘树（避免冒泡看到幽灵子）→ 再删 map → 最后从父节点开始冒泡重算。
- **冒泡从父节点开始**：因为 node 自己已经不在树上了，要让父节点的 `totalCount` 反映"少了一个孩子"的事实。
- **没处理子节点**：如果这个节点**自己有子节点**怎么办？本章先不管（假设调用方自己保证）；Stage 6 的 `unregisterByPrefix` 会做级联删除。

---

### 5.7 升级 `RedDotRegistry`：给关卡加事件依赖

**这一步要做什么**：Registry 里每关卡红点加 `deps`，启动时它们就自动订阅事件。

替换 Stage 3 的 Registry：

```typescript
import { RedDotManager } from './RedDotManager';
import { RedDotEvents } from './RedDotEvents';
import { LevelManifest } from '../../config/LevelManifest';
import { StorageService } from '../../storage/StorageService';

export function registerAllRedDots(): void {
    const mgr = RedDotManager.instance;

    for (const entry of LevelManifest) {
        mgr.register(`home.level.${entry.id}`, {
            provider: () => StorageService.isLevelDone(entry.id) ? 0 : 1,
            deps: [RedDotEvents.LevelDoneChanged],   // ← 新增
        });
    }

    mgr.register('home.level');
    mgr.register('home');

    mgr.refreshAll();
}
```

**关键解读**：

- **相比 Stage 3 只多一行 `deps: [...]`**——这就是事件驱动的"注册成本"。
- **父节点没 deps**——它们的 totalCount 由子节点冒泡带起来，不需要自己订阅事件。

---

### 5.8 升级 `StorageService`：通关时 emit

**这一步要做什么**：在项目已有的 `markLevelDone` 末尾加一行 emit。**业务代码唯一的红点触点**。

> 修改 `assets/src/storage/StorageService.ts`

顶部 import 加两行：

```typescript
import { RedDotManager } from '../core/reddot/RedDotManager';
import { RedDotEvents } from '../core/reddot/RedDotEvents';
```

`markLevelDone` 末尾加一行：

```typescript
static markLevelDone(levelId: string): void {
    const list = this._loadDoneList();
    if (list.includes(levelId)) return;
    list.push(levelId);
    sys.localStorage.setItem(DONE_KEY, JSON.stringify(list));
    RedDotManager.instance.emit(RedDotEvents.LevelDoneChanged);  // ← 新增
}
```

**关键解读**：

- **emit 放在写完 localStorage 之后**——保证 provider 被调时读到的是新值。**这个顺序至关重要**，调换的话 provider 读到旧值、红点不刷新。
- **业务代码里再也不会出现 `mgr.refresh`**——所有 refresh 都走事件路径了。
- **`if (list.includes(levelId)) return` 之后没 emit**——已经标记过就不重复发事件，避免空转。

---

## 6. 完整代码（汇总）

### 6.1 `assets/src/core/reddot/RedDotEventBus.ts`（新增）

```typescript
export class RedDotEventBus {
    private static _instance: RedDotEventBus | null = null;
    static get instance(): RedDotEventBus {
        if (!this._instance) this._instance = new RedDotEventBus();
        return this._instance;
    }

    private _subs: Map<string, Set<string>> = new Map();

    subscribe(event: string, path: string): void {
        let set = this._subs.get(event);
        if (!set) {
            set = new Set();
            this._subs.set(event, set);
        }
        set.add(path);
    }

    unsubscribe(event: string, path: string): void {
        this._subs.get(event)?.delete(path);
    }

    unsubscribeAll(path: string): void {
        this._subs.forEach(set => set.delete(path));
    }

    getSubscribedPaths(event: string): string[] {
        const set = this._subs.get(event);
        return set ? Array.from(set) : [];
    }

    _resetForTest(): void {
        this._subs.clear();
    }
}
```

### 6.2 `assets/src/core/reddot/RedDotEvents.ts`（新增）

```typescript
export const RedDotEvents = {
    LevelDoneChanged: 'level_done_changed',
} as const;

export type RedDotEventName = typeof RedDotEvents[keyof typeof RedDotEvents];
```

### 6.3 `assets/src/core/reddot/RedDotManager.ts`（仅列出 Stage 4 改动的片段）

```typescript
import { RedDotNode, RedDotListener, RedDotProvider } from './RedDotNode';
import { RedDotEventBus } from './RedDotEventBus';

export interface RedDotNodeConfig {
    provider?: RedDotProvider;
    deps?: string[];
}

// register 升级版
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

// 新增：emit
emit(event: string): void {
    const paths = RedDotEventBus.instance.getSubscribedPaths(event);
    for (const p of paths) this.refresh(p);
}

// 新增：unregister
unregister(path: string): void {
    const node = this._nodes.get(path);
    if (!node) return;
    RedDotEventBus.instance.unsubscribeAll(path);
    node.parent?.children.delete(node.segmentKey);
    this._nodes.delete(path);
    if (node.parent) this._bubble(node.parent);
}
```

其他方法（`setSelfCount` / `refresh` / `refreshAll` / `subscribe` / `_callProvider` / `_bubble` / `_parentPath`）保持 Stage 3 的实现不变。

### 6.4 `assets/src/core/reddot/RedDotRegistry.ts`

```typescript
import { RedDotManager } from './RedDotManager';
import { RedDotEvents } from './RedDotEvents';
import { LevelManifest } from '../../config/LevelManifest';
import { StorageService } from '../../storage/StorageService';

export function registerAllRedDots(): void {
    const mgr = RedDotManager.instance;

    for (const entry of LevelManifest) {
        mgr.register(`home.level.${entry.id}`, {
            provider: () => StorageService.isLevelDone(entry.id) ? 0 : 1,
            deps: [RedDotEvents.LevelDoneChanged],
        });
    }

    mgr.register('home.level');
    mgr.register('home');

    mgr.refreshAll();
}
```

### 6.5 `assets/src/storage/StorageService.ts`（仅改动片段）

```typescript
import { RedDotManager } from '../core/reddot/RedDotManager';
import { RedDotEvents } from '../core/reddot/RedDotEvents';

static markLevelDone(levelId: string): void {
    const list = this._loadDoneList();
    if (list.includes(levelId)) return;
    list.push(levelId);
    sys.localStorage.setItem(DONE_KEY, JSON.stringify(list));
    RedDotManager.instance.emit(RedDotEvents.LevelDoneChanged);
}
```

---

## 7. 怎么用（示例）

### 7.1 全链路回看

```
玩家点击 LevelCard
  ↓
HomePage.onClickLevelCard(entry)   —— 业务代码
  ↓
通关后：StorageService.markLevelDone(id)
  ├─ 写 localStorage
  └─ emit('level_done_changed')   —— 业务唯一的红点触点
       ↓
RedDotEventBus.getSubscribedPaths('level_done_changed')
  → ['home.level.apple', 'home.level.mountain', ...]
       ↓
RedDotManager.refresh(path) × N
  ├─ 调 provider 重算 selfCount
  ├─ 冒泡到 home.level、home
  └─ 通知订阅 UI（LevelCard、首页 Tab 按钮）
       ↓
RedDotView.setCount(新值)
```

### 7.2 未来扩展轻松到什么程度

假设产品说：**"后端推送解锁新关卡时，红点也要亮起来"**。

你只需要在收到后端推送的地方加一行：

```typescript
// BackendPushHandler.ts
onNewLevelUnlocked(levelId: string) {
    LevelManifest.push(/* ... */);
    RedDotManager.instance.emit(RedDotEvents.LevelDoneChanged);
}
```

**整个红点系统、UI 组件、Registry 都不改一个字**。这就是事件驱动的威力。

---

## 8. 验证清单

- [ ] 注册带 `deps: [RedDotEvents.LevelDoneChanged]` 的节点后，`mgr.emit(RedDotEvents.LevelDoneChanged)` 会触发该节点的 provider 被调用
- [ ] 同一事件被多个节点依赖 → emit 一次，N 个节点都 refresh
- [ ] 事件没有任何订阅者时 emit → 静默返回，不报错
- [ ] `unregister(path)` 后再 emit 相关事件 → 该路径不参与刷新，其他正常
- [ ] 业务代码里 grep 不到 `RedDotManager.instance.refresh` —— 所有 refresh 调用都由事件路径触发
- [ ] 重复订阅同一对 `(event, path)` 不会导致该节点被 refresh 两次（`Set` 去重生效）
- [ ] `StorageService.markLevelDone` 调用后，订阅了 `home.level.xxx` 的 UI 立刻收到新值

---

## 9. 这阶段的局限 → 下一阶段解决

现在一切都"对"了，但还不够"快"：

> **玩家一帧内涂了 30 格，每格都 emit 一次 `paint_changed`，每次都会 refresh 所有依赖节点、一路冒泡、一路通知 UI。**

30 次 refresh、30 次 UI 更新。**99% 是浪费的**——最终的显示结果只取决于最后一次。

一帧内合并刷新、一次 UI 更新 = **脏标记 + 批量 flush**。

继续看 [`05-dirty-flush.md`](./05-dirty-flush.md)。
