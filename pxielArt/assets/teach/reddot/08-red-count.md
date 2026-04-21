# Stage 08 — 数量化红点：从 boolean 到 count

> **这一阶段结束，你会得到**：`IRed` 升级为 `calcCount`、`RedGroup` 支持"求和 / 存在计数"两种聚合策略、`RedCom` 新增显示模式开关（纯红点 / 数字 / 自动）、`RedDisplay` 能画数字。策划说"这个改成只显示红点"——编辑器里点一下下拉菜单就行，代码一行不动。
> **前置**：Stage 01~07（必须先走完）。
> **代码量**：5 个文件合计新增/改动约 80 行。

---

## 1. 要解决什么问题

走完 01~07 你的红点系统有 7 件东西：Signal / IRed / RedGroup / RedDisplay / RedCom / Factory / 业务接入。**所有红点只回答"红不红"（boolean）**。

现在策划连续抛三个需求：

1. **邮件按钮**：显示"3 封未读"而不是一个圆点。
2. **首页按键**：下面有 **关卡 / 邮件 / 活动** 3 个入口；只要有入口有事就显示数字——但显示的不是"总待办数"，是"**几个入口有事**"（即 1/2/3）。
3. **关卡入口**：原来要显示"3 关没过"，**后来策划又反悔了**："不用数字，有就红点就行"。

现有系统**三个都做不到**：

| 需求 | 现状 | 差距 |
|------|------|------|
| 邮件显示 3 | `calcRed` 只返 boolean | 要数量概念 |
| 首页显示"几个入口有事" | `RedGroup` 聚合只算"任一子红" | 要"存在计数"聚合策略 |
| 策划临时改主意"只要红点不要数字" | 显示硬编码 | 要显示模式开关 |

这三件事看起来相似，实际是**三个独立维度**。本章把它们**各就各位**。

---

## 2. 先把三个维度拆开

这是本章最重要的一张表。**想不清楚这张表，代码写出来一定是混乱的。**

| 维度 | 问题 | 决定者 | 类型 |
|---|---|---|---|
| ① **叶子语义** | 我这个叶子贡献几个单位？ | 叶子类自己 | 写不同的类 |
| ② **聚合语义** | 父怎么合并子的数量？ | `RedGroup` 的 `aggregation` 字段 | `SUM` / `COUNT` 枚举 |
| ③ **显示语义** | 把 count 数字画成什么？ | `RedCom` 的 `displayMode` 字段 | `DOT_ONLY` / `NUMBER_ONLY` / `AUTO` 枚举 |

**三个维度互相独立**。改一个不影响另外两个。

### 🟢 数据结构（Linus 第一追问）

管道模型：

```
叶子 calcCount() → number
   │
Group calcCount() = 按策略合并子的 calcCount()
   │
RedCom → count 传给 Display + 把 displayMode 一起传过去
   │
Display setCount(count, mode) → 渲染
```

**数字是一根从底向上的直通管道**。每一层只做一件事：
- 叶子：**把业务数据翻译成数字**。
- Group：**合并数字**。
- Display：**渲染数字**。

### 🟡 特殊情况（Linus 第二追问）

| 坏写法 | 好写法 |
|---|---|
| 叶子返回 `boolean`，Group 算 "是否有子红" | 叶子返回 `number`，Group 算 "合并数字"（统一一种类型） |
| Group 里硬编码聚合方式（永远求和） | 加一个 `aggregation` 字段，两种语义同一个类支持 |
| Display 永远显示数字 | 加 `mode` 参数，圆点/数字/自动三选一 |
| 用 `bool dotOnly` 开关 | 用 `enum RedDisplayMode`，未来能扩展（比如加 `STAR` 模式） |

### 🔴 复杂度（Linus 第三追问）

- `IRed` 改一个方法名：`calcRed() → calcCount()`。
- `RedGroup` 加一个字段（10 行）。
- `RedCom` 加一个字段 + 改 2 行。
- `RedDisplay` 加 Label 子节点 + 扩展 `setRed` 为 `setCount`。

合计 ~80 行。**换来三种维度完全解耦**。

---

## 3. 分步实现

### 3.1 需求：把 `IRed` 契约从布尔升级到数字

**文件**：`assets/src/core/reddot/IRed.ts`（修改）

