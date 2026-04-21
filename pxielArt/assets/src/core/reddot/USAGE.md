# 红点系统使用手册

> 本手册不讲原理（原理看 `teach/reddot/00-overview.md ~ 08-red-count.md`），只讲"**我要加一个红点，该怎么做**"。

---

## 📁 目录速查

```
core/reddot/
├── 基建（不动）
│   ├── Signal.ts           订阅/派发
│   ├── IRed.ts             红点契约接口（calcCount + getSignals）
│   ├── RedRegister.ts      字符串 key 注册表
│   ├── RedGroup.ts         红点组合基类（支持 SUM / COUNT 聚合）
│   ├── RedDisplay.ts       红点视觉组件（圆点 + 数字 Label）
│   ├── RedCom.ts           挂在节点上的入口组件（带 displayMode）
│   └── RedAllReds.ts       启动注册索引（集中 import）
│
├── TestRed.ts              Demo 场景：2×5 按钮 + Any 父红点
│
└── demo/                   Demo 业务代码（参考样板）
    ├── GameEvents.ts       业务事件总线
    ├── LevelClickTracker.ts 业务状态数据
    └── LevelRed.ts         红点类 + 工厂注册
```

---

## 🎯 核心理念（30 秒搞懂）

开发者加一个红点，**只做两件事**：

1. **写一个"怎么红"的类**（读哪个业务状态、订阅哪个业务 Signal，返回一个**数字**）。
2. **UI 上挂 `RedCom` 组件，填 `redKey` 字符串，选 `displayMode`。**

剩下的全自动：自动订阅、自动重算、自动显隐、自动销毁反订阅、零内存泄漏。

---

## 🧩 数字是一等公民（先搞懂这 3 个维度）

红点系统围绕 **"数量 count"** 工作，**不是 boolean**。有 3 个独立维度：

| 维度 | 谁决定 | 典型值 | 说明 |
|---|---|---|---|
| ① **叶子数量语义** | 叶子类代码 | `0/1` 或 `真实数` | 自己决定贡献多少 |
| ② **Group 聚合语义** | `RedGroup.aggregation` | `SUM` / `COUNT` | 父节点怎么合并子的数字 |
| ③ **UI 显示语义** | `RedCom.displayMode` | `DOT_ONLY` / `NUMBER_ONLY` / `AUTO` | 数字画成什么样 |

**三个维度互相独立**。改一个不影响另外两个。

### 三个维度具体说什么

**维度 ①：叶子贡献几个**
```typescript
// 存在模式：0/1（邮件入口只占 1 格）
class MailRed  { calcCount() { return MailService.hasUnread() ? 1 : 0; } }

// 数量模式：真实数（要显示 3 封未读）
class MailRed2 { calcCount() { return MailService.unreadCount; } }
```

**维度 ②：Group 怎么合并子**
```typescript
class LevelGroup extends RedGroup {
    protected aggregation = GroupAggregation.SUM;   // 3 关有红 → Group 算 3
}
class HomeTopGroup extends RedGroup {
    protected aggregation = GroupAggregation.COUNT; // 3 类入口有红 → Group 算 3
}
```

**维度 ③：UI 怎么画**
| displayMode | 效果 |
|---|---|
| `DOT_ONLY` | 永远只显示圆点（策划说"有就行，不要数字"） |
| `NUMBER_ONLY` | count>0 永远显示数字（包括 "1"），>99 显示 "99+" |
| `AUTO`（默认） | 微信风格：count=1 只显示圆点；count>1 显示数字 |

---

## 📐 三条铁律（违反必踩坑）

### 铁律 1：存事实，不存派生状态

> ❌ 差：存 `hasRedDot: boolean` 或 `redCount: number`
> ✅ 好：存 `seenLevels: Set<string>`，红点数量 = 从 seenLevels 现算

派生值永远**现算**，"红/数量"不是事实。

### 铁律 2：改数据 + 派发 Signal，永远成对

```typescript
static setRead(id: string): void {
    if (this._read.has(id)) return;    // 没变就别派发
    this._read.add(id);                 // 改事实
    this.changedSignal.dispatch();      // 派发信号
}
```

**封装到一个方法里**，外部一行调用，永远不会漏。

### 铁律 3：红点只"寄生"业务，不"侵入"业务

- 红点类**只读**业务数据。
- 业务代码里**不 import 任何红点模块**。
- 删掉整个 `reddot/` 业务照跑。

---

## 🚀 四种典型场景的标准做法

### 场景 A：独立红点（商店、邮件、首页汇总）

