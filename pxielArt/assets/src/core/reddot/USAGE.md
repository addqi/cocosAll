# 红点系统使用手册

> 本手册不讲原理（原理看 `teach/reddot/00-overview.md ~ 07-integration.md`），只讲"**我要加一个红点，该怎么做**"。

---

## 📁 目录速查

```
core/reddot/
├── 基建（不动）
│   ├── Signal.ts           订阅/派发
│   ├── IRed.ts             红点契约接口
│   ├── RedRegister.ts      字符串 key 注册表
│   ├── RedGroup.ts         红点组合基类
│   ├── RedDisplay.ts       红点视觉组件
│   ├── RedCom.ts           挂在节点上的入口组件
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

1. **写一个"怎么红"的类**（读哪个业务状态、订阅哪个业务 Signal）。
2. **UI 上挂 `RedCom` 组件，填 `redKey` 字符串。**

剩下的全自动：自动订阅、自动重算、自动显隐、自动销毁反订阅、零内存泄漏。

---

## 📐 三条铁律（违反必踩坑）

### 铁律 1：存事实，不存派生状态

> ❌ 差：存 `hasRedDot: boolean`
> ✅ 好：存 `seenLevels: Set<string>`，红点 = `!seenLevels.has(id)`

派生值永远**现算**，"红不红"不是事实。

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

## 🚀 三种典型场景的标准做法

### 场景 A：独立红点（商店、邮件、首页汇总）

**例子**：商店有免费购买次数时亮红点。

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

#### ② 红点类

```typescript
// reds/StoreFreeBuyRed.ts
import { IRed } from '../core/reddot/IRed';
import { Signal } from '../core/reddot/Signal';
import { regRed } from '../core/reddot/RedRegister';
import { StoreService } from '../game/StoreService';

@regRed('StoreFreeBuy')
export class StoreFreeBuyRed implements IRed {
    calcRed(): boolean {
        return StoreService.freeBuyCount > 0;
    }
    getSignals(out: Signal<any>[]): void {
        out.push(StoreService.freeBuyChanged);
    }
}
```

#### ③ UI 挂组件

**编辑器方式（推荐）**：
- 选中商店按钮节点 → Add Component → `RedCom` → 填 `redKey = "StoreFreeBuy"`。

**代码方式**：
```typescript
const rc = storeBtnNode.addComponent(RedCom);
rc.redKey = 'StoreFreeBuy';
```

#### ④ 让注册生效

在 `RedAllReds.ts` 加一行 import：

```typescript
import '../reds/StoreFreeBuyRed';
```

**完成**。业务里任何地方调 `StoreService.useFreeBuy()`，0.5s 内所有商店按钮的红点自动刷新。

---

### 场景 B：列表红点（N 个关卡、N 个活动、N 个任务）

**例子**：10 个关卡卡片，每个卡片未通关时亮红点。

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
    calcRed(): boolean {
        return !LevelManager.isCompleted(this.id);
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
// 创建卡片时
const rc = cardNode.addComponent(RedCom);
rc.redKey = `LevelDone_${levelId}`;   // 每张卡片 key 不同
```

#### ④ 启动注册

```typescript
// RedAllReds.ts
import { registerLevelDoneReds } from '../reds/LevelDoneRed';
registerLevelDoneReds();
```

**完成**。100 个关卡也是这 4 步，代码量不变。

---

### 场景 C：父红点聚合子红点（首页汇总 / 侧边栏 / 一级入口）

**例子**：首页"关卡入口"按钮——任何一关没通就亮红点。

#### ① 复用已有红点类（假设场景 B 已经有 `LevelDone_*`）

#### ② 写一个 RedGroup 子类

