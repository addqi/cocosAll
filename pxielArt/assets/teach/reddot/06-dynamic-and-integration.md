# Stage 6 — 动态节点 + 实战接入

> **这一阶段结束**：红点系统支持**运行时动态增删节点**；并且你会在真实项目中**加一个关卡红点**，端到端跑通。
> **前置**：完成 [Stage 5](./05-dirty-flush.md)。

---

## 1. 要解决什么问题

### 1.1 动态节点

前 5 阶段假设节点都在启动时静态声明。现实中：

- **邮件**：玩家有几封邮件？运行时才知道。收到一封建一个 `home.mail.m42`
- **好友**：好友数量随加/删变化
- **任务**：每日任务一天一换

**这些节点的数量和 id 都在运行时才能确定**，启动时注册完了事这套 Registry 模式会失效。

### 1.2 实战接入

理论是死的。我们要真的在这个项目里加一个红点：

> **需求**：在关卡选择页面，玩家**没点过**的关卡卡片上显示一个小红点。点一次后消失。

这是之前和你讨论的那个真实需求。现在用工业级红点系统把它实现一次。

---

## 2. 动态节点：Linus 式三连问

### 🟢 数据结构

动态节点本质上和静态节点**没有区别**，都是树上的一个节点。差别只在**何时注册/注销**。

我们已经有的能力（Stage 4）：
- `register(path, config)` 幂等
- `unregister(path)` 清理订阅和子节点

只需要**补一块**：动态节点的 UI 通常和节点生命周期绑定，需要一个"UI 节点销毁时自动反订阅"的帮手。

### 🟡 特殊情况

| 情况 | 糟糕设计 | 好设计 |
|------|---------|--------|
| UI 被销毁但没反订阅 | 内存泄漏 + listener 回调进已死对象 | 提供 `RedDotBinder` 组件，挂在 UI 节点上，`onDestroy` 自动退订 |
| 注销节点，它的子节点怎么办 | 子节点变成孤儿 | `unregister` 级联：把所有 `path` 以它为前缀的节点都清掉 |
| 批量注销（清邮件列表） | 一个个 `unregister` | 提供 `unregisterByPrefix(prefix)` |

### 🔴 复杂度

绑定器 `RedDotBinder` 是个 20 行的 Component。级联注销用前缀匹配，一个 `startsWith` 搞定。

---

## 3. 设计方案

### 3.1 新增 `unregisterByPrefix`

```typescript
unregisterByPrefix(prefix: string): void {
    // 找到所有以 prefix 开头的路径
    const toRemove: string[] = [];
    this._nodes.forEach((_, path) => {
        if (path === prefix || path.startsWith(prefix + '.')) toRemove.push(path);
    });
    // 从叶子往根删（避免父节点先被删导致子节点孤立冒泡）
    toRemove.sort((a, b) => b.length - a.length);
    for (const p of toRemove) this.unregister(p);
}
```

### 3.2 新增 `RedDotBinder` 组件

挂在任何 UI 节点上，自动完成"订阅 + 销毁时反订阅"：

```typescript
import { _decorator, Component } from 'cc';
import { RedDotManager } from './RedDotManager';
import { RedDotView } from './RedDotView';

const { ccclass, property } = _decorator;

@ccclass('RedDotBinder')
export class RedDotBinder extends Component {
    @property
    path: string = '';

    private _unsub: (() => void) | null = null;
    private _view: RedDotView | null = null;

    onLoad(): void {
        this._view = this.getComponent(RedDotView);
        if (!this._view) this._view = this.addComponent(RedDotView);
    }

    start(): void {
        if (!this.path) return;
        this._unsub = RedDotManager.instance.subscribe(this.path, (n) => {
            this._view?.setCount(n);
        });
    }

    onDestroy(): void {
        this._unsub?.();
        this._unsub = null;
    }

    /** 代码里动态改路径（如切换选中项） */
    setPath(path: string): void {
        this.path = path;
        this._unsub?.();
        if (path) {
            this._unsub = RedDotManager.instance.subscribe(path, (n) => {
                this._view?.setCount(n);
            });
        }
    }
}
```

**用法**：任何需要红点的 UI 节点：
1. 添加空子节点 `RedDot`
2. 挂 `RedDotView` + `RedDotBinder`
3. 设 `path = 'home.level.l1'`
即可。

### 3.3 动态节点的注册/注销模板

```typescript
// MailManager.ts
class MailManager {
    onReceiveMail(mail: Mail) {
        this._mails.push(mail);
        // 动态注册节点
        RedDotManager.instance.register(`home.mail.${mail.id}`, {
            provider: () => mail.isRead ? 0 : 1,
            deps: [RedDotEvents.MailUnreadChanged],
        });
        RedDotManager.instance.emit(RedDotEvents.MailUnreadChanged);
    }

    onDeleteMail(mailId: string) {
        this._mails = this._mails.filter(m => m.id !== mailId);
        RedDotManager.instance.unregister(`home.mail.${mailId}`);
    }

    onClearAllMails() {
        this._mails = [];
        // 一次性干掉所有邮件节点，不影响兄弟 'home.chat.*'
        RedDotManager.instance.unregisterByPrefix('home.mail');
    }
}
```