**例子**：商店有免费购买次数时亮红点；策划说"只要有就亮红点，不显示次数"。

#### ① 业务状态（业务原本就有，**不为红点增加代码**）

```typescript
// game/StoreService.ts
export class StoreService {
    static freeBuyCount: number = 0;
    static readonly freeBuyChanged: Signal<void> = new Signal<void>();

    static useFreeBuy(): void {
        if (this.freeBuyCount <= 0) return;
        this.freeBuyCount--;
        this.freeBuyChanged.dispatch();
    }
}
```

#### ② 红点类（`calcCount` 返回 0/1）

```typescript
// reds/StoreFreeBuyRed.ts
import { IRed } from '../core/reddot/IRed';
import { Signal } from '../core/reddot/Signal';
import { regRed } from '../core/reddot/RedRegister';
import { StoreService } from '../game/StoreService';

@regRed('StoreFreeBuy')
export class StoreFreeBuyRed implements IRed {
    calcCount(): number {
        return StoreService.freeBuyCount > 0 ? 1 : 0;
    }
    getSignals(out: Signal<any>[]): void {
        out.push(StoreService.freeBuyChanged);
    }
}
```

#### ③ UI 挂组件

**编辑器方式（推荐）**：
- 选中商店按钮节点 → Add Component → `RedCom`
- `redKey = "StoreFreeBuy"`
- `displayMode = DOT_ONLY`（策划要求"不显示数字"）

**代码方式**：
```typescript
const rc = storeBtnNode.addComponent(RedCom);
rc.redKey = 'StoreFreeBuy';
rc.displayMode = RedDisplayMode.DOT_ONLY;
```

#### ④ 让注册生效

在 `RedAllReds.ts` 加一行 import：

```typescript
import '../reds/StoreFreeBuyRed';
```

**完成**。

---

### 场景 B：列表红点（N 个关卡、N 个活动、N 个任务）

**例子**：10 个关卡卡片，每个卡片未通关时亮红点（每张卡只显示圆点）。

#### ① 业务状态

```typescript
// game/LevelManager.ts
export class LevelManager {
    private static _completed: Set<string> = new Set();
    static readonly completedChanged: Signal<void> = new Signal<void>();

    static complete(id: string): void {
        if (this._completed.has(id)) return;
        this._completed.add(id);
        this.completedChanged.dispatch();
    }
    static isCompleted(id: string): boolean {
        return this._completed.has(id);
    }
}
```

#### ② 参数化红点类（只写一份）

```typescript
// reds/LevelDoneRed.ts
import { IRed } from '../core/reddot/IRed';
import { Signal } from '../core/reddot/Signal';
import { regRedFactory } from '../core/reddot/RedRegister';
import { LevelManager } from '../game/LevelManager';

const LEVEL_IDS = ['apple', 'banana', 'cherry', /* ... */];

class LevelDoneRed implements IRed {
    constructor(private readonly id: string) { }
    calcCount(): number {
        return LevelManager.isCompleted(this.id) ? 0 : 1;
    }
    getSignals(out: Signal<any>[]): void {
        out.push(LevelManager.completedChanged);
    }
}

let _registered = false;
export function registerLevelDoneReds(): void {
    if (_registered) return;
    _registered = true;
    for (const id of LEVEL_IDS) {
        regRedFactory(`LevelDone_${id}`, () => new LevelDoneRed(id));
    }
}
```

#### ③ UI 挂组件

```typescript
const rc = cardNode.addComponent(RedCom);
rc.redKey = `LevelDone_${levelId}`;
rc.displayMode = RedDisplayMode.AUTO;   // 单关卡 count=1 → 只显示圆点
```

#### ④ 启动注册

```typescript
// RedAllReds.ts
import { registerLevelDoneReds } from '../reds/LevelDoneRed';
registerLevelDoneReds();
```

**完成**。100 个关卡也是这 4 步，代码量不变。

---

### 场景 C：父红点聚合子红点（首页入口 / 侧边栏）

**例子**：首页"关卡入口"按钮——显示"还有 3 关没过"。

#### ① 复用已有红点类（沿用场景 B 的 `LevelDoneRed`）

#### ② 写一个 RedGroup 子类（显式 SUM 聚合）

```typescript
// reds/HomeLevelRed.ts
import { IRed } from '../core/reddot/IRed';
import { GroupAggregation, RedGroup } from '../core/reddot/RedGroup';
import { regRedFactory } from '../core/reddot/RedRegister';

class HomeLevelRedGroup extends RedGroup {
    protected aggregation = GroupAggregation.SUM;    // 求和：3 关未通 → 显示 3
    protected children: IRed[] = LEVEL_IDS.map(id => new LevelDoneRed(id));
}

regRedFactory('HomeLevel', () => new HomeLevelRedGroup());
```

