# Stage 07 — 类装饰器方案：理念与核心

> **本章定位**：Stage 1~6 教会了你一套"路径 id + 全局树 + Registry"的工业级红点系统（下文简称**方案 A**）。
> 本章开始，介绍**另一种设计哲学**（简称**方案 B**）——它在**开发者体验**上比 A 更激进地聚焦业务。
> **前置**：建议完成方案 A 的 Stage 1~6，但即使没看也能独立读本章。

> ⚠️ **重要提醒**：本章不"推翻"前 6 章。两个方案是并列的工程选择，各有适用场景。第 09 章会给完整的决策表。

---

## 1. 为什么还要再讲一种方案？

回顾方案 A，新增一个红点开发者要做的事：

1. 想一个路径 id（`home.level.l1`）
2. 写 provider 函数
3. 写 deps 事件名
4. 在 `RedDotRegistry.ts` 里登记一行
5. UI 里 subscribe + 反订阅

**五步，还得管好 id 不重、deps 不错、反订阅不漏。**

真实项目里如果有 50 个红点，`RedDotRegistry.ts` 会变成 200 行的大文件；事件名常量表也会膨胀。这不是"系统不对"，而是**把架构性负担丢给了业务开发者**。

方案 B 的目标：

> **让开发者只做两件事：**
> 1. 写一个"我这个红点怎么判定、依赖什么信号"的类
> 2. UI 节点上挂一个组件，填这个类的名字

其他的——UI 创建、定位、订阅、反订阅、防抖、冒泡——**全部由系统自动处理**。

## 2. Linus 式三连问

### 🟢 数据结构

我们推翻方案 A 里"路径 id + 全局树"这两样东西。用新的数据结构：

```typescript
// 红点身份 = 一个类（不再是字符串路径）
interface IRed {
    calcRed(): boolean;                 // 我什么情况下该红
    getSignals(out: Signal[]): void;    // 什么信号会让我变脏
}

// 红点组合 = 一个类包含其他红点类的引用
abstract class RedGroup implements IRed {
    protected abstract children: IRed[];
    // 我红 = 任意子红了；我的信号 = 所有子信号的并集
}

// 红点注册表 = 类名字符串 → 类构造函数
// 由 @regRed("xxx") 装饰器自动填充
const RED_REGISTRY = new Map<string, new () => IRed>();
```

**关键洞察**：

- **没有全局树**：红点之间的关系只体现在某个 `RedGroup` 子类的 `children` 数组里，**局部化**。
- **没有路径 id**：身份靠类名（`"GearFreeBuyRed"`），一个类就是一个红点。
- **没有集中 Registry 文件**：每个红点类用 `@regRed` 自注册，新增红点只加文件不改清单。

这三个"没有"不是倒退，是**认知重构**。

### 🟡 消除了哪些特殊情况

| 方案 A 的特殊情况 | 方案 B 如何消灭 |
|------------------|----------------|
| "路径要有层级约定，不然冒泡乱" | 没有冒泡，`RedGroup.calcRed` 递归本地计算 |
| "父节点必须先于子节点 register" | 没有父子的全局概念，Group 自己持有 children 引用 |
| "事件名冲突要全局常量表" | `Signal` 是对象不是字符串，不存在命名冲突 |
| "UI 要手动 subscribe / unsub 防泄漏" | `RedCom.onEnable/onDisable` 自动管理 |
| "Registry 文件膨胀" | 装饰器分散自注册，文件随模块走 |

### 🔴 复杂度

方案 B 的**核心代码**算上 Signal 实现不超过 80 行。
开发者新增红点的代码量从"5 步 + 改 Registry" 变成 **"1 个类 + 挂个组件"**。

---

## 3. 方案 B 的三层架构图