```typescript
import { Signal } from "./Signal";

export interface IRed {
    /** 当前红点的数量（0 = 不红；>0 = 红，具体多少由叶子决定） */
    calcCount(): number;

    /** 把"会导致我变脏"的所有信号 push 到 out 数组里 */
    getSignals(out: Signal<any>[]): void;
}
```

**为什么**：

- **删掉 `calcRed`**。"红不红" = `calcCount() > 0`——一个方法回答两个问题。Linus 经典的"**消除特殊情况**"。
- **返回 `number` 而不是 `{ count: number, isRed: boolean }` 对象**：
    - 对象每次都 new，GC 压力。
    - number 一个值等价表达"红/不红 + 数量"。
    - **数据结构选错，上层代码翻倍**。
- **注释明确 `0 = 不红`**：避免将来有人疑惑"负数算啥？"——**负数禁止**，这是约定。

⚠️ **向后兼容警告**：所有叶子红点类原本的 `calcRed(): boolean` 都要改成 `calcCount(): number`。好消息是：**你之前章节大概率只有 1~2 个叶子类**（本 Demo 里就 1 个 `LevelRed`）。

---

### 3.2 需求：`RedGroup` 支持两种聚合策略

**文件**：`assets/src/core/reddot/RedGroup.ts`（完全重写）

```typescript
import { IRed } from './IRed';
import { Signal } from './Signal';

/**
 * 聚合策略：决定父 Group 如何合并子的数量
 */
export enum GroupAggregation {
    /** 求和：子的 count 累加起来（典型场景：关卡组要显示"3 个新关卡"） */
    SUM = 0,
    /** 存在计数：统计"有几个子是红的"（典型场景：首页要显示"3 个入口有事"） */
    COUNT = 1,
}

export abstract class RedGroup implements IRed {
    protected abstract children: IRed[];

    /** 聚合策略，子类可覆盖；默认 SUM（最常见） */
    protected aggregation: GroupAggregation = GroupAggregation.SUM;

    calcCount(): number {
        let total = 0;
        for (let i = this.children.length - 1; i >= 0; --i) {
            const c = this.children[i].calcCount();
            if (this.aggregation === GroupAggregation.SUM) {
                total += c;
            } else {
                total += c > 0 ? 1 : 0;
            }
        }
        return total;
    }

    getSignals(out: Signal<any>[]): void {
        for (let i = this.children.length - 1; i >= 0; --i) {
            this.children[i].getSignals(out);
        }
    }
}
```

**为什么**：

- **`GroupAggregation` 用 `enum` 而不是 `'sum' | 'count'` 字符串联合**：Cocos 编辑器能用 `Enum()` 包装做下拉菜单（下一节 `RedCom` 里会看到）；字符串联合在编辑器里是文本框。
- **`aggregation` 放基类字段、子类 override**：子类写 `protected aggregation = GroupAggregation.COUNT`，清楚明确；不需要构造参数。
- **默认值 SUM**：90% 场景都是求和；改成 COUNT 是少数情况，显式标记更合理。
- **为什么不提第三种聚合（比如 `MAX`）**：当前没需求。**实际痛了再加**，Linus 原则"不解决臆想的问题"。

#### 算法图示

假设结构：

```
HomeTopGroup (aggregation = COUNT)
├─ LevelGroup (aggregation = SUM, children: 10 个 LevelRed)
│      假设其中 3 个叶子返回 1 → LevelGroup.calcCount() = 3
├─ MailRed (叶子，返回 0 或 1；有 3 封未读 → 1)
└─ ActivityRed (叶子，返回活动数；有 2 个新 → 2)
```

计算过程：

```
HomeTopGroup.calcCount()  [mode = COUNT]
    = (LevelGroup.calcCount() > 0 ? 1 : 0)  = 3 > 0 ? 1 : 0  = 1
    + (MailRed.calcCount() > 0 ? 1 : 0)     = 1 > 0 ? 1 : 0  = 1
    + (ActivityRed.calcCount() > 0 ? 1 : 0) = 2 > 0 ? 1 : 0  = 1
    = 3

LevelGroup.calcCount()  [mode = SUM]
    = 1 + 1 + 1 + 0 + 0 + ... = 3（数量累加）
```

**同一棵树**：顶层显示 **3（3 个入口有事）**，关卡入口显示 **3（3 个新关卡）**。两处都对。

