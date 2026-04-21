# Stage 02 — IRed 与 @regRed：红点的身份系统

> **这一阶段结束，你会得到**：一个统一的红点契约 `IRed`、一个字符串→类的注册表、一个 `@regRed("Key")` 装饰器。后面 UI 层靠一个字符串 key 就能找到任意红点类。
> **前置**：Stage 01。
> **代码量**：两个文件合计约 60 行。

---

## 1. 要解决什么问题

上一章搞定了"信号"。现在要定义"红点本身"，它必须回答两件事：

1. **现在红不红？**（`calcRed(): boolean`）
2. **哪些信号会让我变脏？**（`getSignals(out): void`）

这是所有红点的**共性契约**。再加一个问题：

3. **UI 层拿到一个字符串 key（比如编辑器里填的 `"GearFreeBuyRed"`），怎么找到对应的类？**

需要一个**注册表**。配一个装饰器 `@regRed("Key")` 自动把类填进去，业务文件零样板。

---

## 2. Linus 式三连问

### 🟢 数据结构

```
IRed = { calcRed(), getSignals(out) }     ← 纯接口
RED_REGISTRY = Map<string, new () => IRed> ← 字符串 → 构造函数
```

两个数据结构就够了。

### 🟡 特殊情况

| 场景 | 糟糕写法 | 好写法 |
|------|---------|--------|
| 重复 `@regRed("X")` | 静默覆盖，排查半天 | 打 warn 让用户立刻发现 |
| 查不到 key | 抛异常让上层崩 | 返回 `null`，上层自己决定怎么处理 |
| `getSignals` 返回数组 | 每次都 `new [...]`，浪费 GC | push 到上层传入的数组，零分配 |

### 🔴 复杂度

- `IRed`：两个方法，就是个接口。
- `RedRegister`：`regRed` 一个函数、`getRed` 一个函数、`RED_REGISTRY` 一个 Map。加起来不到 30 行。

---

## 3. 分步实现

### 3.1 需求：定义"红点该长什么样"

**文件**：`assets/src/core/reddot/IRed.ts`（新建）

```typescript
import { Signal } from '../signal/Signal';

export interface IRed {
    /** 当前是否应该显示红点 */
    calcRed(): boolean;

    /** 把"会导致我变脏"的所有信号 push 到 out 数组里 */
    getSignals(out: Signal<any>[]): void;
}
```

**为什么**：
- **只有两个方法**：`calcRed` 回答"该不该红"，`getSignals` 回答"谁会让我改变"。业务和框架的职责一刀切开。
- **`getSignals` 不 return，而是 push 到参数**：后面 `RedGroup` 会把所有子红点的信号合到同一个数组里，零额外分配。**数据结构决定简洁度**。
- **`Signal<any>[]` 用 `any`**：这个数组里的信号 payload 各不相同（有的是 string 有的是 number），框架不关心 payload 具体类型，只负责把 `.add/.remove` 挂上去。

---

### 3.2 需求：一个例子验证接口能用

假设我们已经有 `StorageService`，业务里写一个最简单的红点类：

```typescript
// 示例，不用真存到文件，光看形状
class HasFreeBuyRed implements IRed {
    calcRed(): boolean {
        return StoreService.hasFreeBuy();
    }
    getSignals(out: Signal<any>[]): void {
        out.push(StoreService.freeBuyChangedSignal);
    }
}
```

两个方法、各一行。业务含义一眼看清。**IRed 是纯逻辑对象**，不知道 UI、不知道 Component、能单独 `new` 出来跑单测。

---

### 3.3 需求：一个"字符串 → 类"的全局表

**文件**：`assets/src/core/reddot/RedRegister.ts`（新建）

```typescript
import { IRed } from './IRed';

type RedCtor = new () => IRed;

const RED_REGISTRY = new Map<string, RedCtor>();
```

**为什么**：
- `RedCtor` 是"无参构造函数，返回 IRed"的类型。参数化（比如 `new LevelDoneRed("apple")`）在 Stage 06 专门讲，本章先留纯净。
- `Map` 而不是 `{}`：Map 的 key 类型明确是 string，且迭代顺序是插入序。
- 变量用**模块级常量**：一个进程只会有一张表，不用单例类、不用全局对象。

---

### 3.4 需求：注册一个类

**文件**：同上，追加

```typescript
export function regRed(key: string) {
    return function <T extends RedCtor>(ctor: T): T {
        if (RED_REGISTRY.has(key)) {
            console.warn(`[RedDot] duplicate key '${key}', overriding.`);
        }
        RED_REGISTRY.set(key, ctor);
        return ctor;
    };
}
```

**为什么**：
- **装饰器工厂**（外层函数先接 `key`，再返回真正的装饰器）：这是 TS 的标准装饰器工厂签名。
- **`<T extends RedCtor>(ctor: T): T`**：泛型而不是 `(ctor: RedCtor): void`——返回 `T` 让 TS 保留"它还是原来那个类"的类型信息，下游 `instanceof` 或 `new ctor()` 都不丢类型。
- **重复注册打 warn**：静默覆盖是 bug 温床。不抛异常是因为有些热更新场景会重入注册，warn 够用了。
- **`return ctor`**：装饰器规范要求返回（TS 会用返回值替换原类）。这里不改写类，原样返回。

---

### 3.5 需求：按 key 查找类

**文件**：同上，追加