#### ③ UI 挂组件

```typescript
const rc = homeLevelBtn.addComponent(RedCom);
rc.redKey = 'HomeLevel';
rc.displayMode = RedDisplayMode.AUTO;   // 1 个不过只圆点，多个显示数字
```

**策划改口："入口只要红点不要数字"** → 编辑器里把 `displayMode` 改成 `DOT_ONLY` 完事，代码一行不改。

---

### 场景 D：多模块首页汇总（COUNT 聚合）⭐ 最有代表性

**例子**：首页顶栏按键底下有 3 个入口：**关卡 / 邮件 / 活动**。策划说"**几个入口有事就显示几**"——即使关卡内部有 5 个没通、邮件有 3 封未读，**顶栏只显示 2（2 个入口有事）**。

这就是 `GroupAggregation.COUNT` 的**唯一正确用法**。

#### ① 各模块的红点类（各自按自己语义）

```typescript
// 关卡叶子（0/1 存在模式）
class LevelDoneRed implements IRed {
    constructor(private readonly id: string) { }
    calcCount() { return LevelManager.isCompleted(this.id) ? 0 : 1; }
    getSignals(out) { out.push(LevelManager.completedChanged); }
}

// 关卡组（SUM 聚合：显示"3 关未通"）
class LevelGroupRed extends RedGroup {
    protected aggregation = GroupAggregation.SUM;
    protected children = LEVEL_IDS.map(id => new LevelDoneRed(id));
}

// 邮件叶子（0/1，即使 99 封未读也只算 1 个"入口有事"）
class MailRed implements IRed {
    calcCount() { return MailService.unreadCount > 0 ? 1 : 0; }
    getSignals(out) { out.push(MailService.unreadChanged); }
}

// 活动叶子
class ActivityRed implements IRed {
    calcCount() { return ActivityService.hasNew() ? 1 : 0; }
    getSignals(out) { out.push(ActivityService.changed); }
}

// 首页顶栏组（COUNT 聚合：几个入口有事）
class HomeTopRedGroup extends RedGroup {
    protected aggregation = GroupAggregation.COUNT;
    protected children = [
        new LevelGroupRed(),   // 子本身算 3，但 COUNT 下只看 ">0"，计 1
        new MailRed(),         // 子算 1，计 1
        new ActivityRed(),     // 子算 0，不计
    ];
}

regRedFactory('HomeTop', () => new HomeTopRedGroup());
```

#### ② UI 挂组件

```typescript
// 关卡入口：显示"3"（关卡组 SUM）
levelBtn.getComponent(RedCom)!.redKey = 'LevelGroup';
levelBtn.getComponent(RedCom)!.displayMode = RedDisplayMode.AUTO;

// 邮件入口：只圆点（策划要求）
mailBtn.getComponent(RedCom)!.redKey = 'Mail';
mailBtn.getComponent(RedCom)!.displayMode = RedDisplayMode.DOT_ONLY;

// 首页顶栏：显示"2"（顶栏 COUNT）
homeTopBtn.getComponent(RedCom)!.redKey = 'HomeTop';
homeTopBtn.getComponent(RedCom)!.displayMode = RedDisplayMode.NUMBER_ONLY;
```

**结果**：
- 3 关未通 + 5 封未读邮件 + 无新活动
- 关卡入口显示 **"3"**（SUM 叶子 0/1 加总）
- 邮件入口显示 **●**（DOT_ONLY）
- 首页顶栏显示 **"2"**（COUNT 合并，2 个入口有事）

**策划改需求"首页改成总待办数"** → 把 `HomeTopRedGroup.aggregation` 改成 `SUM`，编译器不报错，运行起来变成 "8"（3+5+0）。**改一个字段**。

---

## 🧭 架构拓扑图

```
┌────────────────────────────┐
│ 业务层（完全不知道红点）       │
│  ├─ XxxService / Manager   │  ← 状态 + Signal（改 + 派发）
│  └─ GameEvents（可选）      │  ← 跨系统事件总线
└────────────▲───────────────┘
             │ 读 + 订阅（单向）
┌────────────┴───────────────┐
│ 红点层（寄生业务）            │
│  ├─ XxxRed implements IRed  │  (calcCount)
│  ├─ XxxGroup extends RedGroup│  (aggregation = SUM/COUNT)
│  └─ @regRed / regRedFactory │
└────────────▲───────────────┘
             │ 字符串 key + displayMode
┌────────────┴───────────────┐
│ UI 层                       │
│  └─ 节点挂 RedCom           │
│      ├─ redKey              │
│      └─ displayMode         │
└────────────────────────────┘
```

