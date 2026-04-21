# Stage 06 — 参数化红点：N 个同类红点共用一套逻辑

> **这一阶段结束，你会得到**：`@regRed("Foo")` 之外再加一个 `regRedFactory("Foo_apple", () => new FooRed("apple"))`，列表场景里每个子项一个独立 redKey，逻辑复用 0 代码。
> **前置**：Stage 01~05。
> **代码量**：`RedRegister.ts` 增加约 20 行。

---

## 1. 要解决什么问题

关卡页有 10 个关卡，每个关卡都需要一个独立红点：

```
home_page:
├── LevelCard("apple")       ← 这里的红点要反映 apple 是否已通关
├── LevelCard("mountain")    ← mountain 是否已通关
├── LevelCard("river")       ← ...
...
```

直觉写法：

```typescript
@regRed("LevelDone_apple")
class LevelDoneAppleRed implements IRed { /* ... */ }

@regRed("LevelDone_mountain")
class LevelDoneMountainRed implements IRed { /* ... */ }
// ...写 10 遍
```

**这是一个糟糕的特殊情况**。它破坏 Linus 的"消除边界情况"原则——10 个类只在 levelId 不同，却要写 10 份声明。

**正确的思路**：让红点类本身可以**带参数**，注册表支持按 `"Foo_arg"` 字符串动态拼装实例。

---

## 2. Linus 式三连问

### 🟢 数据结构

之前只有一张表 `RED_REGISTRY: Map<string, Ctor>`。现在再加一张**工厂表**：

```
RED_FACTORY: Map<string, () => IRed>
```

两张表，查询时先查 factory，再查 registry。

### 🟡 特殊情况

| 场景 | 糟糕写法 | 好写法 |
|------|---------|--------|
| factory 和 registry 同 key | 行为未定义 | 明确优先级：factory 优先 |
| factory 的 IRed 实例可能共享状态 | 多个 RedCom new 一次共享 | 工厂**每次调都 new 一个**，互相独立 |
| 注册 10 个 levelId 要写 10 次 `regRedFactory` | 手动重复 | 启动时用循环批量注册 |

### 🔴 复杂度

新增 3 个东西：一张 Map、一个 `regRedFactory` 函数、把 `getRed` 改成两张表都查。**加起来不到 20 行**。

---

## 3. 分步实现

### 3.1 需求：定义"工厂 = 返回新 IRed 实例的函数"

**文件**：`assets/src/core/reddot/RedRegister.ts`（修改，在 `type RedCtor` 旁边）

```typescript
type RedFactory = () => IRed;
```

**为什么**：
- **返回 `IRed`** 而不是 `new IRed()` 约束。工厂可以用任何方式产出实例——`new XxxRed(arg)`、`SingletonRed.instance`、甚至根据参数选不同类。
- **每次调都返回新实例**是**约定**。实现方（工厂调用方）要遵守。为什么不强制？因为做不到——工厂函数是黑盒。

---

### 3.2 需求：新增工厂表

**文件**：同上

```typescript
const RED_FACTORY = new Map<string, RedFactory>();
```

**为什么**：
- 和 `RED_REGISTRY` 并列。两张表**故意分开**：
    - `RED_REGISTRY` 是"装饰器自注册的静态类"
    - `RED_FACTORY` 是"启动时手动注册的参数化工厂"
    - 分开让调试时一眼看清红点的注册来源（`listReds()` 和类似 `listRedFactories()` 各自返回）。

---

### 3.3 需求：提供"工厂式注册"函数

**文件**：同上，追加

```typescript
export function regRedFactory(key: string, factory: RedFactory): void {
    if (RED_FACTORY.has(key) || RED_REGISTRY.has(key)) {
        console.warn(`[RedDot] duplicate key '${key}', overriding.`);
    }
    RED_FACTORY.set(key, factory);
}
```

**为什么**：
- **跨两张表都要查重**：无论是类注册还是工厂注册，同一个 key 在整个系统里应该**只有一个含义**。
- **不是装饰器**：工厂注册通常在启动代码里**循环**调用，装饰器语法不适用。函数调用最直接。

---

### 3.4 需求：`getRed` 同时查两张表

**文件**：同上，修改原有的 `getRed`

```typescript
export function getRed(key: string): (new () => IRed) | null {
    const factory = RED_FACTORY.get(key);
    if (factory) {
        return class { constructor() { return factory(); } } as any;
    }
    return RED_REGISTRY.get(key) ?? null;
}
```

**为什么**：
- **优先查 factory**：让工厂有覆盖装饰器注册的能力（想覆盖的时候覆盖；不想就别起冲突）。
- **工厂包装成"伪构造函数"**：`RedCom` 里是 `new Ctor()` 拿实例，统一接口不改动。包成 `class { constructor() { return factory(); } }` 相当于一个无状态的"匿名类"，`new` 它就等于调 `factory()`。
    - JS 里 `constructor` 可以 `return` 一个对象，那个对象会替代 `new` 的结果。这是语言允许的技巧，但不常见。
- **`as any`**：TS 不接受"匿名类构造返回值和声明类型的精确对齐"，用 any 闸一下。这是**基建层允许的小妥协**，业务代码里绝对不要滥用 any。

---

### 3.5 需求：调试能看见工厂注册的 key

**文件**：同上，追加

```typescript
export function listRedFactories(): string[] {
    return Array.from(RED_FACTORY.keys());
}
```

**为什么**：和 `listReds()` 对称。排查 `getRed("Xxx")` 为 null 时，两张表都看一眼。

---

### 3.6 汇总完整代码

**文件**：`assets/src/core/reddot/RedRegister.ts`