```typescript
export function getRed(key: string): RedCtor | null {
    return RED_REGISTRY.get(key) ?? null;
}
```

**为什么**：
- **返回 `RedCtor | null`**：拿不到就 null，UI 层可以打 error 并 early return，不崩父页面。
- **`?? null`**：`Map.get` 找不到返回 `undefined`，统一成 `null` 让下游类型更清晰。

---

### 3.6 需求：调试时列出所有已注册红点

**文件**：同上，追加

```typescript
export function listReds(): string[] {
    return Array.from(RED_REGISTRY.keys());
}
```

**为什么**：
- 排查"`getRed("Xxx")` 返 null" 时第一反应就是"到底注册了哪些？"。提供这个工具函数零成本。
- `Array.from(map.keys())` 返回拷贝，外部拿到改了不影响内部表。

---

### 3.7 需求：触发所有红点类被"加载"

TypeScript 装饰器**只在类所在模块被 `import` 时才执行**。如果启动代码没 import 过 `XxxRed.ts`，装饰器没跑，`getRed("Xxx")` 就 null。

解法：建一个**索引文件**，集中 `import` 所有红点类。

**文件**：`assets/src/core/reddot/RedAllReds.ts`（新建，现在留空）

```typescript
// —— 仅用于触发红点类的装饰器注册 ——
// 新增一个红点类时，在此文件追加一行 import
// 例如：
//   import '../../reds/GearFreeBuyRed';

export { };  // 告诉 TS 这是模块，不会被当作脚本
```

**为什么**：
- **纯文本索引**，不放任何逻辑。和旧方案里"Registry 放 provider / deps / path 的大文件"完全不同——这里膨胀了也只是 import 声明，grep / 跳转都丝滑。
- **`export {}`**：空文件 TS 会警告"不是模块"。一行空导出让它认账。

**启动时 import 一次**（Stage 07 实战会做，**现在先知道有这回事**）：

```typescript
// LaunchRoot.ts 里
import './core/reddot/RedAllReds';
```

---

### 3.8 需求：tsconfig 打开装饰器支持

类装饰器需要 TS 打开实验特性：

```json
{
    "compilerOptions": {
        "experimentalDecorators": true
    }
}
```

**好消息**：Cocos Creator 3.8 默认已经打开，不用改。编辑器用的 `tsconfig.cocos.json` 里已经有了。如果 IDE 报装饰器相关错误，检查项目根的 `tsconfig.json` 有没有继承到。

---

## 4. 汇总完整代码

### `assets/src/core/reddot/IRed.ts`

```typescript
import { Signal } from '../signal/Signal';

export interface IRed {
    calcRed(): boolean;
    getSignals(out: Signal<any>[]): void;
}
```

### `assets/src/core/reddot/RedRegister.ts`

```typescript
import { IRed } from './IRed';

type RedCtor = new () => IRed;

const RED_REGISTRY = new Map<string, RedCtor>();

export function regRed(key: string) {
    return function <T extends RedCtor>(ctor: T): T {
        if (RED_REGISTRY.has(key)) {
            console.warn(`[RedDot] duplicate key '${key}', overriding.`);
        }
        RED_REGISTRY.set(key, ctor);
        return ctor;
    };
}

export function getRed(key: string): RedCtor | null {
    return RED_REGISTRY.get(key) ?? null;
}

export function listReds(): string[] {
    return Array.from(RED_REGISTRY.keys());
}
```

### `assets/src/core/reddot/RedAllReds.ts`

```typescript
// —— 仅用于触发红点类的装饰器注册 ——
export { };
```

---

## 5. 怎么用（验证 demo）

本章先不接 Cocos UI。我们写一个纯逻辑 demo，**确认装饰器 + 注册表能跑**。

```typescript
import { regRed, getRed, listReds } from './core/reddot/RedRegister';
import { IRed } from './core/reddot/IRed';
import { Signal } from './core/signal/Signal';

const clickCountChanged = new Signal<number>();
let clickCount = 0;

@regRed("TestRed")
class TestRed implements IRed {
    calcRed(): boolean {
        return clickCount > 0;
    }
    getSignals(out: Signal<any>[]): void {
        out.push(clickCountChanged);
    }
}

console.log(listReds());            // ["TestRed"]

const Ctor = getRed("TestRed")!;
const inst = new Ctor();
console.log(inst.calcRed());        // false

clickCount = 3;
console.log(inst.calcRed());        // true

const sigs: Signal<any>[] = [];
inst.getSignals(sigs);
console.log(sigs.length);           // 1
console.log(sigs[0] === clickCountChanged);  // true
```

---

## 6. 验证清单

- [ ] `@regRed("X")` 装饰一个类后，`listReds()` 能看到 `"X"`
- [ ] 漏 `@regRed` → `getRed("X")` 返回 null
- [ ] 重复 `@regRed("X")` → 控制台有 warn
- [ ] `new (getRed("X")!)()` 拿到实例，`calcRed()` 可调
- [ ] `const arr = []; inst.getSignals(arr); arr.length` === 业务信号数

---

## 7. 这阶段的局限 → 下一阶段解决

现在每个红点类是**孤立**的。但真实项目里：

- 首页"关卡"按钮的红点 = 所有关卡红点的 OR
- 首页"汇总"按钮的红点 = 关卡/活动/邮件三个大类的 OR

红点之间需要**组合**。下一章讲 `RedGroup` —— [`03-redgroup.md`](./03-redgroup.md)。
