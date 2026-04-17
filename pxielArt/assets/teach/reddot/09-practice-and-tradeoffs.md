# Stage 09 — 实战、对比与进阶优化

> **本章定位**：方案 B 的毕业章。三件事：
> 1. 在本项目端到端做一个**三层嵌套红点**实战
> 2. 给出**方案 A vs 方案 B** 的选择决策表
> 3. 指出**方案 B 还能怎么更好**的 4 个优化点
> **前置**：Stage 07、08。

---

## 1. 实战：三层嵌套红点

这一节我们在 pxielArt 项目里完整加一个需求——

> **"首页 TopBar 有个'汇总红点'。只要下方任意一个关卡是新的、或任意一个未打开的活动、或任意一个未领奖励，都应该亮起。"**

这个需求刚好需要三层组合。用方案 B 实现一遍。

### 1.1 逻辑分解

```
HomeTopRed (RedGroup 汇总)
├── LevelAnyNewRed (RedGroup 关卡域汇总)
│   ├── LevelSeenRed('test_1px')
│   ├── LevelSeenRed('test_simple')
│   ├── LevelSeenRed('apple')
│   └── LevelSeenRed('mountain')
├── ActivityAnyRed  (暂留空实现)
└── RewardAnyRed    (暂留空实现)
```

三层。`HomeTopRed` 不 care 下游怎么组合，只知道"把三个子域的结果 OR 起来"。

### 1.2 数据侧：给 StorageService 加 Signal

```typescript
// storage/StorageService.ts
import { Signal } from '../core/signal/Signal';

export class StorageService {
    static readonly levelSeenChanged = new Signal<string>();   // payload: levelId
    
    // 新增 seen 相关存取（方案 A 章节已经给过，这里只补 signal dispatch）
    static markLevelSeen(levelId: string): void {
        const list = this._loadSeenList();
        if (list.includes(levelId)) return;
        list.push(levelId);
        sys.localStorage.setItem(SEEN_KEY, JSON.stringify(list));
        this.levelSeenChanged.dispatch(levelId);   // ← 唯一一行新增
    }
    
    static isLevelSeen(levelId: string): boolean {
        return this._loadSeenList().includes(levelId);
    }
    // _loadSeenList 等省略
}
```

**注意数据归属**：`levelSeenChanged` 信号作为 `StorageService` 的静态字段存在，**信号跟着数据走**。将来换成后端推送模型，也是在 `StorageService` 里触发同一个信号，业务零侵入。

### 1.3 叶子红点：带参数的 IRed

这里遇到新问题：**每个关卡要一个单独的红点，但它们逻辑相同（只是 levelId 不同）**。

方案 B 的天然解法——**IRed 是类，可以有构造参数**：

```typescript
// reds/LevelSeenRed.ts
import { IRed } from '../core/reddot-b/IRed';
import { Signal } from '../core/signal/Signal';
import { StorageService } from '../storage/StorageService';

export class LevelSeenRed implements IRed {
    constructor(private readonly levelId: string) {}

    calcRed(): boolean {
        return !StorageService.isLevelSeen(this.levelId);
    }

    getSignals(out: Signal<any>[]): void {
        out.push(StorageService.levelSeenChanged);
    }
}
```

注意两点：

- **这个类不加 `@regRed`**：它不是独立入口，是要被 RedGroup 组合的原材料。
- **`getSignals` 直接 push 全局的 `levelSeenChanged`**：所有关卡共用一个信号，dispatch 一次会让所有 `LevelSeenRed` 实例重算各自的 `calcRed`。正是我们想要的。

### 1.4 关卡域 RedGroup

```typescript
// reds/LevelAnyNewRed.ts
import { regRed } from '../core/reddot-b/RedRegister';
import { RedGroup } from '../core/reddot-b/RedGroup';
import { IRed } from '../core/reddot-b/IRed';
import { LevelSeenRed } from './LevelSeenRed';
import { LevelManifest } from '../config/LevelManifest';

@regRed("LevelAnyNewRed")
export class LevelAnyNewRed extends RedGroup {
    protected children: IRed[] = LevelManifest.map(e => new LevelSeenRed(e.id));
}
```

**一句 map 表达了"所有关卡红点汇总"**。
关卡清单改了（`LevelManifest.ts` 里加新关卡），这里自动跟上，**不需要改**。

### 1.5 占位子域（暂时空实现，展示扩展留白）

