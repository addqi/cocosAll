# Stage 4 — 事件驱动

> **这一阶段结束，你会得到**：业务代码**彻底不知道红点存在**。业务只发事件，红点自己订阅、自己 refresh、自己冒泡。
> **关键升级**：Stage 3 的 `refresh(path)` 调用退出业务代码，改由红点系统内部响应事件自动触发。
> **前置**：完成 [Stage 3](./03-provider-registry.md)。

---

## 1. 要解决什么问题

Stage 3 把红点逻辑集中了，但业务代码里还有这一行：

```typescript
StorageService.markLevelSeen(entry.id);
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

## 2. Linus 式三连问

### 🟢 数据结构

新增一个事件名 → 依赖该事件的节点列表 的映射：

```typescript
class RedDotEventBus {
    // 事件名 → 依赖此事件的节点路径集合
    private _subs: Map<string, Set<string>> = new Map();
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

事件总线 50 行足矣。**不要引入外部库**（RxJS / mitt / EventEmitter3），你只需要「发、订、退订」三个方法。

---

## 3. 设计方案

### 3.1 三个模块的协作

```
┌──────────────┐  emit('level_seen_changed')   ┌─────────────────┐
│   业务代码    │ ───────────────────────────► │ RedDotEventBus  │
│ StorageService│                              └────────┬────────┘
└──────────────┘                                       │
                                                       │ 查表
                                                       ▼
                                   依赖此事件的节点路径：
                                   ['home.level.l1', 'home.level.l2', ...]
                                                       │
                                                       │ 逐个 refresh
                                                       ▼
                                              ┌─────────────────┐
                                              │ RedDotManager   │
                                              │ (冒泡 + 通知)   │
                                              └─────────────────┘
```

**关键：业务代码 `StorageService` 不知道 `RedDotManager` 的存在，也不 import 它**。
它只知道"我改了 seen 列表，我要吼一嗓子"。

### 3.2 API 形态

**注册时声明依赖：**

```typescript
mgr.register('home.level.l1', {
    provider: () => StorageService.isLevelSeen('l1') ? 0 : 1,
    deps: ['level_seen_changed'],   // ← 关心这个事件
});
```

**业务代码发事件（取代原先的 refresh 调用）：**

```typescript
class StorageService {
    static markLevelSeen(levelId: string): void {
        // 原有写入逻辑 ...
        RedDotEventBus.instance.emit('level_seen_changed');  // ← 取代 refresh
    }
}
```

**红点系统内部自动响应：**
`RedDotEventBus` 收到 `'level_seen_changed'` → 查表找到所有依赖它的节点 → 逐个调 `mgr.refresh(path)` → 冒泡完成。

### 3.3 事件命名规范（强约束）

| 好 | 坏 | 原因 |
|---|---|------|
| `level_seen_changed` | `level_clicked` | 事件名描述**数据变化**，不描述动作。动作可能有多种（点击、后端推、自动解锁）都会改数据，不该用动作命名 |
| `mail_unread_changed` | `update_mail` | "update" 什么意思？改了已读状态？还是收了新邮件？含义模糊 |
| `tool_count_changed` | `on_refill` | 补充是动作之一；扣减也得发事件。统一用 `changed` |

**规则：`<数据域>_<状态>_changed`**

为什么重要？系统大了有几十上百个事件，命名不统一你会疯掉。

### 3.4 事件名集中管理

不要散字符串：

```typescript
// RedDotEvents.ts
export const RedDotEvents = {
    LevelSeenChanged: 'level_seen_changed',
    MailUnreadChanged: 'mail_unread_changed',
    ToolCountChanged: 'tool_count_changed',
} as const;
```

业务和红点清单都从这里引用，改名时编译器会帮你找到所有使用点。

---

## 4. 完整代码

### 4.1 新增 `RedDotEventBus.ts`

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

    /** 注销：把 path 从 event 的订阅列表移除 */
    unsubscribe(event: string, path: string): void {
        this._subs.get(event)?.delete(path);
    }

    /** 注销一个 path 的所有订阅（节点销毁时用） */
    unsubscribeAll(path: string): void {
        this._subs.forEach(set => set.delete(path));
    }

    /** 派发事件：返回受影响的节点路径列表（由 Manager 逐个 refresh） */
    getSubscribedPaths(event: string): string[] {
        const set = this._subs.get(event);
        return set ? Array.from(set) : [];
    }

    _resetForTest(): void {
        this._subs.clear();
    }
}
```

> **注意**：`RedDotEventBus` **不直接调 `mgr.refresh`**，它只回答"谁订阅了这个事件"。真正的 emit 在 `RedDotManager.emit` 里。
> 为什么分开？**单一职责**：EventBus 只管订阅关系，Manager 管树和刷新。便于单测。

### 4.2 升级 `RedDotManager.ts`

在 Stage 3 基础上增加：

```typescript
// 新增方法
emit(event: string): void {
    const paths = RedDotEventBus.instance.getSubscribedPaths(event);
    for (const p of paths) this.refresh(p);
}