```typescript
import { IRed } from './IRed';

type RedCtor = new () => IRed;
type RedFactory = () => IRed;

const RED_REGISTRY = new Map<string, RedCtor>();
const RED_FACTORY = new Map<string, RedFactory>();

export function regRed(key: string) {
    return function <T extends RedCtor>(ctor: T): T {
        if (RED_REGISTRY.has(key) || RED_FACTORY.has(key)) {
            console.warn(`[RedDot] duplicate key '${key}', overriding.`);
        }
        RED_REGISTRY.set(key, ctor);
        return ctor;
    };
}

export function regRedFactory(key: string, factory: RedFactory): void {
    if (RED_FACTORY.has(key) || RED_REGISTRY.has(key)) {
        console.warn(`[RedDot] duplicate key '${key}', overriding.`);
    }
    RED_FACTORY.set(key, factory);
}

export function getRed(key: string): (new () => IRed) | null {
    const factory = RED_FACTORY.get(key);
    if (factory) {
        return class { constructor() { return factory(); } } as any;
    }
    return RED_REGISTRY.get(key) ?? null;
}

export function listReds(): string[] {
    return Array.from(RED_REGISTRY.keys());
}

export function listRedFactories(): string[] {
    return Array.from(RED_FACTORY.keys());
}
```

---

## 4. 使用示范：N 个关卡红点

### 4.1 定义一个带参数的红点类（**不用 @regRed**）

**文件**：`assets/src/reds/LevelDoneRed.ts`（**本教程示例路径**）

```typescript
import { IRed } from '../core/reddot/IRed';
import { Signal } from '../core/signal/Signal';
import { StorageService } from '../storage/StorageService';

export class LevelDoneRed implements IRed {
    constructor(private readonly levelId: string) { }

    calcRed(): boolean {
        return !StorageService.isLevelDone(this.levelId);
    }

    getSignals(out: Signal<any>[]): void {
        out.push(StorageService.levelDoneChanged);
    }
}
```

**为什么不加 `@regRed`？**
- `@regRed` 要求**无参构造**。`LevelDoneRed` 需要 `levelId` 参数，天然不走装饰器。
- 它不是独立入口，是要通过**工厂**包装成 `"LevelDone_apple"` 这种具体 key 才对外。

---

### 4.2 启动时循环注册工厂

**文件**：`assets/src/LaunchRoot.ts`（假设项目启动入口，按实际位置调整）

```typescript
import './core/reddot/RedAllReds';   // 触发静态类装饰器
import { regRedFactory } from './core/reddot/RedRegister';
import { LevelDoneRed } from './reds/LevelDoneRed';
import { LevelManifest } from './config/LevelManifest';

for (const entry of LevelManifest) {
    regRedFactory(`LevelDone_${entry.id}`, () => new LevelDoneRed(entry.id));
}
```

**为什么**：
- **`LevelManifest` 是项目的关卡清单**（已存在）。新增关卡只改它，红点自动跟上——**不需要改红点代码**。
- **每次调 `new LevelDoneRed(entry.id)`** 都产生新实例。工厂函数里的 `entry.id` 通过闭包捕获，每个工厂绑定一个具体 levelId。

---

### 4.3 UI 侧挂组件填 key

**文件**：`assets/src/ui/home/LevelCard.ts`（假设）

```typescript
import { RedCom } from '../../core/reddot/RedCom';

// 创建卡片时
const rc = cardNode.addComponent(RedCom);
rc.redKey = `LevelDone_${entry.id}`;
```

**就这样**。每张卡片一个独立红点，逻辑在 `LevelDoneRed` 里写一次搞定。

---

## 5. 验证清单

- [ ] `regRedFactory("Foo_apple", () => new FooRed("apple"))` 后 `listRedFactories()` 包含 `"Foo_apple"`
- [ ] `getRed("Foo_apple")` 返回一个"伪构造函数"，`new` 之后 `instanceof FooRed` 为 true
- [ ] 两个不同 `RedCom` 用不同 key（`Foo_apple` / `Foo_mountain`）→ 拿到**两个独立实例**，状态互不干扰
- [ ] factory 和 registry 同 key → 控制台 warn
- [ ] factory 和 registry 不同 key → 两边都能查到

---

## 6. 讨论：为什么不侵入 `RedCom` 加一个 `redArg` 字段？

有人会问：**直接给 `RedCom` 加一个 `redArg: string` 字段不是更简单吗**？

```typescript
// 假想写法（不推荐）
@property redKey: string = '';
@property redArg: string = '';

onLoad() {
    const Ctor = getRed(this.redKey);
    this._inst = new (Ctor as any)(this.redArg);   // 传参给构造
}
```

**看起来**更简单，但有三个问题：

1. **`IRed` 的构造签名被污染**——所有无参红点也要接受 `arg: string` 参数（或者运行时判断类型，更丑）。
2. **参数类型硬编码为 string**——有些红点需要多个参数、或 number 参数，一个 `redArg: string` 搞不定。
3. **RedCom 要了解红点参数**——破坏 "RedCom 只认 key" 的抽象。

**工厂模式的优势**：
- `IRed` 构造签名**由业务自己决定**，想几个参数就几个参数。
- 启动时的工厂注册是**一次性代价**（只改一处代码：启动脚本里的循环）。
- RedCom 不知道 arg 存在——它的世界里永远只有 key。**接口干净**。

---

## 7. 这阶段的局限 → 下一阶段解决

到此为止系统**全部基建就绪**：

- Signal（神经）
- IRed / @regRed（身份）
- RedGroup（组合）
- RedDisplay（视觉）
- RedCom（组件化入口）
- Factory（参数化）

**可以开始在真实项目里接入了**。最后一章（也是实战章）——在 pxielArt 项目里加一个"未通关关卡红点"，端到端跑通。

翻开 [`07-integration.md`](./07-integration.md)。