```
┌──────────────────────────────────────────────────┐
│                   业务红点逻辑层                   │
│                                                  │
│   @regRed("GearFreeBuyRed")                      │
│   class GearFreeBuyRed implements IRed { ... }   │
│                                                  │
│   @regRed("SidebarRed")                          │
│   class SidebarRed extends RedGroup { ... }      │
│                                                  │
│   —— 业务开发者只写这一层 ——                       │
└──────────────────┬───────────────────────────────┘
                   │ 通过类名字符串引用
                   ▼
┌──────────────────────────────────────────────────┐
│                    基建层（一次性编写）             │
│                                                  │
│   IRed / RedGroup / Signal                       │
│   @regRed 装饰器 + getRed(key) 查询               │
│                                                  │
│   本章讲                                          │
└──────────────────┬───────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────┐
│                    UI 集成层（一次性编写）          │
│                                                  │
│   RedCom 组件：挂在 Node 上填关键字                │
│   RedDisplay 预制体：红点的视觉表现                │
│                                                  │
│   下一章（Stage 08）讲                            │
└──────────────────────────────────────────────────┘
```

本章讲**业务红点逻辑层**和**基建层**。UI 集成留到 Stage 08。

---

## 4. Signal 最小实现

方案 B 不用字符串事件名，用 `Signal` 对象。这是框架能力前置知识，我们在本章最开头把它讲清楚。

### 4.1 为什么要 Signal 而不是字符串事件？

| 对比点 | 字符串事件名 | Signal 对象 |
|--------|------------|------------|
| 身份 | 全局唯一字符串 | 依附于某个对象的字段 |
| 发事件 | `eventBus.emit('xxx_changed')` | `this.changeSignal.dispatch()` |
| 收事件 | `eventBus.on('xxx_changed', cb)` | `obj.changeSignal.add(cb, this)` |
| 命名冲突 | 需要全局常量表防重 | 不存在——每个 Signal 实例天然独立 |
| 类型安全 | 字符串拼错不报错 | 字段访问，TS 编译期报错 |
| 数据归属 | 事件名和数据持有者解耦 | **信号属于数据，跟着数据走** |

最后一条最关键：**"关卡存档"这个数据的变化信号，应该是 `StorageService.levelSeenSignal` 字段，而不是一个游离的字符串 `'level_seen_changed'`**。谁持有数据，谁就持有改变信号。这是正确的耦合方向。

### 4.2 最小 Signal 实现（约 30 行）

```typescript
// core/signal/Signal.ts
type SignalHandler<T> = (payload: T) => void;

interface SignalSubscription<T> {
    handler: SignalHandler<T>;
    context: object | null;
}

/** 类型安全的轻量事件对象。每个 Signal 实例代表一件具体的事。 */
export class Signal<T = void> {
    private _subs: SignalSubscription<T>[] = [];

    add(handler: SignalHandler<T>, context: object | null = null): void {
        this._subs.push({ handler, context });
    }

    remove(handler: SignalHandler<T>, context: object | null = null): void {
        for (let i = this._subs.length - 1; i >= 0; i--) {
            const s = this._subs[i];
            if (s.handler === handler && s.context === context) {
                this._subs.splice(i, 1);
                return;
            }
        }
    }

    dispatch(payload: T): void {
        // 拷贝一份迭代，避免回调里再 add/remove 导致错乱
        const snapshot = this._subs.slice();
        for (const s of snapshot) {
            s.handler.call(s.context, payload);
        }
    }

    clear(): void {
        this._subs.length = 0;
    }
}
```

### 4.3 怎么用

```typescript
// StorageService.ts
import { Signal } from '../core/signal/Signal';

export class StorageService {
    static readonly levelSeenSignal = new Signal<string>();  // 泛型 = "点过的 levelId"

    static markLevelSeen(levelId: string): void {
        // ... 写 localStorage ...
        this.levelSeenSignal.dispatch(levelId);
    }
}
```

看清楚了吗？`StorageService` 不 import 任何红点代码，也不提事件名。**它只是告诉世界"我变了"**。谁关心谁自己来订。

---

## 5. IRed 接口

方案 B 所有红点的统一契约：

```typescript
// core/reddot-b/IRed.ts
import { Signal } from '../signal/Signal';

export interface IRed {
    /** 当前是否应该显示红点。可以扩展为 number（见 Stage 09 优化点 4） */
    calcRed(): boolean;

    /** 把"会导致我变脏"的所有信号 push 到 out 数组里 */
    getSignals(out: Signal<any>[]): void;
}
```