// 升级 register：支持 deps
register(path: string, config?: RedDotNodeConfig): RedDotNode {
    // ... 原有建节点逻辑 ...

    if (config?.provider !== undefined) node.provider = config.provider;

    if (config?.deps) {
        for (const ev of config.deps) {
            RedDotEventBus.instance.subscribe(ev, path);
        }
    }
    return node;
}

// 新增：销毁节点时清理订阅
unregister(path: string): void {
    const node = this._nodes.get(path);
    if (!node) return;
    RedDotEventBus.instance.unsubscribeAll(path);
    node.parent?.children.delete(node.segmentKey);
    this._nodes.delete(path);
    // 冒泡让父节点少掉这部分 total
    if (node.parent) this._bubble(node.parent);
}
```

`RedDotNodeConfig` 升级：

```typescript
export interface RedDotNodeConfig {
    provider?: RedDotProvider;
    deps?: string[];            // ← 新增
}
```

### 4.3 新增 `RedDotEvents.ts`（常量表）

```typescript
export const RedDotEvents = {
    LevelSeenChanged: 'level_seen_changed',
    MailUnreadChanged: 'mail_unread_changed',
    ToolCountChanged: 'tool_count_changed',
} as const;

export type RedDotEventName = typeof RedDotEvents[keyof typeof RedDotEvents];
```

### 4.4 更新 `RedDotRegistry.ts`

```typescript
export function registerAllRedDots(): void {
    const mgr = RedDotManager.instance;

    for (const entry of LevelManifest) {
        mgr.register(`home.level.${entry.id}`, {
            provider: () => StorageService.isLevelSeen(entry.id) ? 0 : 1,
            deps: [RedDotEvents.LevelSeenChanged],
        });
    }

    mgr.register('home.level');
    mgr.register('home');
    mgr.refreshAll();
}
```

### 4.5 业务代码的改造

```typescript
// StorageService.ts
import { RedDotManager } from '../core/reddot/RedDotManager';
import { RedDotEvents } from '../core/reddot/RedDotEvents';

static markLevelSeen(levelId: string): void {
    const list = this._loadSeenList();
    if (list.includes(levelId)) return;
    list.push(levelId);
    sys.localStorage.setItem(SEEN_KEY, JSON.stringify(list));
    RedDotManager.instance.emit(RedDotEvents.LevelSeenChanged);  // ← 一行即可
}
```

好了，**`HomePage` / `LevelCard` 里再也没有一行红点代码**。业务代码的唯一红点接触点是 `StorageService` 里的一行 emit。

---

## 5. 怎么用（示例）

### 5.1 全链路回看

```
玩家点击 LevelCard
  ↓
HomePage.onClickLevelCard(entry)   —— 业务代码
  ↓
StorageService.markLevelSeen(id)
  ├─ 写 localStorage
  └─ emit('level_seen_changed')   —— 业务唯一的红点触点
       ↓
RedDotEventBus.getSubscribedPaths('level_seen_changed')
  → ['home.level.l1', 'home.level.l2', ...]
       ↓
RedDotManager.refresh(path) × N
  ├─ 调 provider 重算 selfCount
  ├─ 冒泡到 home.level、home
  └─ 通知订阅 UI（LevelCard、首页 Tab 按钮）
       ↓
RedDotView.setCount(新值)
```

### 5.2 未来扩展轻松到什么程度

假设产品说：**"后端推送解锁新关卡时，红点也要亮起来"**。

你只需要在收到后端推送的地方加一行：

```typescript
// BackendPushHandler.ts
onNewLevelUnlocked(levelId: string) {
    LevelManifest.push(...);
    RedDotManager.instance.emit(RedDotEvents.LevelSeenChanged);
}
```

**整个红点系统、UI 组件、Registry 都不改一个字**。这就是事件驱动的威力。

---

## 6. 验证清单

- [ ] 注册带 `deps: ['level_seen_changed']` 的节点后，`mgr.emit('level_seen_changed')` 会触发该节点的 provider 被调用
- [ ] 同一事件被多个节点依赖 → emit 一次，N 个节点都 refresh
- [ ] 事件没有任何订阅者时 emit → 静默返回，不报错
- [ ] `unregister(path)` 后再 emit 相关事件 → 该路径不参与刷新，其他正常
- [ ] 业务代码里 grep 不到 `RedDotManager.instance.refresh` —— 所有 refresh 调用都由事件路径触发
- [ ] 重复订阅同一对 `(event, path)` 不会导致该节点被 refresh 两次（`Set` 去重生效）

---

## 7. 这阶段的局限 → 下一阶段解决

现在一切都"对"了，但还不够"快"：

> **玩家一帧内涂了 30 格，每格都 emit 一次 `paint_changed`，每次都会 refresh 所有依赖节点、一路冒泡、一路通知 UI。**

30 次 refresh、30 次 UI 更新。**99% 是浪费的**——最终的显示结果只取决于最后一次。

一帧内合并刷新、一次 UI 更新 = **脏标记 + 批量 flush**。

继续看 [`05-dirty-flush.md`](./05-dirty-flush.md)。
