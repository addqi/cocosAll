# Stage 01 — Signal：红点系统的事件神经

> **这一阶段结束，你会得到**：一个 30 行的 `Signal<T>` 类，类型安全、支持 add / remove / dispatch / clear，是整套红点系统的事件基石。
> **代码量**：单文件约 40 行。

---

## 1. 要解决什么问题

红点要回答两件事：

1. **现在红不红？** —— 逻辑计算
2. **什么时候要重算？** —— 订阅事件

第 2 件事就需要**事件机制**。有两种典型实现：

| 方案 | 示例 | 问题 |
|------|------|------|
| **字符串事件名** | `bus.emit('level_done_changed', id)` | 名字打错编译器不管；全局命名冲突；和数据持有者解耦到"字符串" |
| **Signal 对象** | `LevelService.doneChanged.dispatch(id)` | 信号是谁的字段，语义清楚；TS 字段访问编译期检查 |

我们选 **Signal**。理由就一条：**信号必须跟着数据走**。谁持有数据，谁就持有"数据变了"的信号。

---

## 2. Linus 式三连问

### 🟢 数据结构

一个 Signal 实例 = 一件具体的事。它持有的状态只有一样：

```
_subs: { handler, context }[]
```

订阅者 = 一个"回调 + 上下文"二元组。没了。

### 🟡 特殊情况

| 场景 | 糟糕写法 | 好写法 |
|------|---------|--------|
| 回调里 `remove` 自己 | 正在遍历的数组被改，下一个回调漏掉 | `dispatch` 先拷贝一份再遍历 |
| 同一个 `handler` 但不同 `context` 被订阅两次 | `handler === handler` 就误删 | 比较 `handler && context` 两者相等才删 |
| 反复 add/remove 导致顺序错乱 | 回调顺序不可预期 | 保持插入顺序（数组默认行为） |

### 🔴 复杂度

核心 API 只有 4 个：`add` / `remove` / `dispatch` / `clear`。整个类 30 行够了。**任何一个超过 5 行的方法都说明你做多了**。

---

## 3. 分步实现

### 3.1 需求：给回调起个类型名

一个回调长什么样？`(payload: T) => void`。直接内联写一遍一遍烦，起个名字。

**文件**：`assets/src/core/signal/Signal.ts`（新建）

```typescript
type SignalHandler<T> = (payload: T) => void;
```

**为什么**：
- 泛型 `<T>` 让同一个 `Signal` 可以承载不同 payload 类型（`string`、`number`、自定义结构）。
- `void` 返回——订阅者拿数据就行，别返东西回来（不会有地方用）。

---

### 3.2 需求：一个订阅项 = 回调 + 上下文

`remove` 时要判断"是哪个对象订阅的"，所以除了 handler 还得存 context。用一个小结构：

**文件**：同上，接在 `SignalHandler` 下面

```typescript
interface SignalSubscription<T> {
    handler: SignalHandler<T>;
    context: object | null;
}
```

**为什么**：
- `context` 用 `object | null`：Cocos 里 `this` 一般是 Component 实例（object）；允许 `null` 是因为"全局函数订阅"的场景不需要 this 绑定。
- 不用类、用接口：`{ handler, context }` 字面量构造，零 GC 成本。

---

### 3.3 需求：Signal 类本体（骨架）

**文件**：同上，追加

```typescript
export class Signal<T = void> {
    private _subs: SignalSubscription<T>[] = [];

    add(handler: SignalHandler<T>, context: object | null = null): void { /* 下一步 */ }
    remove(handler: SignalHandler<T>, context: object | null = null): void { /* 下一步 */ }
    dispatch(payload: T): void { /* 下一步 */ }
    clear(): void { /* 下一步 */ }
}
```

**为什么**：
- `<T = void>` 默认 void，这样不关心 payload 的 Signal 可以 `new Signal()` 而不是 `new Signal<void>()`，语法更短。
- `_subs` 用数组而不是 Set/Map：
    - Set 的顺序是插入序没问题，但"同一 handler 不同 context"作为两项会被 Set 的引用相等折腾，得额外包装。
    - Map 的 key 需要唯一性，而订阅天然允许"同 handler + 同 context"出现（虽然不推荐）。
    - **数组最朴素最对**。

---

### 3.4 需求：添加订阅