### 接口设计要点

1. **只有两个方法**。`calcRed` 回答"现在红不红"，`getSignals` 回答"谁会让我改变"。分别对应"显示什么"和"什么时候刷新"。
2. **`getSignals` 是 push 到数组而不是 return**：方便 `RedGroup` 把一堆子红点的信号合到同一个数组里，**零额外分配**。
3. **IRed 不知道自己是不是被挂载了、不知道 UI、不知道 Component 生命周期**。它就是一个纯逻辑对象。

### 例子：普通红点

```typescript
@regRed("GearFreeBuyRed")
export class GearFreeBuyRed implements IRed {
    calcRed(): boolean {
        return fw.tnStateCtr.getState(id_tnstate.buy_gear).isFreeBuy(fw.timer.ts);
    }
    getSignals(out: Signal<any>[]): void {
        out.push(fw.tnStateCtr.getState(id_tnstate.buy_gear).change_signal);
    }
}
```

两个方法，各自一行，自文档。业务含义一眼看到。

---

## 6. RedGroup：红点的组合

真实项目里一个按钮经常对应 N 个子条件，用 `RedGroup` 组合：

```typescript
// core/reddot-b/RedGroup.ts
import { IRed } from './IRed';
import { Signal } from '../signal/Signal';

export abstract class RedGroup implements IRed {
    protected abstract children: IRed[];

    calcRed(): boolean {
        for (let i = this.children.length - 1; i >= 0; --i) {
            if (this.children[i].calcRed()) return true;
        }
        return false;
    }

    getSignals(out: Signal<any>[]): void {
        for (let i = this.children.length - 1; i >= 0; --i) {
            this.children[i].getSignals(out);
        }
    }
}
```

### 设计要点

1. **"或"逻辑**：任意一个子红了我就红。这是 99% 的红点组需求。若要"且"逻辑，另写一个 `RedGroupAll` 基类即可。
2. **倒序遍历**：`calcRed` 倒序早返回效果相同但习惯；`getSignals` 倒序无差异。统一倒序只是代码风格一致。
3. **`children` 是 protected abstract**：强制子类声明，TS 编译器帮你检查。运行时没有额外开销。

### 例子：组合红点

```typescript
@regRed("SidebarRed")
export class SidebarRed extends RedGroup {
    protected children: IRed[] = [
        new GearFreeBuyRed(),
        new DailyLoginRed(),
        new NewMailRed(),
    ];
}
```

一眼能看清 `SidebarRed` 包含什么。**红点关系显式、局部、可追溯**。

---

## 7. @regRed 装饰器

方案 B 的"名字 → 类"注册，核心就是一个字符串到构造函数的 Map，加个装饰器糖衣。

### 7.1 实现

```typescript
// core/reddot-b/RedRegister.ts
import { IRed } from './IRed';

type RedCtor = new () => IRed;

const RED_REGISTRY = new Map<string, RedCtor>();

/** 类装饰器：把类注册到红点表 */
export function regRed(key: string) {
    return function <T extends RedCtor>(ctor: T): T {
        if (RED_REGISTRY.has(key)) {
            console.warn(`[RedDot] duplicate key '${key}', overriding.`);
        }
        RED_REGISTRY.set(key, ctor);
        return ctor;
    };
}

/** 根据关键字查找类 */
export function getRed(key: string): RedCtor | null {
    return RED_REGISTRY.get(key) ?? null;
}

/** 调试用：列出所有注册过的红点 */
export function listReds(): string[] {
    return Array.from(RED_REGISTRY.keys());
}
```

### 7.2 装饰器怎么生效？只"定义类"还不够

> **新手最容易踩的坑**：写了 `@regRed("GearFreeBuyRed")`，运行时 `getRed("GearFreeBuyRed")` 返回 null。

原因：TypeScript 的类装饰器**只在模块被 import 时才会执行**。如果你的项目启动代码里**没有 import 过 `GearFreeBuyRed.ts`**，它就没被加载，装饰器自然没跑。