```typescript
// reds/HomeLevelRed.ts
import { IRed } from '../core/reddot/IRed';
import { RedGroup } from '../core/reddot/RedGroup';
import { regRedFactory } from '../core/reddot/RedRegister';
import { LevelManager } from '../game/LevelManager';

const LEVEL_IDS = ['apple', 'banana', 'cherry' /* ... */];

class LevelDoneRed implements IRed {
    constructor(private readonly id: string) { }
    calcRed() { return !LevelManager.isCompleted(this.id); }
    getSignals(out) { out.push(LevelManager.completedChanged); }
}

class HomeLevelRedGroup extends RedGroup {
    protected children: IRed[] = LEVEL_IDS.map(id => new LevelDoneRed(id));
}

regRedFactory('HomeLevel', () => new HomeLevelRedGroup());
```

#### ③ UI 挂组件

```typescript
const rc = homeLevelBtn.addComponent(RedCom);
rc.redKey = 'HomeLevel';
```

**完成**。任意 `LevelManager.complete(id)` 后，`HomeLevel` 红点自动重算。

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
│  ├─ XxxRed implements IRed  │
│  └─ @regRed / regRedFactory │
└────────────▲───────────────┘
             │ 字符串 key
┌────────────┴───────────────┐
│ UI 层                       │
│  └─ 节点挂 RedCom + redKey  │
└────────────────────────────┘
```

**删掉红点层，业务层照跑**。这是设计的核心要求。

---

## ✅ 新增红点检查清单

每加一个红点，走一遍这 5 步：

- [ ] 1. **找到业务数据源**。没有就先写 Service/Manager（存事实 + Signal）。
- [ ] 2. **写红点类**（`implements IRed`，两个方法：`calcRed` + `getSignals`）。
- [ ] 3. **注册**：
  - 单实例用 `@regRed("Key")`。
  - 多实例用 `regRedFactory("Key_id", () => new XxxRed(id))`。
- [ ] 4. **UI 挂 `RedCom` + 填 `redKey`**。
- [ ] 5. **在 `RedAllReds.ts` 里 import 触发注册**。

---

## ❌ 新手九大坑

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
**建议**：把所有 key 集中在一个 `RedKeys.ts` 常量表里。

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
    calcRed() {
        return director.getScene().name === 'Home';   // 依赖 Cocos，没法单测
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

### 坑 8：过度去重
同一个 Signal 被 `RedGroup` 的多个子 push 多次时不去重——**这是故意的**。`RedCom` 防抖机制保证重复订阅不造成重复刷新。

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

## 🔧 调试技巧

### 红点不亮？按这个顺序查：

1. **控制台有没有 `redKey 'Xxx' not found`？**
   → 红点类没注册。检查 `RedAllReds.ts` 有没有 import 到。

2. **`listReds()` / `listRedFactories()` 看注册表**
   ```typescript
   import { listReds, listRedFactories } from './core/reddot/RedRegister';
   console.log('Reds:', listReds());
   console.log('Factories:', listRedFactories());
   ```

3. **手动调 `calcRed` 看结果**
   ```typescript
   const Ctor = getRed('Xxx')!;
   console.log(new Ctor().calcRed());    // 业务数据有没有正确进去
   ```

4. **业务改数据后有没有 dispatch？**
   在 `Service.xxxChanged.dispatch()` 处加 log，看有没有触发。

5. **0.5s 防抖**
   按钮点完要等 0.5s 红点才变。等不及改 `RedCom.ts` 里 `RED_REFRESH_DEBOUNCE`。

---

## 📖 进阶阅读

- 原理系列：`teach/reddot/00-overview.md` 到 `07-integration.md`
- Demo 参考：`core/reddot/TestRed.ts` + `core/reddot/demo/`

---

## 📌 Demo 运行（快速验证环境）

1. 场景里 Canvas 下新建一个空节点 `TestNode`。
2. 给 `TestNode` 加 `UITransform`，尺寸填 `400 × 400`。
3. 挂 `TestRedRunner` 组件。
4. Play → 看到 **1 个蓝色 Any 按钮** + **2×5 十个灰色按钮**。
5. 点任一按钮 → 0.5s 后该按钮和 Any 按钮都亮红点。
6. 全部关闭 → Any 按钮红点才灭。

**能看到这个流程**，说明红点系统完整可用。
