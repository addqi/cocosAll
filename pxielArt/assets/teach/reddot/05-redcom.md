# Stage 05 — RedCom：一个组件搞定一切

> **这一阶段结束，你会得到**：开发者在任意节点上挂一个 `RedCom` 组件 + 填一个 `redKey`，**红点就工作了**——实例化、订阅、定位、防抖刷新、节点销毁时反订阅，**全自动**。
> **前置**：Stage 01~04。
> **代码量**：单文件约 80 行。

---

## 1. 要解决什么问题

前 4 章结束，红点还**不能自己亮**。要开发者手动做：

1. `new XxxRed()` 拿实例
2. `inst.getSignals(arr)` 收集信号
3. `arr.forEach(s => s.add(refresh, this))` 订阅
4. 建红点子节点、挂 RedDisplay、放到右上角
5. 每次信号触发 → 重算 → `display.setRed(inst.calcRed())`
6. 节点销毁 → `arr.forEach(s => s.remove(refresh, this))`
7. 防抖：一秒内 100 次 dispatch 别算 100 次

七件事。本章把它们**全塞进一个 Component**。开发者之后唯一要做的：挂组件 + 填关键字。

---

## 2. Linus 式三连问

### 🟢 数据结构

```
RedCom {
    redKey: string                  // 编辑器填
    _inst: IRed | null              // 从 redKey 查来的实例
    _signals: Signal<any>[]         // _inst.getSignals 收集的依赖
    _display: RedDisplay | null     // 自动创建的子节点组件
    _scheduled: boolean             // 是否已预约刷新
}
```

**一个类、一个字符串、一串信号、一个子 UI、一个脏标记**。没了。

### 🟡 特殊情况

| 场景 | 糟糕写法 | 好写法 |
|------|---------|--------|
| 节点 active → inactive → active 来回切 | `onLoad` 订阅就完事 | `onEnable` 订，`onDisable` 反订 |
| 找不到 `redKey` 对应类 | 崩或静默失败 | error log + 后续 early return |
| 一秒 dispatch 100 次 | 算 100 次 | 脏标记 + `scheduleOnce` 防抖 |
| 销毁时还没触发的 schedule | 节点死了还在刷 | `onDisable` 取消 schedule |
| `_refreshNow` 用普通方法 | `unschedule` 引用对不上 | **箭头函数字段**，引用稳定 |

### 🔴 复杂度

**目标 80 行内**。所有 Cocos 生命周期代码**集中到这一个文件**，业务 `IRed` 保持纯净。

---

## 3. 分步实现

### 3.1 需求：组件骨架 + 编辑器字段

**文件**：`assets/src/core/reddot/RedCom.ts`（新建）

```typescript
import { _decorator, Component, Node, UITransform } from 'cc';
import { IRed } from './IRed';
import { Signal } from '../signal/Signal';
import { getRed } from './RedRegister';
import { RedDisplay } from './RedDisplay';
const { ccclass, property } = _decorator;

/** 防抖间隔（秒） */
const RED_REFRESH_DEBOUNCE = 0.5;

@ccclass('RedCom')
export class RedCom extends Component {

    @property
    redKey: string = '';

    private _inst: IRed | null = null;
    private _signals: Signal<any>[] = [];
    private _display: RedDisplay | null = null;
    private _scheduled: boolean = false;

    // 下面分步填生命周期方法
}
```

**为什么**：
- **`RED_REFRESH_DEBOUNCE`** 抽成顶部常量：以后改 0.3s / 1s 只改一处；也方便 Stage 09 进一步改为 `@property` 可编辑器配置。
- **`@property redKey: string`**：编辑器 Inspector 会出现一个文本框。挂组件的人填这个字符串。
- **所有私有字段 `_` 开头**：Cocos 项目惯例。

---

### 3.2 需求：节点加载时——拿到红点实例、收集信号、建视觉子节点

**文件**：同上，类里追加

```typescript
onLoad(): void {
    const Ctor = getRed(this.redKey);
    if (!Ctor) {
        console.error(`[RedCom] redKey '${this.redKey}' not found. Did you import the class in RedAllReds.ts?`);
        return;
    }
    this._inst = new Ctor();
    this._inst.getSignals(this._signals);

    this._createDisplay();
}
```