**删掉红点层，业务层照跑**。这是设计的核心要求。

---

## ✅ 新增红点检查清单

每加一个红点，走一遍这 7 步：

- [ ] 1. **找到业务数据源**。没有就先写 Service/Manager（存事实 + Signal）。
- [ ] 2. **定叶子语义**：返回 `0/1`（存在模式）还是 `真实数`（数量模式）？
- [ ] 3. **写红点类**（`implements IRed`，两个方法：`calcCount` + `getSignals`）。
- [ ] 4. **如果是组**：`extends RedGroup`，**明确写** `aggregation`（SUM / COUNT）。
- [ ] 5. **注册**：
  - 单实例用 `@regRed("Key")`。
  - 多实例用 `regRedFactory("Key_id", () => new XxxRed(id))`。
- [ ] 6. **UI 挂 `RedCom`**，填 `redKey` + 选 `displayMode`（DOT_ONLY / NUMBER_ONLY / AUTO）。
- [ ] 7. **在 `RedAllReds.ts` 里 import 触发注册**。

---

## ❌ 新手十大坑

### 坑 1：改了业务数据但没 dispatch
```typescript
// ❌ 坏
this._completed.add(id);

// ✅ 好
this._completed.add(id);
this.completedChanged.dispatch();
```
封装成 `Service.complete(id)` 方法，改 + 派发永远在一起。

---

### 坑 2：`redKey` 打错字符串
```typescript
rc.redKey = 'Leveldone_apple';   // ❌ D 应该大写，编译器不管
```
**建议**：把所有 key 集中在一个 `RedKeys.ts` 常量表里（或枚举）。

---

### 坑 3：动态 `addComponent(RedCom)` 后再赋值 `redKey`
```typescript
// ❌ 坏：onLoad 立刻跑，此时 redKey = ''
this.node.addChild(node);
const rc = node.addComponent(RedCom);
rc.redKey = 'Foo';

// ✅ 好：先配齐再 addChild 触发 onLoad
const rc = node.addComponent(RedCom);
rc.redKey = 'Foo';
rc.displayMode = RedDisplayMode.AUTO;
this.node.addChild(node);
```

---

### 坑 4：忘了在 `RedAllReds.ts` 里 import
`@regRed` 装饰器**只在模块被 import 时才执行**。没 import → 没注册 → `getRed` 返 null → 控制台报错 `redKey 'Xxx' not found`。

---

### 坑 5：在红点类里引用 Cocos API
```typescript
// ❌ 坏
class MyRed implements IRed {
    calcCount() {
        return director.getScene().name === 'Home' ? 1 : 0;   // 依赖 Cocos
    }
}
```
红点类应该**纯业务数据**，零 Cocos 依赖。

---

### 坑 6：在 `getSignals` 里 new 新数组
```typescript
// ❌ 坏
getSignals(out) {
    return [StoreService.changed];    // 漠视 out 参数，还 return 新数组
}

// ✅ 好
getSignals(out) {
    out.push(StoreService.changed);
}
```
**永远 push 到 out**。`RedGroup` 递归聚合时这个设计零额外分配。

---

### 坑 7：Signal 和数据写在不同对象里
```typescript
// ❌ 坏：数据在 A，信号在 B
class DataHolder { static count = 0; }
class SignalHolder { static changed = new Signal(); }

// ✅ 好：信号跟着数据走
class Service {
    static count = 0;
    static readonly changed = new Signal<void>();
}
```
**谁持有数据，谁持有信号**。

---

### 坑 8：嵌套 Group 聚合策略写错

```typescript
// 策划要"几个入口有事" ← 应该 COUNT
class HomeTopGroup extends RedGroup {
    protected aggregation = GroupAggregation.SUM;  // ❌ 写成求和
    protected children = [
        new LevelGroup(),  // 内部 3
        new MailRed(),     // 1
    ];
}
// SUM 结果: 3 + 1 = 4（总待办）
// COUNT 结果: 1 + 1 = 2（类别数）← 策划要的
```

**每次写嵌套 group 都问一遍**："我要的是'总数'还是'类别数'？"

---