---

### 3.3 需求：`RedCom` 加显示模式枚举

**文件**：`assets/src/core/reddot/RedCom.ts`（修改）

#### 3.3.1 定义枚举

在文件顶部（或独立文件 `RedDisplayMode.ts` 里，本教程为简化放一起）：

```typescript
/**
 * 红点显示模式：决定把 count 数字怎么画出来
 */
export enum RedDisplayMode {
    /** 只画小圆点，永不显示数字（策划说"有就行不要数字"用这个） */
    DOT_ONLY = 0,
    /** 永远显示数字（count >= 1 时显示"1"，> 99 显示"99+"） */
    NUMBER_ONLY = 1,
    /** 自动（微信风格）：count = 1 只画圆点；count > 1 显示数字 */
    AUTO = 2,
}
```

#### 3.3.2 加 `@property` 字段

```typescript
import { _decorator, Component, Node, UITransform, Enum } from 'cc';
import { RedDisplay } from './RedDisplay';
// ... 其他 import 不变

const { ccclass, property } = _decorator;

@ccclass('RedCom')
export class RedCom extends Component {

    @property
    redKey: string = '';

    @property({ type: Enum(RedDisplayMode) })
    displayMode: RedDisplayMode = RedDisplayMode.AUTO;

    // ... 其他字段不变
}
```

**为什么**：
- **`Enum(RedDisplayMode)`**：Cocos 提供的元工具，把 TS 枚举转成编辑器能识别的枚举类型。**这一步不加**，编辑器里只显示一个 number 输入框，不是下拉。
- **默认 `AUTO`**：最自然的视觉体验（小数量淡化、大数量强调）。需要特定行为时编辑器里选。

#### 3.3.3 `_refreshNow` 调用 Display 时带上 mode

```typescript
private _refreshNow = (): void => {
    this._scheduled = false;
    if (!this._inst || !this._display) return;
    const count = this._inst.calcCount();
    this._display.setCount(count, this.displayMode);
};
```

**为什么**：
- **`displayMode` 不缓存在字段里传递**：直接读 `this.displayMode`，编辑器改了立刻生效。
- **把 mode 作为参数每次传过去**：`RedDisplay` 不存 mode——**无状态更好**，RedCom 想改 mode 也影响不到 Display 的内部记忆。

---

### 3.4 需求：`RedDisplay` 画出数字

这一步最实质。`RedDisplay` 原来只有一个圆点，现在要加一个 Label 子节点。

**文件**：`assets/src/core/reddot/RedDisplay.ts`（完全重写）

```typescript
import { _decorator, Color, Component, Graphics, Label, Node, UITransform } from 'cc';
import { RedDisplayMode } from './RedCom';
const { ccclass } = _decorator;

@ccclass('RedDisplay')
export class RedDisplay extends Component {
    private _label: Label | null = null;

    protected onLoad(): void {
        const ut = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
        ut.setContentSize(20, 20);

        const g = this.node.getComponent(Graphics) ?? this.node.addComponent(Graphics);
        g.clear();
        g.circle(0, 0, 10);
        g.fillColor = new Color(244, 67, 54);
        g.fill();

        const labelNode = new Node('Count');
        this.node.addChild(labelNode);
        const labelUT = labelNode.addComponent(UITransform);
        labelUT.setContentSize(20, 20);

        this._label = labelNode.addComponent(Label);
        this._label.fontSize = 12;
        this._label.color = new Color(255, 255, 255);
        this._label.horizontalAlign = Label.HorizontalAlign.CENTER;
        this._label.verticalAlign = Label.VerticalAlign.CENTER;
        this._label.string = '';
    }

    setCount(count: number, mode: RedDisplayMode): void {
        this.node.active = count > 0;
        if (!this._label) return;

        if (count <= 0) {
            this._label.string = '';
            return;
        }
        if (mode === RedDisplayMode.DOT_ONLY) {
            this._label.string = '';
        } else if (mode === RedDisplayMode.NUMBER_ONLY) {
            this._label.string = count > 99 ? '99+' : String(count);
        } else {
            this._label.string = count === 1 ? '' : (count > 99 ? '99+' : String(count));
        }
    }
}
```

**为什么**：