**为什么**：
- **`getRed(key)` 返回 null 就 early return**：`_inst` 保持 null，后续所有方法会跳过工作。**一个坏红点不拖垮整个父页面**。
- **错误提示里带上 `RedAllReds.ts`**：这是新人最常见的坑——类没被 import → 装饰器没执行 → `getRed` 拿不到。错误日志直接告诉他怎么查。
- **`getSignals(this._signals)` 只调一次**：假设业务 `IRed` 运行时不换依赖。99% 项目用不到动态 rebind，真需要的话加个 `rebindSignals()` 方法再说。

---

### 3.3 需求：创建红点子节点并定位到右上角

**文件**：同上，`_createDisplay` 方法

```typescript
private _createDisplay(): void {
    const ut = this.node.getComponent(UITransform);
    if (!ut) {
        console.warn(`[RedCom] node '${this.node.name}' has no UITransform; skip.`);
        return;
    }

    const dotNode = new Node('RedDot');
    this.node.addChild(dotNode);
    dotNode.setPosition(
        (1 - ut.anchorX) * ut.width,
        (1 - ut.anchorY) * ut.height,
        0,
    );

    this._display = dotNode.addComponent(RedDisplay);
    this._display.setRed(false);
}
```

**为什么**：
- **父节点必须有 `UITransform`**：没有就 warn 跳过，不崩。典型情况是开发者把 RedCom 挂到非 UI 节点上——给个友好提示。
- **定位公式 `(1 - anchorX) * width, (1 - anchorY) * height`**：
    - 父节点**右上角**相对父节点**中心**的偏移 = `(1 - anchorX) * width, (1 - anchorY) * height`。
    - 不依赖父节点锚点具体值，`anchor = (0.5, 0.5)` 或 `(0, 0)` 都对。
- **初始 `setRed(false)`**：先隐藏，等第一次 `calcRed` 再决定显不显示。避免闪一下。

---

### 3.4 需求：节点激活时——订阅信号 + 补一次刷新

**文件**：同上，类里追加

```typescript
onEnable(): void {
    if (!this._inst) return;
    for (const s of this._signals) s.add(this._markDirty, this);
    this._markDirty();
}
```

**为什么**：
- **订阅放 `onEnable` 而不是 `onLoad`**：节点可能经历"active → inactive → active"反复切换，inactive 期间不该响应信号。`onEnable/onDisable` 是 Cocos 里做订阅/反订阅的标准位置。
- **进来立刻 `_markDirty` 一次**：节点失活期间如果有 Signal 被 dispatch 过，回调没跑；重新激活时得手动补一次状态同步。
- **`this._markDirty` 传函数引用 + `this`**：`Signal.add(h, ctx)` 签名要求这俩，`remove` 时要用同一对 (h, ctx) 才能匹配。

---

### 3.5 需求：节点失活时——反订阅 + 取消待触发的 schedule

**文件**：同上，类里追加

```typescript
onDisable(): void {
    if (!this._inst) return;
    for (const s of this._signals) s.remove(this._markDirty, this);
    if (this._scheduled) {
        this.unschedule(this._refreshNow);
        this._scheduled = false;
    }
}
```

**为什么**：
- **反订阅必须用**同一对 (handler, context)** 才匹配得上。这是 Stage 01 设计 `remove` 时的约束。
- **清 schedule**：预约了 0.5s 后 refresh 但节点已经失活——必须取消。不然节点隐藏期间还会刷出红点，甚至节点已销毁后触发 bug。
- **`this._scheduled = false` 必须手动重置**：`unschedule` 不会替你改这个布尔值。

---

### 3.6 需求：销毁时清引用

**文件**：同上，类里追加

```typescript
onDestroy(): void {
    this._inst = null;
    this._display = null;
    this._signals.length = 0;
}
```

**为什么**：
- Cocos 的 Component 被销毁后引用实际会悬空，但**显式置 null** 是好习惯——防止外部持有本组件时意外访问到半死不活的状态。
- **`_signals.length = 0`**：清数组内容但保留同一数组对象，省一次 GC。`onDisable` 已经 remove 过了，这里只管清引用。