---

## 4. 实战：给关卡选择加红点

准备好了，开始真正的改造。这里我假设前 5 阶段的代码（`RedDotNode` / `RedDotManager` / `RedDotEventBus` / `RedDotEvents` / `RedDotView` / `RedDotBinder` / `RedDotRegistry`）你已经在 `assets/src/core/reddot/` 里写好。

### 4.1 项目改动清单（一共 5 处）

| # | 文件 | 改什么 |
|---|------|-------|
| 1 | `assets/src/storage/StorageService.ts` | 新增 `markLevelSeen` / `isLevelSeen`；在 `markLevelSeen` 里 emit 事件 |
| 2 | `assets/src/core/reddot/RedDotEvents.ts` | 增加 `LevelSeenChanged` 常量 |
| 3 | `assets/src/core/reddot/RedDotRegistry.ts` | 为每个关卡注册红点节点 |
| 4 | `assets/src/LaunchRoot.ts` | 启动时调 `registerAllRedDots()` |
| 5 | `assets/src/ui/home/LevelCard.ts` + `HomePage.ts` | 在卡片上画红点；点击时 markLevelSeen |

### 4.2 改动 1：`StorageService`

参考现有代码风格（Stage 1 那篇讨论已经给过一版，这里补上事件 emit）：

```typescript
// StorageService.ts 顶部
const SEEN_KEY = 'pa_seen';

// 新增方法（放在"关卡完成"那段下面）
static markLevelSeen(levelId: string): void {
    const list = this._loadSeenList();
    if (list.includes(levelId)) return;
    list.push(levelId);
    sys.localStorage.setItem(SEEN_KEY, JSON.stringify(list));
    RedDotManager.instance.emit(RedDotEvents.LevelSeenChanged);
}

static isLevelSeen(levelId: string): boolean {
    return this._loadSeenList().includes(levelId);
}

private static _loadSeenList(): string[] {
    const raw = sys.localStorage.getItem(SEEN_KEY);
    if (!raw) return [];
    try {
        const list = JSON.parse(raw);
        return Array.isArray(list) ? list : [];
    } catch { return []; }
}
```

> **注意 StorageService 是否能 import 红点系统？**
> 在本项目的分层里可以：red dot 是核心通用设施，storage 在其上层调用是合理的。
> 如果你介意 storage 反过来 import 红点，可改为：storage 不 emit，`HomePage` 调用处 emit。**但不推荐**，那会把事件触发点散落到各业务页面，违反 Stage 4 的集中原则。

### 4.3 改动 2：`RedDotEvents.ts`

在常量表加一行：

```typescript
export const RedDotEvents = {
    LevelSeenChanged: 'level_seen_changed',
    // 其他事件 ...
} as const;
```

### 4.4 改动 3：`RedDotRegistry.ts`

这是关键：**哪里有红点 ← 看这个文件就够**。

```typescript
import { RedDotManager } from './RedDotManager';
import { RedDotEvents } from './RedDotEvents';
import { LevelManifest } from '../../config/LevelManifest';
import { StorageService } from '../../storage/StorageService';

export function registerAllRedDots(): void {
    const mgr = RedDotManager.instance;

    // —— 父节点占位 —— 
    mgr.register('home');
    mgr.register('home.level');

    // —— 每关一个叶子 —— 
    for (const entry of LevelManifest) {
        mgr.register(`home.level.${entry.id}`, {
            provider: () => StorageService.isLevelSeen(entry.id) ? 0 : 1,
            deps: [RedDotEvents.LevelSeenChanged],
        });
    }

    // —— 老玩家迁移：已完成或有进度的关卡视为"已见过" —— 
    for (const entry of LevelManifest) {
        if (StorageService.isLevelDone(entry.id) || StorageService.hasPaintRecord(entry.id)) {
            StorageService.markLevelSeen(entry.id);  // 内部会 emit 一次，没关系，都是脏标合并
        }
    }

    mgr.refreshAll();
}
```

> **为什么老玩家迁移放在这？**
> 因为它属于"系统一次性初始化"的语义，和启动注册一起做最自然。放在 `StorageService` 里反而耦合。

### 4.5 改动 4：`LaunchRoot`

启动时调一次：

```typescript
import { registerAllRedDots } from './core/reddot/RedDotRegistry';

// LaunchRoot.start() 里合适的位置
registerAllRedDots();
```

### 4.6 改动 5：`LevelCard` + `HomePage`

参考项目里已有的 `_addStatusBadge` 风格，在 `LevelCard.create` 里加一个红点子节点：

