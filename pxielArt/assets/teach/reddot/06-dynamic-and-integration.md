# Stage 6 — 动态节点 + 实战接入

> **这一阶段结束**：红点系统支持**运行时动态增删节点**；并且你会在真实项目中**加一个关卡红点**，端到端跑通。
> **需求**：关卡选择页面，玩家**还没通关**的卡片上显示一个小红点；通关后红点消失。
> **代码量**：约 40 行新增（组件 + 级联删除）+ 5 处业务接入。
> **前置**：完成 [Stage 5](./05-dirty-flush.md)。

---

## 1. 要解决什么问题

### 1.1 动态节点

前 5 阶段假设节点都在启动时静态声明。现实中：

- **邮件**：玩家有几封邮件？运行时才知道。收到一封建一个 `home.mail.m42`
- **好友**：好友数量随加/删变化
- **任务**：每日任务一天一换

**这些节点的数量和 id 都在运行时才能确定**，启动时注册完了事的 Registry 模式在这种场景下不够。需要运行时的 `register / unregister / unregisterByPrefix`。

### 1.2 实战接入

理论是死的，要在真项目里跑一遍才算学会。目标：

> **在关卡选择页面，玩家还没通关的关卡卡片上显示一个小红点。通关后红点消失。**

业务语义基于已有的 `StorageService.isLevelDone(id)`——不引入新存档字段。

---

## 2. 本章要新增/修改哪些脚本

> 先看全景。本章分两块：**A. 框架增强**（2 个文件） + **B. 业务接入**（5 处改动）。

### 2.1 A. 框架增强

| 文件 | 操作 | 职责 | 代码量 |
|------|------|------|-------|
| `RedDotManager.ts` | **升级** | 新增 `unregisterByPrefix(prefix)`，级联删除子树 | +10 行 |
| `RedDotBinder.ts` | **新增** | UI 组件：挂在节点上自动订阅 path → 反映到同节点 `RedDotView`，销毁时自动退订 | ~40 行 |

### 2.2 B. 业务接入

| # | 文件 | 操作 |
|---|------|------|
| 1 | `RedDotEvents.ts` | 复用已有 `LevelDoneChanged`（Stage 4 已加，不动） |
| 2 | `RedDotRegistry.ts` | 每关卡注册一个叶子节点（Stage 4 已写，本章仅回顾） |
| 3 | `LaunchRoot.ts` | 启动时调 `registerAllRedDots()` |
| 4 | `LevelCard.ts` | 升级 `create` 签名接 `entry`，内部挂 `RedDotView + RedDotBinder` |
| 5 | `HomePage.ts` | 调用处传 `entry`，其它不改 |

### 2.3 骨架预览

**`RedDotManager.ts`**（新增一个方法）：

```typescript
class RedDotManager {
    // ... Stage 5 所有内容 ...

    unregisterByPrefix(prefix: string): void  // 级联删除 path === prefix 或 path.startsWith(prefix + '.')
}
```

**`RedDotBinder.ts`**（新文件，约 40 行）：

```typescript
@ccclass('RedDotBinder')
export class RedDotBinder extends Component {
    @property path: string;

    onLoad(): void { /* 确保同节点有 RedDotView */ }
    start(): void  { /* 订阅 path → RedDotView.setCount */ }
    onDestroy(): void { /* 自动退订 */ }

    setPath(path: string): void { /* 代码里动态改路径 */ }
}
```

**`LevelCard.ts`** 签名升级：

```typescript
// 升级前：static create(name: string, ...)
// 升级后：static create(entry: LevelEntry, ...)   // 能拿到 entry.id
```

### 2.4 数据流全景

```
启动
 └─ LaunchRoot.start
     └─ registerAllRedDots()
         ├─ 为每个 LevelManifest 条目注册 home.level.<id>
         │   provider = () => isLevelDone(id) ? 0 : 1
         │   deps     = [LevelDoneChanged]
         └─ refreshAll() 同步 flush

渲染首页
 └─ HomePage 创建 LevelCard (for each entry)
     └─ LevelCard.create 内部
         └─ 建 RedDot 子节点 + RedDotView + RedDotBinder(path = 'home.level.<id>')
             └─ Binder.start 订阅 → RedDotView 立刻显示当前值

玩家通关
 └─ GamePage 里 StorageService.markLevelDone(id)
     ├─ 写 localStorage
     └─ emit(LevelDoneChanged)
         └─ RedDotManager._markDirty(home.level.<id>)
             └─ 微任务 flush
                 ├─ 调 provider → 1 变 0
                 ├─ 冒泡 home.level / home → totalCount 减 1
                 └─ 通知 listeners
                     └─ RedDotBinder → RedDotView.setCount(0) → 自动隐藏
```

