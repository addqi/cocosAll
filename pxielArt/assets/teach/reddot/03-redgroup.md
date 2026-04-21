# Stage 03 — RedGroup：红点的组合

> **这一阶段结束，你会得到**：一个 `RedGroup` 抽象类，让"父红点 = 任意子红点红"用**10 行代码**搞定，信号自动聚合。
> **前置**：Stage 01、02。
> **代码量**：单文件约 20 行。

---

## 1. 要解决什么问题

真实项目的红点关系：

```
HomeTopRed  (首页汇总)
├── LevelAnyNewRed   (关卡域，任意关卡有红就红)
├── ActivityAnyRed   (活动域，任意活动有红就红)
└── MailAnyRed       (邮件域)
```

`HomeTopRed` 自己不关心**怎么算**，它只想说：

> "我的三个孩子里任意一个红，我就红。"

这是**组合**，不是继承。写一个基类 `RedGroup`，子类只声明 `children` 就行。

---

## 2. Linus 式三连问

### 🟢 数据结构

```
RedGroup = {
    children: IRed[]    // 我的孩子们
}
```

就一个数组。"父→子"的关系**显式、局部、可追溯**——不像"路径 id + 全局树"那套需要在全局 Manager 里维护父子关系。

### 🟡 特殊情况

| 场景 | 糟糕写法 | 好写法 |
|------|---------|--------|
| 有 10 个子，第 1 个就红 | 遍历完 10 个才返回 | 任意一个红立即 return true（**短路**） |
| 想统计所有子信号 | 每次都 `signals.concat(childSigs)` 创建新数组 | 把同一个 out 数组传给每个子的 `getSignals` |
| 子红点 crash（业务 bug） | 父跟着崩 | **本章不管**：业务错误业务负责，框架只做该做的事 |

### 🔴 复杂度

`RedGroup` 只有两个方法：`calcRed` 和 `getSignals`。每个 5 行内。**基类禁止做任何调度/订阅**，那是 `RedCom` 的活。

---

## 3. 分步实现

### 3.1 需求：声明"我也是个 IRed，只是由一堆子红点拼出来"

**文件**：`assets/src/core/reddot/RedGroup.ts`（新建）

```typescript
import { IRed } from './IRed';
import { Signal } from '../signal/Signal';

export abstract class RedGroup implements IRed {
    protected abstract children: IRed[];
}
```

**为什么**：
- **`abstract class`**：自己不能被 `new`，必须被继承。强制子类声明 `children`。
- **`protected abstract children`**：子类必须给出 `children = [...]`，TS 编译器会检查。比运行时断言早得多。
- **为什么类型是 `IRed[]` 而不是 `RedCtor[]`**：`RedGroup` 想装**已经 new 出来的实例**，这样子可以有状态（比如带 levelId 的构造参数）。字符串 key 的方案 Stage 06 再讨论。

---

### 3.2 需求：`calcRed` — 任意子红则我红

**文件**：同上，追加到类里

```typescript
calcRed(): boolean {
    for (let i = this.children.length - 1; i >= 0; --i) {
        if (this.children[i].calcRed()) return true;
    }
    return false;
}
```

**为什么**：
- **倒序 + 短路**：从后往前遍历，任意一个子 `calcRed` 为 true 立刻返回。倒序是个人风格（和 `getSignals` 统一），功能上正序也对。
- **为什么不用 `.some(c => c.calcRed())`**：数组方法 `.some` 会产生一个临时箭头函数和 Array.prototype 方法调用开销。热路径（每帧可能调）上 for 循环更划算。这个权衡**只在你确认是热路径时才做**，普通业务用 `.some` 更易读。

---

### 3.3 需求：`getSignals` — 子信号全部聚合

**文件**：同上，追加到类里

```typescript
getSignals(out: Signal<any>[]): void {
    for (let i = this.children.length - 1; i >= 0; --i) {
        this.children[i].getSignals(out);
    }
}
```