---

### 3.7 需求：标记脏（防抖入口）

**文件**：同上，类里追加

```typescript
private _markDirty = (): void => {
    if (this._scheduled) return;
    this._scheduled = true;
    this.scheduleOnce(this._refreshNow, RED_REFRESH_DEBOUNCE);
};
```

**为什么**：
- **箭头函数字段**而不是普通方法：
    - `Signal.add(h, ctx)` 要用这个函数引用；后面 `Signal.remove(h, ctx)` 也要用**同一个引用**。
    - 普通方法 `this._markDirty` 每次访问都是同一个 prototype 方法，**但 `.call(ctx)` 时 this 绑定需要额外注意**。箭头函数字段天然绑定到实例，且每个实例自己持有一份引用，传给 Signal 的**引用绝对稳定**。
- **早退检查**：已经预约过了就不再预约，防止一秒内 100 次信号 → 100 个 schedule 叠加。
- **`scheduleOnce` 而不是 `schedule`**：`schedule` 是周期调度（每 N 秒一次），`scheduleOnce` 只触发一次。我们要的是"N 秒后触发一次，触发完忘掉"。

---

### 3.8 需求：真正的刷新动作

**文件**：同上，类里追加

```typescript
private _refreshNow = (): void => {
    this._scheduled = false;
    if (!this._inst || !this._display) return;
    const isRed = this._inst.calcRed();
    this._display.setRed(isRed);
};
```

**为什么**：
- **箭头函数字段**，同样理由：`unschedule(this._refreshNow)` 需要引用稳定。
- **第一件事就是 `_scheduled = false`**：允许下一次 `_markDirty` 能再次调度。这个顺序很重要——如果放最后，`calcRed` 里如果意外又 dispatch 导致 `_markDirty` 被调用，会发现还是 true 而跳过（bug）。
- **null 检查**：onLoad 失败（`getRed` 返 null）、或者组件销毁中，任一 null 就安静退出。

---

### 3.9 需求：允许业务手动强刷

**文件**：同上，类里追加

```typescript
/** 业务强刷：账号切换、发奖结算等场景，等不及 0.5s 防抖 */
refresh(): void {
    if (this._scheduled) {
        this.unschedule(this._refreshNow);
        this._scheduled = false;
    }
    this._refreshNow();
}
```

**为什么**：
- **先取消待触发的 schedule**：防止"手动刷一次之后立刻又被 schedule 触发刷一次"的冗余刷新。
- 暴露这个 API 是因为**有些场景用户就是要立刻看到变化**，0.5s 的防抖在登录切换后体验不对。给用户逃生门。

---

### 3.10 汇总完整代码

**文件**：`assets/src/core/reddot/RedCom.ts`

