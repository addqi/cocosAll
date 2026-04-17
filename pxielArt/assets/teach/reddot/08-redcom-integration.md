# Stage 08 — RedCom：一个组件搞定挂载、刷新、销毁

> **本章定位**：在 Stage 07 的逻辑层之上，加 UI 集成层。
> **读完你会得到**：开发者**挂 `RedCom` 组件 + 填一个关键字**，整个红点就工作了——UI 创建、定位、信号订阅/反订阅、防抖刷新全部自动。
> **前置**：Stage 07。

---

## 1. 这一章要解决什么

Stage 07 末尾的示例，红点只能**手动调 `calcRed()`** 才出结果。离"自动显示"还差几步：

| 缺什么 | 要解决的问题 |
|--------|-------------|
| 红点视觉 | 红底圆点/胶囊/数字，一个可复用的 UI 原型 |
| 实例化红点类 | 从关键字 → `new RedClass()` |
| 订阅 / 反订阅信号 | 拿到 `IRed.getSignals()` 的数组，挨个绑回调；UI 销毁时反订阅 |
| 合并突发刷新 | 一秒内 10 个信号 dispatch → 只刷新一次 |
| 自动定位 | 红点通常贴右上角，不想让开发者每次算坐标 |

把这些全部塞进**一个 Component**：`RedCom`。开发者的心智负担从 N 件事降到 1 件事。

---

## 2. Linus 式三连问

### 🟢 数据结构

`RedCom` 持有的状态只有这么点：

```typescript
@ccclass('RedCom')
class RedCom extends Component {
    @property redKey: string = '';       // 编辑器填的关键字
    
    private _inst: IRed | null = null;           // 红点类实例
    private _signals: Signal<any>[] = [];        // 订阅过的信号数组
    private _display: RedDisplay | null = null;  // 红点视觉节点（子节点）
    
    private _scheduled: boolean = false;         // 防抖调度中
}
```

**一个类、一个关键字、一串信号、一个子 UI、一个调度位**。没了。

### 🟡 特殊情况

| 情况 | 糟糕设计 | 好设计 |
|------|---------|--------|
| 节点失活/重新激活 | 在 `onLoad` 订阅就完事 | 放 `onEnable` 订阅，`onDisable` 反订阅，应对节点被反复开关 |
| 组件被销毁而信号没被反订阅 | 内存泄漏 + 野回调 | `onDisable` 清理引用，`onDestroy` 最终清理 |
| 填了不存在的关键字 | 崩溃或静默失败 | 警告 log + `_inst = null` 保护后续方法 |
| 一秒内信号被 dispatch 100 次 | 算 100 次 `calcRed` | 脏标记 + schedule 防抖 |
| 业务想手动刷（比如切账号） | 提供 `refresh()` 走完整路径 | 直接 `_scheduleRefresh()` |

### 🔴 复杂度

`RedCom` 核心 80 行以内。**所有 Cocos 侵入代码集中在这里**，业务 `IRed` 保持纯净。

---

## 3. 设计方案

### 3.1 两种组件分层

```
Node                           ← 开发者挂 RedCom 的业务节点（比如按钮）
├── RedCom (组件)              ← 本章主角，逻辑+生命周期
└── RedDot (子节点，自动创建)    
    └── RedDisplay (组件)      ← 本章配角，纯视觉
```

**分层理由**：
- `RedCom` 负责 what（该不该红）
- `RedDisplay` 负责 how（红起来长什么样）
- 换皮只改 `RedDisplay`；逻辑改动只改 `RedCom`。**两条独立修改轴**。

### 3.2 生命周期流程

```
onLoad:
  ├─ 读 redKey → getRed(key) → 构造 IRed 实例 → 存到 _inst
  ├─ 调 _inst.getSignals(_signals) 收集信号数组
  └─ 实例化 RedDisplay 子节点，定位到右上角
  
onEnable:
  ├─ 遍历 _signals，signal.add(markDirty, this)
  └─ 立刻 markDirty 一次（保证首帧有正确状态）

onDisable:
  ├─ 遍历 _signals，signal.remove(markDirty, this)
  └─ 取消还没触发的调度（防止失活后又 fire）

onDestroy:
  └─ 清理引用（防止回调持有已死组件）

markDirty:                  ← 被信号回调或手动调用
  └─ 已调度 return; 否则 schedule 0.5s 后 refresh
  
refresh (schedule 触发):
  ├─ 标志清零
  └─ _display.setRed(_inst.calcRed())
```