```typescript
// reds/ActivityAnyRed.ts
@regRed("ActivityAnyRed")
export class ActivityAnyRed implements IRed {
    calcRed(): boolean { return false; }       // 活动系统尚未上线
    getSignals(out: Signal<any>[]): void { /* 暂无 */ }
}

// reds/RewardAnyRed.ts 同理
```

**写空实现而不是"要用时再加"**，是为了让上游 `HomeTopRed` 现在就能引用、将来不改代码。这是**开闭原则**在红点域的体现。

### 1.6 顶层汇总

```typescript
// reds/HomeTopRed.ts
import { regRed } from '../core/reddot-b/RedRegister';
import { RedGroup } from '../core/reddot-b/RedGroup';
import { IRed } from '../core/reddot-b/IRed';
import { LevelAnyNewRed } from './LevelAnyNewRed';
import { ActivityAnyRed } from './ActivityAnyRed';
import { RewardAnyRed } from './RewardAnyRed';

@regRed("HomeTopRed")
export class HomeTopRed extends RedGroup {
    protected children: IRed[] = [
        new LevelAnyNewRed(),
        new ActivityAnyRed(),
        new RewardAnyRed(),
    ];
}
```

**HomeTopRed 不知道"关卡"和"活动"是啥**。它只知道三个子红点，OR 一下就是自己。
明天产品说"加一个邮件红点"，改这一个文件就完。

### 1.7 注册索引

```typescript
// core/reddot-b/RedAllReds.ts
import '../../reds/LevelAnyNewRed';
import '../../reds/ActivityAnyRed';
import '../../reds/RewardAnyRed';
import '../../reds/HomeTopRed';
// LevelSeenRed 不需要 import（它不走装饰器注册）
```

### 1.8 启动时触发注册

```typescript
// LaunchRoot.ts start 里一行
import './core/reddot-b/RedAllReds';
```

### 1.9 UI 侧：TopBar 和关卡卡片

TopBar 上给"汇总按钮"挂组件：

```typescript
// ui/home/HomePage._buildTopBar 内部找个位置
import { RedCom } from '../../core/reddot-b/RedCom';

const rc = myWorksNode.addComponent(RedCom);
rc.redKey = 'HomeTopRed';
```

关卡卡片同理：

```typescript
// ui/home/LevelCard.create 内部
const rc = root.addComponent(RedCom);
rc.redKey = `LevelSeen_${entry.id}`;   // ← 但这里有个坑，见下
```

**坑来了**：`LevelSeen_apple`、`LevelSeen_mountain`... 每个都是独立的 key？装饰器注册**不支持这样一对多**。

方案 B 这里需要一个小扩展。两种解法：

#### 解法一：预注册动态 key（推荐）

修改 `RedRegister.ts`，加一个"工厂注册"能力：

```typescript
// core/reddot-b/RedRegister.ts 补充
type RedCtor = new () => IRed;
type RedFactory = () => IRed;

const RED_FACTORY = new Map<string, RedFactory>();

export function regRedFactory(key: string, factory: RedFactory): void {
    RED_FACTORY.set(key, factory);
}

export function getRed(key: string): (new () => IRed) | null {
    // 优先看工厂
    const f = RED_FACTORY.get(key);
    if (f) {
        // 动态包装成 "构造函数"
        return class { constructor() { return f(); } } as any;
    }
    return RED_REGISTRY.get(key) ?? null;
}
```

然后启动时批量注册：

```typescript
// LaunchRoot start 里
for (const entry of LevelManifest) {
    regRedFactory(`LevelSeen_${entry.id}`, () => new LevelSeenRed(entry.id));
}
```

这样 `RedCom` 填 `LevelSeen_apple` 就能工作。

#### 解法二：`RedCom` 直接支持"参数化 key"

在 `RedCom` 加一个 `redArg` 属性，配合一个**约定**：

```typescript
// RedCom 里
onLoad(): void {
    const Ctor = getRed(this.redKey);
    if (!Ctor) { /* ... */ }
    this._inst = new (Ctor as any)(this.redArg);  // 传参数
    // ...
}
```

然后 `LevelSeenRed` 直接 `@regRed("LevelSeenRed")`，编辑器上 `redKey = "LevelSeenRed"` + `redArg = "apple"`。

**哪种更好？**

- 解法一：保持 `IRed` 构造函数无参的纯净，用工厂封装参数；**推荐**。
- 解法二：侵入 `RedCom` 接口，增加一个编辑器字段，简单但污染核心。

用解法一。

### 1.10 回顾最终产物

开发者完成这个需求**写了多少东西**？