---

## 3. 动态节点：Linus 式三连问

### 🟢 数据结构

动态节点本质上和静态节点**没有区别**，都是树上的一个节点。差别只在**何时注册/注销**。

我们已经有的能力（Stage 4）：
- `register(path, config)` 幂等
- `unregister(path)` 清理订阅和从父节点摘除

只需要**补一块**：
1. **级联删除**：邮件清空时，一口气删 `home.mail` 下所有子节点
2. **UI 生命周期绑定**：Cocos Node 销毁时自动退订，避免泄漏

### 🟡 特殊情况

| 情况 | 糟糕设计 | 好设计 |
|------|---------|--------|
| UI 被销毁但没反订阅 | 内存泄漏 + listener 回调进已死对象 | 提供 `RedDotBinder` 组件，`onDestroy` 自动退订 |
| 注销节点，它的子节点怎么办 | 子节点变成孤儿，冒泡到空父节点 | 提供 `unregisterByPrefix(prefix)` 级联删除 |
| 动态改 path（列表切换选中项） | 销毁组件重建？太重 | `Binder.setPath` 先退旧订阅再订新 path |

### 🔴 复杂度

绑定器 `RedDotBinder` 是个 ~40 行的 Component。级联注销用前缀匹配，`String.startsWith` 一行搞定。

---

## 4. 分步实现（A 部分：框架增强）

### 4.1 升级 `RedDotManager`：新增 `unregisterByPrefix`

**这一步要做什么**：给 Manager 加一个"批量删除子树"的方法。应用场景：一键清空邮件、关掉活动。

> 修改 `assets/src/core/reddot/RedDotManager.ts`

在 `unregister` 下方加：

```typescript
/**
 * 级联删除：所有 path === prefix 或 path 以 prefix + '.' 开头的节点。
 * 从深到浅删，保证父节点在子节点之后被冒泡到。
 */
unregisterByPrefix(prefix: string): void {
    const toRemove: string[] = [];
    this._nodes.forEach((_, path) => {
        if (path === prefix || path.startsWith(prefix + '.')) {
            toRemove.push(path);
        }
    });
    toRemove.sort((a, b) => b.length - a.length);
    for (const p of toRemove) this.unregister(p);
}
```

**关键解读**：

- **`path === prefix || path.startsWith(prefix + '.')`** 不能写成 `path.startsWith(prefix)`——否则 `home.level` 会匹配 `home.levelBonus`，那不是子树关系。**多这个 `'.'` 是边界区分**。
- **`sort((a, b) => b.length - a.length)`**——字符串越长层级越深。从深到浅删，确保删一个叶子时它父亲还在、冒泡能正确跑；等父亲被删时它已经没有多余子节点了。
- **复用现有 `unregister`**——不另起炉灶。每个 `unregister` 都会冒泡到其父节点，整棵子树最终都得到正确的 totalCount 修正。

---

### 4.2 新建 `RedDotBinder`：UI 组件自动绑定

**这一步要做什么**：写一个 Cocos Component，挂在任何 UI 节点上，自动完成：
- `onLoad`：确保同节点有 `RedDotView`
- `start`：根据 `path` 订阅，数值变化自动反映到 `RedDotView`
- `onDestroy`：自动退订，**解决内存泄漏 + 幽灵 listener 问题**

> 新建 `assets/src/core/reddot/RedDotBinder.ts`

```typescript
import { _decorator, Component } from 'cc';
import { RedDotManager } from './RedDotManager';
import { RedDotView } from './RedDotView';

const { ccclass, property } = _decorator;

@ccclass('RedDotBinder')
export class RedDotBinder extends Component {

    /** 要订阅的红点 path（在编辑器里填，或代码里 setPath 改） */
    @property
    path: string = '';

    private _unsub: (() => void) | null = null;
    private _view: RedDotView | null = null;

    onLoad(): void {
        this._view = this.getComponent(RedDotView) ?? this.addComponent(RedDotView);
    }

    start(): void {
        if (this.path) this._bind(this.path);
    }

    onDestroy(): void {
        this._unsub?.();
        this._unsub = null;
    }

    /** 代码里动态切 path（比如选中项变化） */
    setPath(path: string): void {
        this.path = path;
        this._unsub?.();
        this._unsub = null;
        if (path && this._view) this._bind(path);
    }

    private _bind(path: string): void {
        this._unsub = RedDotManager.instance.subscribe(path, (n) => {
            this._view?.setCount(n);
        });
    }
}
```