- **`setContentSize(20, 20)`**：从原来的 `16×16` 放大到 `20×20`——要装下数字（比如"99+"）。单个圆点也好看。
- **Label 子节点而不是 `this.node.addComponent(Label)`**：
    - 同节点上 `Graphics` + `Label` 会因为 transform/z-order 冲突导致奇怪显示。
    - 子节点位置 `(0, 0)` 自然居中在圆点中央。
- **`fontSize = 12`**：小号字。20px 节点装得下 1~2 位数字。
- **`setCount` 的三段分支**：
    - `count <= 0` → 隐藏整个节点 + 清空 label。两个操作都要做：节点 `active = false` 时 label 内容不刷新也能被用户看到。
    - `DOT_ONLY` → label 恒空，只看到圆点。
    - `NUMBER_ONLY` → 恒显示数字（甚至 1 也显示）。
    - `AUTO` → 1 只画圆点（微信就这样），大于 1 才显示数字。
- **`count > 99 ? '99+'`**：电商和 IM 的标准处理。三位数字超出标签范围。

⚠️ **依赖循环警告**：`RedDisplay` 导入了 `RedDisplayMode` from `./RedCom`，而 `RedCom` 导入了 `RedDisplay`。TS 能处理这种循环（因为 enum 是值，Display 里只用它做参数类型），但**如果出问题**，把 `RedDisplayMode` 抽到单独文件 `RedDisplayMode.ts` 即可。

---

### 3.5 需求：把叶子红点类改成返回数字

**文件**：`assets/src/core/reddot/demo/LevelRed.ts`（修改 `LevelRed` 类）

```typescript
class LevelRed implements IRed {
    constructor(private readonly id: number) { }

    calcCount(): number {
        return LevelClickTracker.has(this.id) ? 1 : 0;
    }

    getSignals(out: Signal<any>[]): void {
        out.push(LevelClickTracker.changed);
    }
}
```

**为什么**：
- **单关卡就是"要么 0 要么 1"**：一个按钮"点过没点过"，只有两种状态，贡献值天然是 0/1。
- **叶子内部 `? 1 : 0` 不是 `? true : false`**：接口改了，类型要对上。
- **这就是"叶子封装语义"**：`LevelRed` 永远贡献 0/1，不提供"我要返回真实数字"的开关——**要别的语义就写别的类**。

下一章如果策划要"邮件类": 

```typescript
class MailRed implements IRed {
    calcCount(): number {
        return MailService.unreadCount;  // 直接返回 3
    }
    getSignals(out: Signal<any>[]) {
        out.push(MailService.unreadChanged);
    }
}
```

**类名即语义**，一目了然。

---

### 3.6 需求：`AnyLevelRedGroup` 明确聚合策略

**文件**：同 `LevelRed.ts`，修改 `AnyLevelRedGroup`

```typescript
import { GroupAggregation, RedGroup } from '../RedGroup';

class AnyLevelRedGroup extends RedGroup {
    protected aggregation = GroupAggregation.SUM;  // 10 个关卡中亮了几个 → 显示几

    protected children: IRed[] = Array.from(
        { length: LEVEL_COUNT },
        (_, i) => new LevelRed(i),
    );
}
```

**为什么**：
- **显式 SUM**：虽然 `RedGroup` 默认就是 SUM，但**写出来比不写好**——读代码的人一眼看到"这个 group 是求和"，不用翻基类。
- **关卡数 = 点亮叶子数**：每个叶子贡献 0/1，SUM 结果刚好是"有几个红"。

这里有个小哲学问题：

> "SUM 10 个 0/1 的叶子" 和 "COUNT 10 个叶子" 结果一样啊？

**表面上一样**。但语义不同：
- SUM：我假设子是"数量贡献者"，全部加起来。
- COUNT：我不管子具体贡献多少，只看"红没红"。

两种写法对这个 demo 等价。**真实差别**出现在**嵌套组**里：

```
HomeTopGroup (想显示"几个入口有事")
├─ MailRed 贡献 3（未读 3 封，数量模式叶子）
├─ LevelGroup (SUM，有 2 关没过 → 贡献 2)
└─ ActivityRed 贡献 0

COUNT 聚合结果：1 + 1 + 0 = 2（有 2 个入口有事）✓
SUM 聚合结果：3 + 2 + 0 = 5（总待办数 5）—— 不是策划要的
```