```typescript
// LevelCard.ts
static create(
    entry: LevelEntry,                    // ← 建议直接传 entry，拿到 id
    previewFrame: SpriteFrame | null,
    onClick: () => void,
    status: LevelStatus = 'new',
    style: Partial<LevelCardStyle> = {},
): Node {
    const s = { ...DEFAULT_STYLE, ...style };
    const root = new Node(`LevelCard_${entry.name}`);
    // ... 背景、预览图、名字、状态徽章 ...（保持原有代码）

    // —— Stage 6 新增：红点绑定 —— 
    const dotHost = new Node('RedDot');
    root.addChild(dotHost);
    dotHost.setPosition(-s.width / 2 + 20, s.height / 2 - 20, 0);  // 左上角
    dotHost.addComponent(UITransform);
    const binder = dotHost.addComponent(RedDotBinder);
    binder.setPath(`home.level.${entry.id}`);

    // ... button 等 ...
    return root;
}
```

然后 `HomePage` 点击时调 `markLevelSeen`（**业务代码不碰红点**）：

```typescript
// HomePage._loadAllLevels() 里创建 card 时
const card = LevelCard.create(
    entry, previewSF,
    () => {
        StorageService.markLevelSeen(entry.id);   // ← 业务侧唯一的一行
        this._showLevelDetail(entry, previewSF);
    },
    status,
);
```

就这样。**整个改造结束**。

### 4.7 数据流回看

```
玩家点击关卡卡片
 └─ HomePage onClick
     └─ StorageService.markLevelSeen(id)
         ├─ 写 localStorage
         └─ RedDotManager.emit('level_seen_changed')
             └─ RedDotEventBus 找到依赖此事件的节点：'home.level.<id>'
                 └─ 标记脏，schedule flush
                     └─ 微任务 flush：
                         ├─ 调 provider() → 读 localStorage → 返回 0
                         ├─ 冒泡：home.level / home 的 totalCount 减 1
                         └─ 通知 listeners：
                             ├─ LevelCard 的 RedDotBinder → RedDotView.setCount(0) → 隐藏
                             └─ （若未来首页有 Tab 按钮）也自动减 1
```

---

## 5. 验证清单

### 5.1 功能验证

- [ ] 首次进入首页 → 所有未完成/未玩过的关卡都有红点
- [ ] 点一个关卡进入游戏 → 返回后该卡**红点消失**
- [ ] 别的卡片红点**不受影响**
- [ ] 老玩家（已有 pa_rec_apple 这样的存档）→ 升级进入后 apple 卡片**无红点**（迁移生效）
- [ ] 清除 localStorage 里的 `pa_seen` → 所有非完成关卡重新亮红点
- [ ] 切换关卡→返回→切换关卡：红点刷新流畅，无错位

### 5.2 工业级特性验证

- [ ] 一次性 markLevelSeen 连续调 10 次（比如脚本批量标记）→ provider 只被调 1 次
- [ ] 在 Chrome DevTools 的 Application → Local Storage，只看到 `pa_seen` 一个新 key
- [ ] 业务代码全局搜 `RedDotManager.instance.refresh` → 应搜不到（只有 Registry 和内部 emit）
- [ ] 业务代码全局搜 `setSelfCount` → 应搜不到（provider 模式完全替代）

---

## 6. 接下来可能的扩展

系统做到这个程度，后续新需求都是**小改动**：

| 新需求 | 改动量 |
|--------|-------|
| 首页 Tab 按钮也要红点汇总 | 在 Tab 按钮 UI 上挂 RedDotBinder，path=`home.level` |
| 红点外观换成 PNG 九宫格 | 只改 RedDotView._applyStyle，挂 SpriteFrame |
| 有些玩家不显示红点（引导期） | 在 RedDotBinder 订阅回调里加 `if (Guide.isFinished)` |
| 后端推送解锁新关卡 | 动态 `register` + emit `LevelSeenChanged` |
| 活动中心红点 | 新建 `activity.*` 子树；复用所有机制 |

**每个需求都是单点改动，系统骨架不动**。这就是工业级架构的价值。

---

## 7. 恭喜你

从零到一搭完了一个工业级红点系统。回顾一下你掌握的能力：

- ✅ **分层设计**：UI / 数据 / 算法 分离
- ✅ **树形数据结构 + 冒泡算法**
- ✅ **Provider 模式**：把"怎么算"交给系统
- ✅ **集中注册**：所有红点一处声明
- ✅ **事件驱动**：N + M 耦合代替 N × M
- ✅ **脏标记 + 批量刷新**：正确性和性能兼得
- ✅ **动态生命周期**：Binder 自动管订阅
- ✅ **实战接入**：真项目里跑起来

这套思路不止适用于红点，**任何"派生状态 + 多源更新 + 多处订阅"的系统都适用**：
- 任务进度
- 成就系统
- 资源库存聚合
- 计分板

用 Linus 的话结尾：

> **"好的代码没有特殊情况。好的架构，每加一个新需求都是加法，不是乘法。"**

红点系统教会你的就是这件事。

---

*完。回到总览：[`00-overview.md`](./00-overview.md)*