**关键解读**：

- **`onLoad` 里用 `??` 兜底 getComponent**——允许调用方预先挂好 `RedDotView` 调样式；没挂也能自动补一个。**不强求使用方式**。
- **`start` 里才真正订阅**——onLoad 只是补组件，订阅要等 `path` 确定（编辑器填的或 `setPath` 调过）。
- **`subscribe` 回调里用 `this._view?.`** 而不是 `this._view!.`——`onDestroy` 后回调可能还在微任务里跑（虽然 `_unsub` 会删 listener，但 Stage 5 的 flush 已经快照过 listener），防御性编程。
- **`setPath` 先 unsub 再 sub**——允许运行时改 path。场景：关卡选择列表里选中项切换、同一张 UI 挂不同红点。
- **故意不做的事情**：
  - 不读 `RedDotView` 的样式 @property（让 `RedDotView` 自己管）
  - 不提供 `refresh()` 方法（系统自动驱动，别给业务侧逃避事件的入口）

---

## 5. 分步实现（B 部分：实战接入）

> 目标：让关卡卡片自动根据 `isLevelDone` 显示红点，通关后消失。

### 5.1 回顾 Stage 4 已经完成的部分

`RedDotEvents.ts` 里有 `LevelDoneChanged`，`RedDotRegistry.ts` 为每关卡注册了节点，`StorageService.markLevelDone` 末尾 emit 事件——**这些 Stage 4 全都做好了**。本章不动。

```typescript
// RedDotRegistry.ts（Stage 4 成品，本章无改动）
for (const entry of LevelManifest) {
    mgr.register(`home.level.${entry.id}`, {
        provider: () => StorageService.isLevelDone(entry.id) ? 0 : 1,
        deps: [RedDotEvents.LevelDoneChanged],
    });
}
mgr.register('home.level');
mgr.register('home');
mgr.refreshAll();
```

语义：**已通关 → provider 返回 0（无红点）；未通关 → 返回 1（有红点）**。

---

### 5.2 改动 1：`LaunchRoot` 里调一次注册

**这一步要做什么**：在启动脚本里调 `registerAllRedDots()`。

> 修改 `assets/src/LaunchRoot.ts`

找到合适的启动时机（通常是在 `StorageService` / 配置加载完之后、首页渲染之前），加一行：

```typescript
import { registerAllRedDots } from './core/reddot/RedDotRegistry';

// LaunchRoot.start() 里合适位置
registerAllRedDots();
```

**关键解读**：

- **`refreshAll` 是同步的**（Stage 5 已保证），所以这一行调完所有节点值都算好了。
- **顺序**：必须在 `StorageService` 可以正常读取（localStorage 可用）之后，早于 `HomePage` 创建 `LevelCard`。Cocos 场景启动阶段都能满足。

---

### 5.3 改动 2：升级 `LevelCard.create` 签名

**这一步要做什么**：把 `create` 的 `name: string` 升级为 `entry: LevelEntry`，好在内部拿到 `entry.id` 作为 path 一部分。

> 修改 `assets/src/ui/home/LevelCard.ts`

**签名升级**（注意是**破坏性改动**，调用方也得改——HomePage 只有一处）：

```typescript
import { LevelEntry } from '../../config/LevelManifest';
import { RedDotView } from '../../core/reddot/RedDotView';
import { RedDotBinder } from '../../core/reddot/RedDotBinder';

static create(
    entry: LevelEntry,
    previewFrame: SpriteFrame | null,
    onClick: () => void,
    status: LevelStatus = 'new',
    style: Partial<LevelCardStyle> = {},
): Node {
    const s = { ...DEFAULT_STYLE, ...style };

    const root = new Node(`LevelCard_${entry.name}`);
    const rootUt = root.addComponent(UITransform);
    rootUt.setContentSize(s.width, s.height);

    // ... 原有的 bg / preview / label / statusBadge / button 创建 ...
    //    （把原来代码里的 `name` 全部替换为 `entry.name` 即可）

    // —— Stage 6 新增：红点绑定 ——
    const dotHost = new Node('RedDot');
    root.addChild(dotHost);
    dotHost.setPosition(-s.width / 2 + 22, s.height / 2 - 22, 0);  // 左上角
    const dotUt = dotHost.addComponent(UITransform);
    dotUt.setContentSize(24, 24);
    dotHost.addComponent(RedDotView);
    const binder = dotHost.addComponent(RedDotBinder);
    binder.setPath(`home.level.${entry.id}`);

    // ... button ...
    return root;
}
```