### 坑 9：强刷 `refresh()` 滥用
```typescript
// ❌ 坏
this._count++;
this._redCom.refresh();    // 绕过信号系统手刷

// ✅ 好
this._count++;
this.changed.dispatch();   // 所有订阅者自动刷
```
`refresh()` 只用于**没有信号源**的场景（账号切换、服务器全量返回）。平时用 dispatch。

---

### 坑 10：`RedDisplay` 同节点挂 Graphics + Label ⭐ 数字化之后的新坑

```typescript
// ❌ 坏：同一个节点加 Graphics + Label
const g = this.node.addComponent(Graphics);
const label = this.node.addComponent(Label);   // 报错：
                                               // Can't add renderable component to this node
                                               // because it already have one.
```

**Cocos 3.x 规则**：一个节点只能有一个"可渲染组件"（Graphics / Sprite / Label / RichText）。

```typescript
// ✅ 好：Label 放子节点
const g = this.node.addComponent(Graphics);

const labelNode = new Node('Count');
this.node.addChild(labelNode);
labelNode.addComponent(UITransform).setContentSize(20, 20);
const label = labelNode.addComponent(Label);
```

**现成答案**看 `RedDisplay.ts` 标准实现。

---

## 🔧 调试技巧

### 红点不亮？按这个顺序查：

1. **控制台有没有 `redKey 'Xxx' not found`？**
   → 红点类没注册。检查 `RedAllReds.ts` 有没有 import 到。

2. **控制台有没有 `Can't add renderable component`？**
   → 看坑 10。`RedDisplay` 里 Label 必须放子节点。

3. **`listReds()` / `listRedFactories()` 看注册表**
   ```typescript
   import { listReds, listRedFactories } from './core/reddot/RedRegister';
   console.log('Reds:', listReds());
   console.log('Factories:', listRedFactories());
   ```

4. **手动调 `calcCount` 看结果**
   ```typescript
   const Ctor = getRed('Xxx')!;
   console.log(new Ctor().calcCount());    // 业务数据有没有正确进去
   ```

5. **业务改数据后有没有 dispatch？**
   在 `Service.xxxChanged.dispatch()` 处加 log，看有没有触发。

6. **防抖延迟**
   `RedCom.RED_REFRESH_DEBOUNCE` 决定信号到视觉的延迟（默认 0.5s）。等不及改这个常量。

---

### 数字不对？按 3 个维度排查：

红点数字显示错了（比如预期 3 显示了 2，或者反过来），分 3 层检查：

#### 维度 ①：叶子贡献对不对
```typescript
const leaf = new MailRed();
console.log(leaf.calcCount());   // 预期是几？
```
**0/1 还是真实数**要和需求对上。

#### 维度 ②：Group 聚合策略对不对
```typescript
const group = new HomeTopGroup();
console.log(group.aggregation);   // SUM or COUNT？
console.log(group.calcCount());
```
**"总数"用 SUM，"类别数"用 COUNT**。

#### 维度 ③：UI 显示模式对不对
- 看到 `●` 而不是 `3`？ → `displayMode` 可能是 `DOT_ONLY`，改 `NUMBER_ONLY` 或 `AUTO`。
- 看到 `3` 而不是 `●`？ → `displayMode` 是 `NUMBER_ONLY` 且 count=1，改 `AUTO` 或 `DOT_ONLY`。
- 看到 `99+` → count 超过 99，这是正常约定。

---

## 📖 进阶阅读

- 原理系列（基建篇）：`teach/reddot/00-overview.md` ~ `07-integration.md`
- 原理系列（进阶篇）：`teach/reddot/08-red-count.md`（数量化）
- Demo 参考：`core/reddot/TestRed.ts` + `core/reddot/demo/`

---

## 📌 Demo 运行（快速验证环境）

1. 场景里 Canvas 下新建一个空节点 `TestNode`。
2. 给 `TestNode` 加 `UITransform`，尺寸填 `400 × 400`。
3. 挂 `TestRedRunner` 组件。
4. Play → 看到 **1 个蓝色 Any 按钮** + **2×5 十个灰色按钮**。
5. 点任一按钮 → 0.5s 后该按钮和 Any 按钮都亮红点。
6. 全部关闭 → Any 按钮红点才灭。
7. **数字验证**：点多个按钮（比如 3 个）→ Any 按钮显示 "3"（SUM 聚合 + AUTO 显示模式）。
8. **切换显示模式**：编辑器里选中 Any 按钮的 `RedCom` → `displayMode` 从 `AUTO` 改 `DOT_ONLY` → 重 Play → Any 按钮永远只显示圆点不显示数字。

**能看到全部流程**，说明红点系统完整可用。