| 文件 | 行数估算 | 职责 |
|------|---------|------|
| `StorageService.ts` | +4 行 | 加 signal + dispatch |
| `LevelSeenRed.ts` | ~15 行 | 单关卡红点逻辑 |
| `LevelAnyNewRed.ts` | ~10 行 | 关卡域组合 |
| `ActivityAnyRed.ts` | ~10 行 | 占位（未来扩展点） |
| `RewardAnyRed.ts` | ~10 行 | 占位 |
| `HomeTopRed.ts` | ~12 行 | 顶层汇总 |
| `RedAllReds.ts` | +4 行 | 索引 |
| `LaunchRoot.ts` | +5 行 | 动态工厂注册 |
| UI 两处挂组件 | +4 行 | 编辑器字段 |

**合计 ~75 行业务代码，没有一行在 `RedCom` / `IRed` / `RedGroup` 基建里**。三层嵌套 + 动态 key + 自动刷新全部实现。

---

## 2. 方案 A vs 方案 B 决策表

两套方案各有擅长领域。**不是替换关系，而是工具箱里的两件工具**。

### 2.1 一图看懂

| 维度 | 方案 A（路径 id + 全局树） | 方案 B（类装饰器 + RedGroup） |
|------|-------------------------|----------------------------|
| 身份 | 字符串路径 | 类名 |
| 父子关系 | 路径前缀自动推导 | `RedGroup.children` 显式声明 |
| 事件 | 字符串事件名 + EventBus | `Signal<T>` 对象 |
| 注册 | 集中 Registry 文件 | 类装饰器分散注册 |
| UI 挂载 | `RedDotView` + `RedDotBinder`（两个组件）| `RedCom`（一个组件）|
| 红点复用 | 一个路径一个节点，不好复用 | IRed 类实例可被多处 `new` |
| 启动成本 | 低，JSON 文件就能配 | 依赖装饰器 + 索引 import |
| 运行时侵入 | 依赖全局 `RedDotManager` 单例 | 无中央对象（除 Signal 外） |
| 学习曲线 | 更直观（一看路径就懂层级） | 更抽象（要理解类组合） |
| 测试难度 | 要 mock 全局 Manager | 直接 new 类断言，零 mock |
| 配表驱动可行性 | 高（路径写进表） | 低（类名硬编码） |

### 2.2 选择指南

#### ✅ 用方案 A 的场景

- **中小项目，红点 < 20 个**，开发者熟悉路径概念，不想引入装饰器
- **策划要改红点规则** → 用路径 + 配表方案，策划可配
- **引擎版本老、装饰器兼容性存疑**
- **想要所有红点一眼看清** → Registry 文件就是清单

#### ✅ 用方案 B 的场景

- **大型项目，红点 > 50 个**，不想让 Registry 无限膨胀
- **红点有复杂组合/复用需求**，同一个判定要挂在多个按钮上
- **已经有 Signal/EventTarget 基建**，数据持有者习惯持有信号
- **单元测试重要**，想直接 `new XxxRed(); expect(red.calcRed()).toBe(true)`
- **项目用 Cocos 3.x / 现代 TS 工具链**

#### ⚠️ 不要混用

两套并存会导致：
- 开发者不知道加红点该 extend 哪种基类
- 两边的冒泡机制不兼容
- 维护成本翻倍

**项目级决策，一旦选定就坚持到底**。

---

## 3. 方案 B 的 4 处可改进点

即便方案 B 已经很优雅，仍有几处可以更好。这些是留给你自己动手优化的方向。

### 3.1 优化点 1：`children` 从实例数组改为 key 数组

**问题**：

```typescript
@regRed("SidebarRed")
export class SidebarRed extends RedGroup {
    protected children: IRed[] = [
        new GearFreeBuyRed(),   // ← new 一次
        new DailyLoginRed(),
    ];
}
```

- `SidebarRed` 硬 import 子类，**模块耦合**
- 如果 `GearFreeBuyRed` 有内部状态（缓存），跨 Group 复用会串
- 无法动态增删 children（比如"登录后才加 VIP 红点"）

**改进**：

```typescript
export abstract class RedGroup implements IRed {
    protected abstract childKeys: string[];
    private _cache: IRed[] | null = null;

    protected get children(): IRed[] {
        if (this._cache) return this._cache;
        this._cache = this.childKeys
            .map(k => {
                const C = getRed(k);
                if (!C) { console.warn(`[RedGroup] missing '${k}'`); return null; }
                return new C();
            })
            .filter((x): x is IRed => x !== null);
        return this._cache;
    }

    calcRed(): boolean {
        return this.children.some(c => c.calcRed());
    }
    getSignals(out: Signal<any>[]): void {
        this.children.forEach(c => c.getSignals(out));
    }
}
```