**嵌套越深，两种语义差距越大**。这就是 `aggregation` 字段存在的意义。

---

## 4. 完整案例对照表

不同需求 × 不同参数组合 = 不同效果：

| 场景 | 叶子 calcCount | Group aggregation | RedCom displayMode | 呈现 |
|---|---|---|---|---|
| 单个关卡卡片（未通关即红） | 0/1 | 无 | AUTO | ● |
| 关卡入口"3 关未通" | 0/1 | SUM | NUMBER_ONLY 或 AUTO | 3 |
| 关卡入口改口"只显示红点" | 0/1 | SUM | **DOT_ONLY** | ● |
| 邮件按钮"3 封未读" | 返回真实 `unreadCount` | 无 | NUMBER_ONLY | 3 |
| 邮件按钮改口"只要红点" | 返回真实 `unreadCount` | 无 | **DOT_ONLY** | ● |
| 首页"几个入口有事" | 各自 | **COUNT** | NUMBER_ONLY | 2 |
| 首页改口"总待办数" | 各自 | **SUM** | NUMBER_ONLY | 5 |

**关键观察**：
- 策划每次改口，**都只改一个字段**。
- 改 `displayMode` 不需要改代码，只在**编辑器里选下拉**。
- 改 `aggregation` 要改一个字段赋值，**一行代码**。
- 改叶子语义（数量 → 存在）要改叶子类，**3 行代码**。

---

## 5. 汇总：完整改动清单

| 文件 | 改动范围 | 为什么 |
|---|---|---|
| `IRed.ts` | `calcRed → calcCount` | 数字是一等公民 |
| `RedGroup.ts` | 加 `GroupAggregation` 枚举 + `aggregation` 字段 | 支持两种聚合语义 |
| `RedCom.ts` | 加 `RedDisplayMode` 枚举 + `displayMode` 字段；`_refreshNow` 调 `setCount` | 显示模式对策划开放 |
| `RedDisplay.ts` | 加 Label 子节点 + `setCount(count, mode)` | 真能画数字 |
| `demo/LevelRed.ts` | `calcRed → calcCount`；`AnyLevelRedGroup` 显式 SUM | 跟上接口 |

---

## 6. 验证清单

实现完后按这个单子检查：

- [ ] 场景里点 `Btn_3` → 0.5s 后 Btn_3 出现红圆点（AUTO 模式下 count=1 只画圆点）
- [ ] Any 按钮显示 **"1"** （SUM 下 1 个子红 = count 1，AUTO 下 1 不显示数字）——等等，应该显示 **●** 圆点才对
- [ ] 多点几个，直到 `Btn_0 / Btn_1 / Btn_2 / Btn_3` 都红 → Any 按钮显示 **"4"**
- [ ] 编辑器里把 Any 按钮的 `RedCom.displayMode` 改成 `NUMBER_ONLY` → Any 显示 "1"（即使只有 1 个子红）
- [ ] 编辑器里改成 `DOT_ONLY` → 无论几个子红，Any 只显示圆点
- [ ] 全部关掉 → 所有红点消失

**最重要的一步：改 displayMode 过程中，`LevelRed.ts` 一行代码没动**。这就是"维度解耦"的价值。

---

## 7. 这阶段的局限 → 下一阶段解决

你现在能满足**策划临时改显示方式**的大多数需求，但**还有两个痛点**：

### 痛点 A：`redKey` 还是字符串，容易打错

```typescript
rc.redKey = 'LeveDone';   // 漏了 L，编译器不管你
rc.redKey = 'leveldone';  // 大小写错，编译器不管你
```

**Stage 09** 会引入 **`RedKey` 枚举**，让 TS 帮你查错。

### 痛点 B：每加一个红点要改 2~3 个文件

- `reds/XxxRed.ts` 写类
- `RedAllReds.ts` import 触发注册
- 如果是工厂参数化：还要在某个入口文件手工循环注册

策划说"加 10 个新关卡"，你要改代码。**不够工业化**。

**Stage 10**（预留）会引入 **excel → 代码生成**，策划改表格，工具自动生成 `RedKey` 枚举 + 配置表。那时候：

- 加新红点 = excel 加一行。
- `displayMode` / `aggregation` 默认值 = excel 填一列。
- 程序代码只管**红点类的业务逻辑**，不管清单和配置。