**关键解读**：

- **签名从 `name` 改成 `entry` 是有意为之**：卡片需要同时用 `entry.id`（红点）和 `entry.name`（显示），把零散参数收敛到一个对象更干净。
- **`dotHost.setPosition(-w/2 + 22, h/2 - 22)`**——左上角内缩 22 像素，视觉上压在缩略图左上角。具体像素按你美术意愿调。
- **先 `addComponent(RedDotView)` 再 `addComponent(RedDotBinder)`**——其实顺序无所谓，Binder.onLoad 里 `getComponent(RedDotView) ?? addComponent(RedDotView)` 兼容两种顺序。但先 View 后 Binder 更符合"数据组件在底、行为组件在上"的直觉。
- **`binder.setPath(...)` 而不是 `binder.path = ...`**——走方法触发 `_bind`，而不是只改属性不订阅。虽然此时还没到 `start`，直接赋 `path` 然后等 `start` 自动订阅也行，但用 `setPath` 更直白，将来加强 `setPath` 的逻辑不用担心这里漏掉。

---

### 5.4 改动 3：`HomePage` 传 `entry`

**这一步要做什么**：改一行调用点。

> 修改 `assets/src/ui/home/HomePage.ts`

原来的 `LevelCard.create(entry.name, previewSF, ..., status)` 改为：

```typescript
const card = LevelCard.create(
    entry, previewSF,
    () => this._showLevelDetail(entry, previewSF),
    status,
);
```

**关键解读**：

- **HomePage 里不出现任何红点 API 调用**——这是 Stage 4 事件驱动承诺的兑现。红点的存在对业务页面**完全透明**，只需在 UI 组装时传对它来说无感的 `entry` 对象。

---

### 5.5 改动 4：通关时触发（已经在 Stage 4 做过）

通关流程里的 `StorageService.markLevelDone(id)` 已经在 Stage 4 末尾加过 emit。本章不动。

确认一下你的游戏里**完成一关时的代码路径**里确实调了 `StorageService.markLevelDone(id)`——通常在 `GamePage` 完成判定那一行。如果还没调，把它加上：

```typescript
// GamePage.ts 完成判定处
StorageService.markLevelDone(this._levelId);
```

Stage 4 的 emit 一旦在 `markLevelDone` 里就位，红点会**自动**消失——本章不用在业务侧写任何红点代码。

---

### 5.6 数据流复盘

```
玩家点击关卡卡片 → 进入游戏 → 通关
  └─ GamePage 完成判定
      └─ StorageService.markLevelDone(entry.id)
          ├─ 写 localStorage pa_done
          └─ RedDotManager.emit(LevelDoneChanged)
              └─ EventBus 查表: 'level_done_changed' → ['home.level.apple', ...]
                  └─ 逐个 _markDirty → _scheduleFlush
                      └─ 微任务 flush
                          ├─ 调 provider: isLevelDone('apple') → true → 返回 0
                          ├─ selfCount: 1 → 0，冒泡
                          │   ├─ home.level.totalCount 减 1
                          │   └─ home.totalCount 减 1
                          └─ 统一通知 listeners
                              └─ 该卡片的 RedDotBinder → RedDotView.setCount(0)
                                  └─ RedDotView 根据规则隐藏节点
```

玩家返回首页 → 卡片上的红点**已经消失**，其他未通关卡片红点不受影响。

---

## 6. 完整代码（汇总）

### 6.1 `assets/src/core/reddot/RedDotManager.ts`（本章追加的 `unregisterByPrefix`）

```typescript
unregisterByPrefix(prefix: string): void {
    const toRemove: string[] = [];
    this._nodes.forEach((_, path) => {
        if (path === prefix || path.startsWith(prefix + '.')) {
            toRemove.push(path);
        }
    });
    toRemove.sort((a, b) => b.length - a.length);
    for (const p of toRemove) this.unregister(p);
}
```