**为什么**：
- **把 out 数组一路传下去**：所有层级的信号最终 push 到同一个数组，**零额外分配**。这是 Stage 02 里 "`getSignals` 不 return" 设计的回报时刻。
- **聚合不去重**：同一个 Signal 被多个子红点依赖会被 push 多次。`RedCom` 在订阅时可以考虑去重（或者不管——订多次的代价就是回调跑多次，但每次都是 dirty 标记合并，最终刷新次数不变，**能接受**）。

---

### 3.4 汇总完整代码

**文件**：`assets/src/core/reddot/RedGroup.ts`

```typescript
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

就这 20 行。

---

## 4. 怎么用（示例）

### 4.1 两层组合

假设上一章我们定义了 `TestRed`。再定义一个 `AnotherRed`，组成一个 Group：

```typescript
import { regRed } from './core/reddot/RedRegister';
import { RedGroup } from './core/reddot/RedGroup';
import { IRed } from './core/reddot/IRed';
import { Signal } from './core/signal/Signal';

const aChanged = new Signal<void>();
let aFlag = false;

@regRed("A")
class ARed implements IRed {
    calcRed() { return aFlag; }
    getSignals(out: Signal<any>[]) { out.push(aChanged); }
}

const bChanged = new Signal<void>();
let bFlag = false;

@regRed("B")
class BRed implements IRed {
    calcRed() { return bFlag; }
    getSignals(out: Signal<any>[]) { out.push(bChanged); }
}

@regRed("AB")
class ABGroup extends RedGroup {
    protected children: IRed[] = [new ARed(), new BRed()];
}
```

### 4.2 验证

```typescript
const Ctor = getRed("AB")!;
const ab = new Ctor();

console.log(ab.calcRed());   // false（A、B 都未亮）

aFlag = true;
console.log(ab.calcRed());   // true（A 亮了，AB 就亮）

const sigs: Signal<any>[] = [];
ab.getSignals(sigs);
console.log(sigs.length);    // 2（A 的 Signal + B 的 Signal）
console.log(sigs.includes(aChanged));  // true
console.log(sigs.includes(bChanged));  // true
```

### 4.3 三层嵌套

`RedGroup` 天然支持递归：

```typescript
@regRed("OuterGroup")
class OuterGroup extends RedGroup {
    protected children: IRed[] = [
        new ABGroup(),   // 一个 Group
        new CRed(),      // 一个叶子
    ];
}
```

`OuterGroup.calcRed()` 会递归调 `ABGroup.calcRed()`，`ABGroup.calcRed()` 再递归调 `ARed.calcRed()` / `BRed.calcRed()`。整个结构**局部定义、递归工作**。

---

## 5. 验证清单

- [ ] 所有子都不红 → `RedGroup.calcRed()` 返回 false
- [ ] 任意一个子红 → `RedGroup.calcRed()` 返回 true
- [ ] `getSignals(arr)` 后 `arr` 包含所有叶子 Signal（**去重不是框架责任**）
- [ ] 三层嵌套 Group 工作正常（递归没爆栈）
- [ ] 修改任意叶子状态 → 上级 Group `calcRed` 跟着变

---

## 6. 设计讨论：为什么不用"字符串事件冒泡"？

有人可能会问：方案 A 里"子 setCount 触发父节点订阅回调"的**冒泡**去哪了？

答：**没有冒泡**。RedGroup 的父子关系是**本地递归调用**，不需要"子通知父"。当任意子的 Signal 派发时，`RedCom`（下下章会讲）已经把父 Group 的所有叶子信号都订阅了一遍，一次 dispatch 就自动触发**本 Group 的整体重算**。

这是**数据结构代替算法**的经典体现——消灭了"冒泡"这个特殊情况，因为从一开始就不需要它。

---

## 7. 这阶段的局限 → 下一阶段解决

到目前为止，我们的红点可以：

- 定义（`IRed`）
- 注册（`@regRed`）
- 组合（`RedGroup`）
- 手动 `calcRed()` 拿结果

但是**还不能自己亮**——红点还只是逻辑对象。下一章做"红点视觉"—— [`04-reddisplay.md`](./04-reddisplay.md)。