但 Stage 10 在你完全吃透 Stage 08 之前**不要做**——那是大项目才需要的工具链。

---

## 8. 设计讨论：为什么不用 `bool dotOnly` 而要 `enum`

对比两种设计：

```typescript
// 方案 A：布尔开关
@property dotOnly: boolean = false;

// 方案 B：枚举
@property({ type: Enum(RedDisplayMode) })
displayMode: RedDisplayMode = RedDisplayMode.AUTO;
```

### 方案 A（布尔）

- 只能表达 2 种状态。
- 产品下周要加"显示星星"、"显示 VIP 标"—— `dotOnly` 按不下。
- 不得不再加 `showStar`、`showVIP` 布尔——**状态爆炸**。
- `dotOnly = false && showStar = false` 是什么意思？**边界情况失控**。

### 方案 B（枚举）

- 互斥模式，逻辑干净。
- 新增模式加一个 enum 值 + `setCount` 里加一个 `case`。
- 编辑器下拉菜单，策划一目了然。

**Linus 原则**："**能用 enum 不用 bool**"——enum 让非法状态**无法表达**。

---

## 9. 常见坑

### 坑 1：忘了改所有叶子类

`IRed` 改了之后，**所有叶子红点**都要跟着改 `calcRed → calcCount`。漏一个 TS 立刻报错，**这是好事**——编译器帮你找。

### 坑 2：`setCount` 里忘了隐藏节点

```typescript
// ❌ 坏：只改 label，节点一直在
this._label.string = String(count);

// ✅ 好：count=0 时隐藏整个节点
this.node.active = count > 0;
if (count > 0) this._label.string = ...;
```

只改 label 字符串而不隐藏节点，会看到一个 16×16 的红圆点一直亮着（label 是空的）。

### 坑 3：嵌套组聚合策略写错

```typescript
class HomeTopGroup extends RedGroup {
    protected aggregation = GroupAggregation.SUM;  // ⚠️ 想显示"几个入口有事"却用 SUM
    protected children = [
        new LevelGroup(),  // 内部贡献 3
        new MailRed(),     // 贡献 2
    ];
}

// SUM: 3 + 2 = 5（总待办数）
// COUNT: 1 + 1 = 2（2 个入口有事） ← 策划要的
```

**每次写嵌套 group 都重问一下**："这里策划要'总数'还是'类别数'？"

### 坑 4：Label 字号和节点尺寸不匹配

Label 字号 14，节点 20×20——字挤到看不清。要么把节点放大到 24×24，要么字号降到 10。**UI 尺寸是细活，肉眼调**。

### 坑 5：`Enum(RedDisplayMode)` 写成 `type: RedDisplayMode`

```typescript
// ❌ 坏：编辑器识别不了
@property({ type: RedDisplayMode }) displayMode = RedDisplayMode.AUTO;

// ✅ 好：用 Enum() 包装
@property({ type: Enum(RedDisplayMode) }) displayMode = RedDisplayMode.AUTO;
```

**TS 枚举 ≠ Cocos 编辑器枚举**。`Enum()` 是桥梁。

---

## 10. 一句话总结

> **数字是一根从叶到根的管道；三个维度各就各位：**
> - **叶子**：我贡献几个单位？（类代码写死）
> - **Group**：我怎么合并子？（`aggregation` 字段）
> - **UI**：我怎么画数字？（`displayMode` 字段）
>
> **策划改显示方式 = 编辑器下拉换一下，代码零改动。**

---

## 11. 动手建议

走完本章你有了**完整的数量能力**。但**代码本章不帮你写**——按 `3.1 ~ 3.6` 的顺序自己敲一遍，每敲一段立刻跑起来看效果。**手敲是吃透设计的唯一方式**。

如果卡住：
1. **TS 报错** → 多半是某个叶子类没改 `calcRed → calcCount`，报错信息直接指出来。
2. **红点不显示数字** → 检查 `displayMode` 是不是还在 `AUTO` 且 count=1（那就是应该只显示圆点，不是 bug）。
3. **Any 按钮数字对不上** → 检查 `AnyLevelRedGroup.aggregation` 是 SUM 还是 COUNT。

---

回到索引：[`00-overview.md`](./00-overview.md)
下一章（预留）：**Stage 09 — RedKey 枚举**。