**文件**：同上，`add` 方法体

```typescript
add(handler: SignalHandler<T>, context: object | null = null): void {
    this._subs.push({ handler, context });
}
```

**为什么**：
- 不做去重检查——去重是订阅方的责任。框架不该替你"修复"业务方调错两次的错误，那样的 bug 更难查。
- 直接 `push`，O(1)。

---

### 3.5 需求：移除订阅

**文件**：同上，`remove` 方法体

```typescript
remove(handler: SignalHandler<T>, context: object | null = null): void {
    for (let i = this._subs.length - 1; i >= 0; i--) {
        const s = this._subs[i];
        if (s.handler === handler && s.context === context) {
            this._subs.splice(i, 1);
            return;
        }
    }
}
```

**为什么**：
- **倒序遍历**：允许回调内部 `remove` 自己而不弄乱迭代索引。
- **`handler === handler && context === context` 两个都要等**：同一个函数可以被多个组件订阅，`context` 是区分"哪个实例订的"的唯一依据。
- **找到立刻 `return`**：只删第一个匹配项。"同一对 (handler, context) 订两次"是调用方的 bug，系统不应该一次清光。

---

### 3.6 需求：派发事件

**文件**：同上，`dispatch` 方法体

```typescript
dispatch(payload: T): void {
    const snapshot = this._subs.slice();
    for (const s of snapshot) {
        s.handler.call(s.context, payload);
    }
}
```

**为什么**：
- **`slice()` 先拷贝再遍历**：消灭"回调里 add/remove 导致迭代数组被修改"这个经典 bug。拷贝的代价是 1 次数组浅拷贝（数组小的时候 < 1μs），换来**不可能出错**。
- **`handler.call(s.context, payload)`**：把 `this` 绑定到订阅时传入的 context。Cocos 组件里 `signal.add(this.onXxx, this)` 后，回调里的 `this` 还是那个 Component，符合直觉。

---

### 3.7 需求：一次清空所有订阅

**文件**：同上，`clear` 方法体

```typescript
clear(): void {
    this._subs.length = 0;
}
```

**为什么**：
- `this._subs = []` 也对，但 `.length = 0` **复用同一数组对象**，少一次 GC。
- 什么时候用：关卡切换、登出账号等大批量清理场景。平时一般不用。

---

### 3.8 汇总完整代码

**文件**：`assets/src/core/signal/Signal.ts`

```typescript
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

---

## 4. 怎么用（最小 demo）

```typescript
import { Signal } from './core/signal/Signal';

// 定义"关卡完成"信号，payload = levelId
const levelDoneChanged = new Signal<string>();

// 订阅
function onLevelDone(levelId: string) {
    console.log('level done:', levelId);
}
levelDoneChanged.add(onLevelDone);

// 派发
levelDoneChanged.dispatch('apple');    // 输出: level done: apple
levelDoneChanged.dispatch('mountain'); // 输出: level done: mountain

// 取消订阅
levelDoneChanged.remove(onLevelDone);
levelDoneChanged.dispatch('again');    // 什么都不输出
```

**带 context 的例子**：

```typescript
class Foo {
    name = 'Foo instance';
    onChange(id: string) {
        console.log(this.name, 'got', id);  // this 是 Foo 实例
    }
}

const foo = new Foo();
levelDoneChanged.add(foo.onChange, foo);
levelDoneChanged.dispatch('apple');
// 输出: Foo instance got apple

levelDoneChanged.remove(foo.onChange, foo);
```

---

## 5. 验证清单

- [ ] `add` 之后 `dispatch` → 回调被调用，收到正确的 payload
- [ ] `remove` 之后 `dispatch` → 回调不被调用
- [ ] 回调里 `remove` 自己 → 不崩、后续回调照常执行
- [ ] 同一个 `handler` 绑不同 `context` 算两项（`remove(h, ctx1)` 不影响 `(h, ctx2)`）
- [ ] `clear()` 之后 `dispatch` → 无任何回调

---

## 6. 这阶段的局限 → 下一阶段解决

现在我们有了"信号"这根**神经**，但还没有"红点"这个**肌肉**：
- 没有东西去定义"红不红"
- 没有统一的接口让框架知道"我依赖哪些 Signal"

下一章做"红点身份"—— [`02-ired-and-regred.md`](./02-ired-and-regred.md)。