**使用**：

```typescript
@regRed("SidebarRed")
export class SidebarRed extends RedGroup {
    protected childKeys = ['GearFreeBuyRed', 'DailyLoginRed'];
}
```

好处：
- 不 import 子类，**松耦合**
- 子类注册不存在时给 warn 而不是 crash
- 懒实例化 + 缓存

代价：字符串引用失去编译期检查。如果介意，用 `const keys = ['GearFreeBuyRed'] as const` 加上 TS 的常量类型校验。

### 3.2 优化点 2：把 0.5 秒变成可配常量

**问题**：

```typescript
const RED_REFRESH_DEBOUNCE = 0.5;
```

写死 0.5 秒，战斗页红点可能希望更快（0.1s），列表红点可能希望更慢（1s 聚合更多 dispatch）。

**改进**：加一个 `RedCom` 编辑器属性：

```typescript
@property({ tooltip: '防抖间隔（秒）' })
debounce: number = 0.5;

private _markDirty(): void {
    if (this._scheduled) return;
    this._scheduled = true;
    this.scheduleOnce(this._refreshNow, this.debounce);
}
```

编辑器里按场景调即可。

### 3.3 优化点 3：dirty 标志和 scheduled 标志合并

**问题**（你原代码里）：

```typescript
private m_RedDirty: boolean = false;
private __i_scheduling: boolean = false;

protected MarkRedDirty() {
    if (this.m_RedDirty === true) return;
    this.m_RedDirty = true;
    if (this.__i_scheduling) return;
    this.__i_scheduling = true;
    this.schedule(...);
}
```

两个 bool 其实表达的是同一件事——"已经预约刷新了"。语义重合容易混乱。

**改进**（Stage 08 已采用）：只留一个 `_scheduled`：

```typescript
private _scheduled: boolean = false;
private _markDirty(): void {
    if (this._scheduled) return;
    this._scheduled = true;
    this.scheduleOnce(this._refreshNow, this.debounce);
}
```

`_refreshNow` 内部 `_scheduled = false` 即可。少一个状态变量，少一类 bug。

### 3.4 优化点 4：`calcRed` 升级为 number

**问题**：`calcRed(): boolean` 只能表达"红/不红"，表达不了"5 封未读"。真实项目迟早需要数字。

**改进**：接口升级为数字。bool 语义用 `> 0` 表达：

```typescript
// IRed.ts 升级
export interface IRed {
    calcRed(): number;   // 0 = 无红点；>0 = 有红点（可选作计数）
    getSignals(out: Signal<any>[]): void;
}
```

```typescript
// RedGroup.ts 升级
calcRed(): number {
    let sum = 0;
    for (const c of this.children) sum += c.calcRed();
    return sum;
}
```

```typescript
// RedDisplay.ts 升级
setRed(count: number): void {
    this.node.active = count > 0;
    // 可选：count >= 2 时显示数字
}
```

```typescript
// 业务类
export class NewMailRed implements IRed {
    calcRed(): number {
        return MailData.unreadCount();   // 直接返回数字
    }
}
```

**向后兼容策略**：旧的返回 bool 的类临时强转也能跑（`true` → 1，`false` → 0，JS 隐式转换），迁移期零压力。

---

## 4. 你已经毕业了

走完 Stage 01~09，你掌握了：

- **方案 A**：工业级的"路径 id + 全局树 + Registry + EventBus + 脏标记"
- **方案 B**：更聚焦业务的"类装饰器 + RedGroup + Signal + RedCom"
- **方案选择**：知道何时用哪套
- **改进方向**：会看出方案的不足并主动升级

这套思路不止适用于红点。**任何"派生状态 + 多源更新 + 多处订阅"的系统都同构**：
- 任务进度聚合
- 成就系统解锁条件
- 资源库存汇总
- 战力计算
- 功能开放判定

红点只是这类系统里**可视化最明显**的一个。吃透它，你就拥有了一把**结构化处理派生状态**的通用武器。

---

## 5. 最后一句

> **"好的架构不是你能用它做多少事，而是它不强迫你做多少事。"**

方案 A 能做的事，方案 B 都能做。但方案 B 让开发者**少做了很多本不该做的事**。
能把系统做得"够用"的人很多，能把系统做得"让别人不想用其他方案"的人少。

这是工业级红点系统的终点，也是更大工程思考的起点。

---

*完。 返回索引：[`00-overview.md`](./00-overview.md)*