### 6.2 `assets/src/core/reddot/RedDotBinder.ts`（新增全量）

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
        this._view = this.getComponent(RedDotView) ?? this.addComponent(RedDotView);
    }

    start(): void {
        if (this.path) this._bind(this.path);
    }

    onDestroy(): void {
        this._unsub?.();
        this._unsub = null;
    }

    setPath(path: string): void {
        this.path = path;
        this._unsub?.();
        this._unsub = null;
        if (path && this._view) this._bind(path);
    }

    private _bind(path: string): void {
        this._unsub = RedDotManager.instance.subscribe(path, (n) => {
            this._view?.setCount(n);
        });
    }
}
```

### 6.3 `assets/src/ui/home/LevelCard.ts`（升级签名 + 红点子节点的差异片段）

```typescript
static create(
    entry: LevelEntry,
    previewFrame: SpriteFrame | null,
    onClick: () => void,
    status: LevelStatus = 'new',
    style: Partial<LevelCardStyle> = {},
): Node {
    const s = { ...DEFAULT_STYLE, ...style };
    const root = new Node(`LevelCard_${entry.name}`);

    // ... 原 bg / preview / label / statusBadge 代码，把 name 替换为 entry.name ...

    const dotHost = new Node('RedDot');
    root.addChild(dotHost);
    dotHost.setPosition(-s.width / 2 + 22, s.height / 2 - 22, 0);
    dotHost.addComponent(UITransform).setContentSize(24, 24);
    dotHost.addComponent(RedDotView);
    dotHost.addComponent(RedDotBinder).setPath(`home.level.${entry.id}`);

    // ... button ...
    return root;
}
```

### 6.4 `assets/src/ui/home/HomePage.ts`（改调用点）

```typescript
const card = LevelCard.create(
    entry, previewSF,
    () => this._showLevelDetail(entry, previewSF),
    status,
);
```

---

## 7. 动态节点的注册/注销模板（参考）

本项目还没邮件模块，这里只是展示**未来新增动态模块**怎么接入：

```typescript
// MailManager.ts（示意）
import { RedDotManager } from '../core/reddot/RedDotManager';
import { RedDotEvents } from '../core/reddot/RedDotEvents';

class MailManager {
    onReceiveMail(mail: Mail) {
        this._mails.push(mail);
        RedDotManager.instance.register(`home.mail.${mail.id}`, {
            provider: () => mail.isRead ? 0 : 1,
            deps: [RedDotEvents.MailUnreadChanged],  // 要先在 RedDotEvents 加这个常量
        });
        RedDotManager.instance.emit(RedDotEvents.MailUnreadChanged);
    }

    onDeleteMail(mailId: string) {
        this._mails = this._mails.filter(m => m.id !== mailId);
        RedDotManager.instance.unregister(`home.mail.${mailId}`);
    }

    onClearAllMails() {
        this._mails = [];
        RedDotManager.instance.unregisterByPrefix('home.mail');
    }
}
```

**三件事**：
1. `register` 节点（带 provider + deps）
2. 数据变了 `emit` 事件
3. 节点生命周期结束 `unregister` 或 `unregisterByPrefix`

---

## 8. 验证清单

### 8.1 功能验证

- [ ] 首次进入首页 → 所有 `isLevelDone === false` 的关卡都有红点
- [ ] 进游戏通关一个关 → 返回首页后**该卡红点消失**，其他卡片不变
- [ ] 清除 localStorage 的 `pa_done` → 所有关卡红点重新出现
- [ ] 切关卡 → 返回 → 再切关卡：红点始终刷新正确，不错位、不残留

### 8.2 工业级特性验证

- [ ] 业务代码全局搜 `RedDotManager.instance.refresh` → 应只在框架内部出现
- [ ] 业务代码全局搜 `RedDotManager.instance.setSelfCount` → 应搜不到（provider 模式完全替代）
- [ ] `HomePage.ts` 全文不出现任何红点 API 调用
- [ ] 对 `HomePage` 做 ctrl+F 搜 "RedDot" → 只有 `LevelCard` 间接带进来的（或者一个都没有）
- [ ] 销毁一张 LevelCard（换关卡列表）→ 对应 path 的 listener 从 manager 中自动消失（打点验证）

---

## 9. 接下来可能的扩展

系统做到这个程度，后续新需求都是**小改动**：

| 新需求 | 改动量 |
|--------|-------|
| 首页 Tab 按钮也要红点汇总 | 在 Tab 按钮 UI 上挂 `RedDotView + RedDotBinder`，path=`home.level` |
| 红点外观换成 PNG 九宫格 | 只改 `RedDotView._applyStyle`，挂 SpriteFrame |
| 有些玩家不显示红点（引导期） | Binder 外面套一层引导条件判断，或在 provider 里带 `Guide.isFinished ? 0 : ...` |
| 后端推送解锁新关卡 | 收到推送后动态 `register` + `emit(LevelDoneChanged)` |
| 活动中心红点 | 新建 `activity.*` 子树；复用所有机制 |

**每个需求都是单点改动，系统骨架不动**。这就是工业级架构的价值。

---

## 10. 恭喜你

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