**解决办法（三选一）：**

| 方法 | 说明 | 推荐度 |
|------|------|-------|
| 在启动脚本 import 一个"红点索引文件" | 索引文件集中 import 所有红点类 | ⭐⭐⭐ |
| Cocos 的场景里挂一个脚本 import | 靠场景激活触发 | ⭐ |
| Webpack/Rollup 的 `require.context` | 自动扫描目录 | ⭐⭐（Cocos 3.x 打包限制需要测） |

**推荐方案**：新建 `core/reddot-b/RedAllReds.ts`，集中 import：

```typescript
// core/reddot-b/RedAllReds.ts
// —— 仅用于触发红点类的装饰器注册 ——
import './reds/GearFreeBuyRed';
import './reds/DailyLoginRed';
import './reds/NewMailRed';
import './reds/SidebarRed';
// ... 新增红点只改这个文件
```

然后启动流程里 `import './core/reddot-b/RedAllReds';` 一次即可。

> 有人问："这不还是回到方案 A 的 Registry 了吗？"
> **不是**。Registry 文件里是**逻辑代码**（provider、deps、路径），膨胀起来难维护。
> `RedAllReds.ts` 里只是一行 `import` 声明，**纯文本索引**。逻辑全在各自的类文件里，单独可测、单独可改、**不影响别的类**。

### 7.3 TypeScript 配置

类装饰器需要 `tsconfig.json` 打开：

```json
{
    "compilerOptions": {
        "experimentalDecorators": true
    }
}
```

Cocos Creator 3.8 **默认已启用**，不用改。

---

## 8. 端到端示意（本章还不接 UI）

到此为止，业务代码已经可以跑了，只是还没接 UI（下一章做）。验证一下：

```typescript
// 启动流程
import './core/reddot-b/RedAllReds';   // 触发装饰器注册
import { getRed, listReds } from './core/reddot-b/RedRegister';

console.log(listReds());
// ['GearFreeBuyRed', 'DailyLoginRed', 'NewMailRed', 'SidebarRed']

const Cls = getRed('SidebarRed')!;
const inst = new Cls();
console.log(inst.calcRed());     // true/false
const signals: Signal<any>[] = [];
inst.getSignals(signals);
console.log(signals.length);     // SidebarRed 下所有叶子的信号数量之和
```

---

## 9. 本章沉淀的核心概念

| 概念 | 解决什么 |
|------|---------|
| `Signal<T>` | 替代字符串事件名；信号属于数据持有者 |
| `IRed` | 红点身份统一契约：会红不会红 + 依赖哪些信号 |
| `RedGroup` | 红点组合器：自动 OR + 信号聚合 |
| `@regRed("key")` | 类名字符串 → 构造函数映射 |
| `getRed(key)` | 运行时按关键字查类 |
| `RedAllReds.ts` | 触发装饰器注册的索引文件 |

---

## 10. 验证清单

- [ ] 写两个 `@regRed` 类，启动后 `listReds()` 打印出两个名字
- [ ] 漏写一次 import（比如注释掉 `RedAllReds.ts` 里的某行）→ `getRed("xxx")` 返回 null，能复现问题
- [ ] `new GearFreeBuyRed().calcRed()` 返回业务期望的 bool
- [ ] `const arr: Signal<any>[] = []; inst.getSignals(arr)` 后数组包含所有相关信号
- [ ] `SidebarRed` 包含 3 个子红点 → `getSignals(arr)` 后 `arr.length === 3`（或按各子红点实际信号数求和）
- [ ] 任意子 Signal 被 `dispatch` → 你能手动调 `inst.calcRed()` 看到新结果（UI 还没接，手动验证）

---

## 11. 下一章

目前红点**只能逻辑计算**，还不能**自己亮起来**。
缺两样东西：
1. 一个挂在 UI Node 上的组件，能自动实例化 `IRed`、订阅信号、刷新显示
2. 一个红点视觉表现（`RedDisplay`）和自动定位策略

Stage 08 把这些补上。翻到 [`08-redcom-integration.md`](./08-redcom-integration.md)。