关键设计：**所有外部入口最终汇入 `markDirty`**，真正做计算的 `refresh` 只有 schedule 能触发。这样 100 次信号触发最终只刷 1 次。

### 3.3 自动定位策略

业务节点挂 `RedCom`，红点默认贴**右上角**，随业务节点大小自适应。

```typescript
const ut = this.node.getComponent(UITransform);
// 父节点的右上角相对父节点中心的偏移
// x = (1 - anchorX) * width
// y = (1 - anchorY) * height
_display.node.setPosition(
    (1 - ut.anchorX) * ut.width,
    (1 - ut.anchorY) * ut.height,
    0,
);
```

这套公式**不依赖父节点的 anchor 设置**，父锚点无论是 (0.5, 0.5) 还是 (0, 0) 都对。

> 如果需要其他位置（比如左上角、或者贴文字后面），Stage 09 会讲"扩展点"。

### 3.4 RedDisplay 该做多少？

**越少越好**。本章只给最小版：

```typescript
@ccclass('RedDisplay')
class RedDisplay extends Component {
    setRed(isRed: boolean): void {
        this.node.active = isRed;
    }
}
```

就这一个方法。纯显隐。

如果产品要胶囊带数字，可以接 Stage 01 里实现的 `RedDotView`（方案 A 的 UI），把 `setRed(bool)` 换成 `setCount(number)`，配合 Stage 09 优化点 4（`calcRed` 改 `number`）即可升级。**UI 是可插拔的**，这里不纠结外观。

---

## 4. 完整代码

### 4.1 `RedDisplay.ts`

```typescript
import { _decorator, Color, Component, Sprite, UITransform } from 'cc';
const { ccclass } = _decorator;

/**
 * 最小红点视觉：纯显隐 + 默认尺寸 + 默认红色。
 * 想要胶囊/数字/动画，换一个 RedDisplay 子类即可。
 */
@ccclass('RedDisplay')
export class RedDisplay extends Component {

    private _sprite: Sprite | null = null;

    onLoad(): void {
        const ut = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
        ut.setContentSize(16, 16);

        this._sprite = this.node.getComponent(Sprite) ?? this.node.addComponent(Sprite);
        this._sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        this._sprite.color = new Color(244, 67, 54, 255);
    }

    setRed(isRed: boolean): void {
        this.node.active = isRed;
    }
}
```

### 4.2 `RedCom.ts`（主角）

```typescript
import { _decorator, Component, Node, UITransform } from 'cc';
import { IRed } from './IRed';
import { Signal } from '../signal/Signal';
import { getRed } from './RedRegister';
import { RedDisplay } from './RedDisplay';
const { ccclass, property } = _decorator;

/** 防抖刷新间隔（秒） */
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
            console.error(`[RedCom] redKey '${this.redKey}' not found. Did you import the class file in RedAllReds.ts?`);
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

    /** 业务手动强刷（比如账号切换）*/
    refresh(): void {
        this._refreshNow();
    }

    private _markDirty(): void {
        if (this._scheduled) return;
        this._scheduled = true;
        this.scheduleOnce(this._refreshNow, RED_REFRESH_DEBOUNCE);
    }

    private _refreshNow = (): void => {
        this._scheduled = false;
        if (!this._inst || !this._display) return;
        const isRed = this._inst.calcRed();
        this._display.setRed(isRed);
    }

    private _createDisplay(): void {
        const ut = this.node.getComponent(UITransform);
        if (!ut) {
            console.warn(`[RedCom] node '${this.node.name}' has no UITransform; skip placing red dot.`);
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

### 关键代码解读

1. **`_refreshNow = (): void => {}` 用箭头函数**
   Cocos 的 `unschedule` 通过引用比对，箭头函数保证 `this` 绑定、引用稳定，避免"订了一次退不掉"的悬案。

2. **`onEnable` 里主动 `_markDirty` 一次**
   节点从失活到激活时，信号错过期间的状态需要补刷。主动打脏是最简单可靠的办法。

3. **`onDisable` 清 schedule**
   已预约但还没触发的 `_refreshNow` 必须取消，否则节点失活后红点可能还在亮。

4. **`getSignals` 一次性收集，`_signals` 只在 `onLoad` 填一次**
   假设业务 `IRed` 在运行时不会更换依赖信号。如果有这种动态需求，暴露一个 `rebindSignals()` 方法即可，99% 项目用不到。

5. **找不到 Ctor 不抛异常**
   `_inst = null` 后续所有方法 early return。这样一个坏红点**不会让父页面崩溃**。

---

## 5. 怎么用（三个典型姿势）

### 5.1 在编辑器里挂

1. 选中按钮节点
2. Inspector 点 Add Component → RedCom
3. 填 Red Key: `GearFreeBuyRed`

完成。运行后：
- 该类的 `calcRed()` 返回 true → 按钮右上角出现红点
- 关联 Signal `dispatch` → 0.5 秒内触发 `calcRed()` 重算
- 节点被销毁 → 自动反订阅，零泄漏

### 5.2 用代码动态挂（列表项/动态 UI）

```typescript
// LevelCard.ts 创建卡片时
import { RedCom } from '../../core/reddot-b/RedCom';