```typescript
import { _decorator, Component, Node, UITransform } from 'cc';
import { IRed } from './IRed';
import { Signal } from '../signal/Signal';
import { getRed } from './RedRegister';
import { RedDisplay } from './RedDisplay';
const { ccclass, property } = _decorator;

const RED_REFRESH_DEBOUNCE = 0.5;

/**
 * 红点组件：挂在任意 UI 节点上，填入 redKey 即完成所有接线。
 * —— 开发者唯一要接触的红点系统入口 ——
 */
@ccclass('RedCom')
export class RedCom extends Component {

    @property
    redKey: string = '';

    private _inst: IRed | null = null;
    private _signals: Signal<any>[] = [];
    private _display: RedDisplay | null = null;
    private _scheduled: boolean = false;

    onLoad(): void {
        const Ctor = getRed(this.redKey);
        if (!Ctor) {
            console.error(`[RedCom] redKey '${this.redKey}' not found. Did you import the class in RedAllReds.ts?`);
            return;
        }
        this._inst = new Ctor();
        this._inst.getSignals(this._signals);

        this._createDisplay();
    }

    onEnable(): void {
        if (!this._inst) return;
        for (const s of this._signals) s.add(this._markDirty, this);
        this._markDirty();
    }

    onDisable(): void {
        if (!this._inst) return;
        for (const s of this._signals) s.remove(this._markDirty, this);
        if (this._scheduled) {
            this.unschedule(this._refreshNow);
            this._scheduled = false;
        }
    }

    onDestroy(): void {
        this._inst = null;
        this._display = null;
        this._signals.length = 0;
    }

    refresh(): void {
        if (this._scheduled) {
            this.unschedule(this._refreshNow);
            this._scheduled = false;
        }
        this._refreshNow();
    }

    private _markDirty = (): void => {
        if (this._scheduled) return;
        this._scheduled = true;
        this.scheduleOnce(this._refreshNow, RED_REFRESH_DEBOUNCE);
    };

    private _refreshNow = (): void => {
        this._scheduled = false;
        if (!this._inst || !this._display) return;
        const isRed = this._inst.calcRed();
        this._display.setRed(isRed);
    };

    private _createDisplay(): void {
        const ut = this.node.getComponent(UITransform);
        if (!ut) {
            console.warn(`[RedCom] node '${this.node.name}' has no UITransform; skip.`);
            return;
        }

        const dotNode = new Node('RedDot');
        this.node.addChild(dotNode);
        dotNode.setPosition(
            (1 - ut.anchorX) * ut.width,
            (1 - ut.anchorY) * ut.height,
            0,
        );

        this._display = dotNode.addComponent(RedDisplay);
        this._display.setRed(false);
    }
}
```

---

## 4. 三种使用姿势

### 4.1 编辑器里挂（推荐）

1. 选中按钮节点
2. Inspector → Add Component → RedCom
3. 填 **Red Key**：`GearFreeBuyRed`

搞定。运行即生效。

### 4.2 代码动态挂（列表项场景）

```typescript
import { RedCom } from '../../core/reddot/RedCom';

const card = new Node('LevelCard');
// ... 布局组件 ...

const rc = card.addComponent(RedCom);
rc.redKey = 'LevelDoneRed';
```

> Cocos 的 `onLoad` 在下一帧才会执行，`redKey` 赋值时序没问题。

### 4.3 手动强刷（特殊场景）

```typescript
this.node.getComponent(RedCom)!.refresh();
```

账号切换、发奖结算等需要**立刻**看到红点变化的场景。

---

## 5. 验证清单

- [ ] 挂 `RedCom` + 有效 `redKey` + `calcRed` 返回 true → 右上角出现红点
- [ ] Signal `dispatch` 一次 → 500ms 后红点状态刷新
- [ ] 一秒内 `dispatch` 10 次 → `_refreshNow` 只执行 **1 次**（打 log 验证）
- [ ] `node.active = false` 后 `dispatch` → 回调不触发
- [ ] `node.active = true` 再激活 → 主动补刷一次，状态对齐最新
- [ ] 销毁父节点 → 无 warning / error，没有僵尸回调
- [ ] 填错 `redKey` → error log，父节点不崩
- [ ] 挂到无 `UITransform` 的节点 → warn，红点不创建但不崩
- [ ] 调 `refresh()` → 立刻刷新，不等 0.5s

---

## 6. 量化一下 "好用"

同一个需求——"给按钮加红点"——开发者要做的事：

| 步骤 | 本系统 |
|------|-------|
| 写业务逻辑 | 1 个 `implements IRed` 的类（10 行） |
| UI 挂载 | 挂 `RedCom` + 填 key（编辑器 30 秒） |
| 订阅 / 反订阅 | **0**（自动） |
| 防抖 | **0**（自动） |
| 自动定位 | **0**（自动） |
| 销毁清理 | **0**（自动） |

开发者触达文件数：**1 个**（业务红点类）。UI 挂组件都不算"写代码"。

---

## 7. 这阶段的局限 → 下一阶段解决

现在系统**基建完整**，但有一个没解决的问题：

> 关卡页有 10 个关卡，每个关卡都要一个独立红点。每个逻辑一模一样，只是 `levelId` 不同。总不能写 10 个 `@regRed("LevelDone_apple")` 吧？

下一章讲**参数化红点** —— [`06-parametric-red.md`](./06-parametric-red.md)。
