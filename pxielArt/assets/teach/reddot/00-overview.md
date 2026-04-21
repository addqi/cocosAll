# 红点系统 — 总览

> **目标读者**：没做过红点系统的 Cocos 新手。
> **学完你会得到**：一套"挂一个组件、填一个类名"就能工作的红点系统，开发者**只关心业务，不碰订阅/反订阅/冒泡**。
> **设计哲学**：让开发者只做两件事——写一个"怎么红"的类、UI 上挂一个组件。其他全交给框架。

---

## 1. 这套系统要解决什么问题

游戏里到处都是红点：

- 关卡选择页 → 没点过的关卡有红点
- 首页按钮 → 下面任何一个关卡有红点，按钮就亮
- 邮件图标 → 未读邮件数
- 活动 → 有奖可领就亮

这些看起来是 4 个功能，其实是**同一件事**：

> "这里有新东西，你还没处理。"

每个按钮各写一套，项目跑一年就烂。必须统一。

---

## 2. 开发者每加一个红点关心什么？

只有 4 件事：

1. **什么情况下该红？**（一个 bool 或数字计算）
2. **什么信号让我变脏？**（需要重算的触发源）
3. **红点的组合关系。**（子红了 → 父也红）
4. **红点 UI 的自动加载、显示、隐藏、销毁。**

这 4 件事里，只有 1 和 2 是**业务逻辑**，3 是**声明式的组合**，4 完全是**框架的事**。

本教程的所有设计都围绕："**让开发者只写 1/2/3，4 全自动**"。

---

## 3. 核心概念一览（先有个印象）

| 概念 | 做什么 | 代码形态 |
|------|-------|---------|
| `Signal<T>` | 类型安全的订阅/派发对象，**信号跟着数据走** | `static readonly xxxSignal = new Signal<...>()` |
| `IRed` | 红点身份的统一契约：`calcRed()` + `getSignals()` | `implements IRed` |
| `@regRed("Key")` | 把类注册到全局表，`getRed("Key")` 查询到 | 类装饰器 |
| `RedGroup` | 红点组合：子红任意一个就红；信号自动聚合 | `extends RedGroup` |
| `RedDisplay` | 红点视觉（纯显隐的 UI 组件） | Cocos Component |
| `RedCom` | **开发者唯一接触的入口**：挂在 Node 上填 `redKey` | Cocos Component |

---

## 4. 一个完整例子（看完你就懂整个思路）

需求：给"商店按钮"加红点，免费购买次数还没用就亮。

**① 定义红点逻辑**（业务文件里写一个类）：

```typescript
@regRed("GearFreeBuyRed")
export class GearFreeBuyRed implements IRed {
    calcRed(): boolean {
        return StoreService.hasFreeBuy();
    }
    getSignals(out: Signal<any>[]): void {
        out.push(StoreService.freeBuyChangedSignal);
    }
}
```

**② UI 侧挂组件**（编辑器或代码里）：

```typescript
const rc = storeBtn.addComponent(RedCom);
rc.redKey = "GearFreeBuyRed";
```

**结束**。业务代码触发 `StoreService.freeBuyChangedSignal.dispatch()` 时，红点会自动重算、自动显隐。节点销毁时自动反订阅，没有内存泄漏、没有样板代码。

---

## 5. 学习路径（8 章，由浅入深）

**基建篇（01~07）——把系统建出来**：

| 章 | 标题 | 你会得到什么 | 代码产出 |
|---|------|-------------|---------|
| **01** | [Signal](./01-signal.md) | 类型安全的事件机制 | `Signal.ts` |
| **02** | [IRed 与 @regRed](./02-ired-and-regred.md) | 红点身份契约 + 字符串注册表 | `IRed.ts` / `RedRegister.ts` |
| **03** | [RedGroup](./03-redgroup.md) | 红点组合（冒泡的替代方案） | `RedGroup.ts` |
| **04** | [RedDisplay](./04-reddisplay.md) | 红点视觉组件 | `RedDisplay.ts` |
| **05** | [RedCom](./05-redcom.md) | 挂一个组件搞定所有接线 | `RedCom.ts` |
| **06** | [参数化红点](./06-parametric-red.md) | 列表场景（N 个关卡共用一套逻辑） | `RedFactory`（扩展 RedRegister） |
| **07** | [实战接入](./07-integration.md) | 在本项目里真的加一个关卡红点 | 项目改动 |