const card = new Node('LevelCard');
// ... 其他组件 ...

const redCom = card.addComponent(RedCom);
redCom.redKey = `LevelSeen_${entry.id}`;
```

> **注意**：`redKey` 字段在 `addComponent` 之后立刻赋值，`onLoad` 会读到。Cocos 的 `addComponent` 返回的组件 `onLoad` 不是立刻执行的（下一帧），赋值时序足够。

### 5.3 手动刷新（特殊场景）

```typescript
const redCom = this.node.getComponent(RedCom)!;
redCom.refresh();    // 立刻重算一次，不走防抖
```

用于登录切换、发奖后要立刻看到效果等场景。

---

## 6. 为什么这个设计"好用"？量化一下

同样一个"给按钮加红点"的任务：

| 步骤 | 方案 A（前 6 章）| 方案 B（本章） |
|------|-----------------|---------------|
| 想身份 | 想一个路径 id `home.btn.xxx` | 想一个类名 `XxxRed` |
| 写逻辑 | 在 Registry 里加一条 provider + deps | 写一个 IRed 子类 |
| 触发更新 | 业务 emit 字符串事件 | 数据持有者 dispatch 自己的 Signal |
| UI 挂载 | 建子节点 → 挂 RedDotView → 挂 RedDotBinder → 填 path | 挂 RedCom → 填 redKey |
| 反订阅 | Binder 自动（需要开发者信任） | RedCom 自动（同） |
| **开发者触达文件数** | **3 个**（Registry, 业务, UI 脚本） | **2 个**（IRed 子类, 编辑器挂） |

A 方案的 Registry 文件随红点数量线性膨胀；B 方案永远只有一行 import。**这才是差距**。

---

## 7. 验证清单

- [ ] 节点挂 `RedCom` + 有效 `redKey` + 对应 `IRed.calcRed` 返回 true → 右上角出现红点
- [ ] `signal.dispatch()` 一次 → 500ms 后红点状态更新（可打 log 验证只刷 1 次）
- [ ] 一秒内 `dispatch` 10 次 → 红点**只刷 1 次**（`_refreshNow` log 只打一次）
- [ ] 把父节点 `active` 置 false，再 `dispatch` → 回调不触发（`onDisable` 生效）
- [ ] 重新 `active = true` → 主动补刷一次，红点状态对齐最新
- [ ] 销毁父节点 → 无 warn / error，没有 stale signal 回调
- [ ] 填错 `redKey` → console.error 出现，父节点不崩
- [ ] 挂在没有 `UITransform` 的节点上 → warn 出现，红点不创建但不崩

---

## 8. 还差什么？

到此为止方案 B 的**核心机制**已经齐全。但我们还没：

- 在真实项目里端到端跑通一个带层级组合的红点（关卡页 + Tab 按钮 + 主按钮三层嵌套）
- 给出"方案 A vs 方案 B 什么时候选谁"的决策表
- 指出**你这套方案还能怎么更好**（四个优化点）

这些留给 Stage 09 毕业章。翻 [`09-practice-and-tradeoffs.md`](./09-practice-and-tradeoffs.md)。