**进阶篇（08~）——让系统更强**：

| 章 | 标题 | 你会得到什么 | 代码产出 |
|---|------|-------------|---------|
| **08** | [数量化红点](./08-red-count.md) | 红点从 bool 升级到 count；聚合策略 SUM/COUNT；显示模式 DOT_ONLY/NUMBER/AUTO；**策划改显示方式不改代码** | `IRed` / `RedGroup` / `RedCom` / `RedDisplay` 升级 |

> 基建篇是**地基**——必须全走完。进阶篇按需要挑着学：没遇到相关痛点就先跳过，遇到了回来补。

每章严格遵守同一结构：

1. **要解决什么问题**（场景驱动，不空谈）
2. **Linus 式三连问**（数据结构 / 特殊情况 / 复杂度）
3. **分步实现**——每一步 = **一个需求 + 对应那一段代码 + 为什么**
4. **这阶段的局限 → 下一阶段解决**

> ⚠️ **不要跳章**。基建层的 API 设计会被后面所有章沿用，跳了就地基不稳。

---

## 6. 设计原则（贯穿全系列）

### 6.1 数据结构优先于代码

> "Bad programmers worry about the code. Good programmers worry about data structures." — Linus

**`Signal` 是字段不是字符串**、**`IRed` 是类不是配置项**、**`RedGroup` 是显式的 `children` 数组**——每一个都是精心选的数据结构，决定了上层代码的简洁度。

### 6.2 存事实，不存派生状态

**"是否有红点"**不是事实，**"玩家已看过哪些关卡"**才是事实。存事实，红点数现算。

```
❌ 差：存 hasRedDot: boolean
✅ 好：存 seenLevels: Set<string>，红点 = !seenLevels.has(id)
```

### 6.3 信号跟着数据走

谁持有数据，谁就持有"数据变了"的信号：

```typescript
class StorageService {
    static readonly levelDoneChangedSignal = new Signal<string>();  // 信号是 Service 的字段
}
```

**不要**拿字符串事件名做全局事件总线——字符串打错编译器不管你。

### 6.4 框架不碰业务类

`IRed` / `RedGroup` 里**没有一行 Cocos 代码**。业务红点类可以直接 `new` 出来跑单测，零 Cocos 依赖。

### 6.5 先跑通，再优化

章节顺序按"一旦完成就能验证"排。**每章结束都能独立跑一个 demo**，不会出现"看三章还没东西能跑"的情况。

---

## 7. 最终代码目录（全部做完后）

```
assets/
├── teach/reddot/                    ← 本教程
│   └── 00-overview.md ~ 07-integration.md
│
└── src/
    ├── core/signal/
    │   └── Signal.ts               ← 01 章产出
    │
    └── core/reddot/
        ├── IRed.ts                 ← 02 章产出
        ├── RedRegister.ts          ← 02 章产出（含 @regRed / getRed）
        ├── RedGroup.ts             ← 03 章产出
        ├── RedDisplay.ts           ← 04 章产出
        ├── RedCom.ts               ← 05 章产出
        ├── RedAllReds.ts           ← 02 章引入，每章持续追加
        │
        └── reds/                   ← 业务红点类（07 章开始添）
            ├── LevelDoneRed.ts
            ├── HomeLevelRed.ts
            └── ...
```

> 每章只新增它需要的部分，不用一次性建完。

---

## 8. 开工前最后一句

> **"好的架构不是你能用它做多少事，而是它不强迫你做多少事。"**

这套系统的**唯一目的**是：让你后面加第 50 个红点时，和加第 1 个一样快、一样安全。

准备好了就翻开 [`01-signal.md`](./01-signal.md)。
