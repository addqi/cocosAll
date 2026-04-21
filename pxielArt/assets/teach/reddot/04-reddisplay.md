# Stage 04 — RedDisplay：红点的视觉

> **这一阶段结束，你会得到**：一个独立的红点视觉组件 `RedDisplay`，只负责"红点长什么样、显不显示"，不碰任何业务逻辑。
> **前置**：Stage 01~03。
> **代码量**：单文件约 30 行。

---

## 1. 要解决什么问题

"逻辑红不红" 和 "视觉怎么画" 必须**分开**：

- 逻辑层（`IRed`）：我该不该红？
- 视觉层（`RedDisplay`）：红起来长什么样？

分开的好处有两个：

1. **换皮零成本**——产品要把圆点改成胶囊数字，只改视觉组件，业务代码一行不动。
2. **单测零依赖**——业务 `IRed` 没 Cocos 代码，直接 `new` 跑单测。

本章就是造一个"最小可用"的视觉组件。**刻意保持简单**——复杂的胶囊、数字、动画都留给后续换皮，本章只管"有没有红点"。

---

## 2. Linus 式三连问

### 🟢 数据结构

`RedDisplay` 只需要一个**对外方法**：

```
setRed(isRed: boolean): void
```

内部持有的状态最多是尺寸、颜色、贴图——全是 UI 常量。

### 🟡 特殊情况

| 场景 | 糟糕写法 | 好写法 |
|------|---------|--------|
| 要胶囊 + 数字 | 一个组件强行塞三种形态 | 本章只做圆点；换皮另写一个组件 |
| 父节点没有 UITransform | crash | 自己 `addComponent`，不依赖外部 |
| 没有 Sprite 组件 | 同上 | 自己加 |
| 没有 SpriteFrame | 红色设置了但看不见（Cocos 3.x 的坑） | 自己创建简单的颜色块，或靠 Sprite 的 `color` + 留白处理 |

### 🔴 复杂度

**30 行以内**。就一个 `setRed` 方法公开，一个 `onLoad` 初始化。

---

## 3. 分步实现

### 3.1 需求：组件骨架

**文件**：`assets/src/core/reddot/RedDisplay.ts`（新建）

```typescript
import { _decorator, Color, Component, Sprite, UITransform } from 'cc';
const { ccclass } = _decorator;

@ccclass('RedDisplay')
export class RedDisplay extends Component {
    // 下面几步填内容
}
```

**为什么**：
- **`@ccclass('RedDisplay')`**：让 Cocos 识别为场景可用组件。字符串是编辑器里看到的名字。
- **不标 `@property`**：本章没有需要在编辑器调的字段，全用默认值。要自定义外观？重写这个类或继承它。

---

### 3.2 需求：默认的尺寸和颜色

**文件**：同上，类字段

```typescript
private _sprite: Sprite | null = null;
```

**为什么**：
- 只需要一个 `Sprite` 引用做颜色/可见切换。
- 数字、胶囊这些以后再加就加新字段，**当前版本最小**。

---

### 3.3 需求：节点初始化

**文件**：同上，`onLoad` 方法

```typescript
onLoad(): void {
    const ut = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    ut.setContentSize(16, 16);

    this._sprite = this.node.getComponent(Sprite) ?? this.node.addComponent(Sprite);
    this._sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this._sprite.color = new Color(244, 67, 54, 255);
}
```

**为什么**：
- **`getComponent ?? addComponent`**：挂 `RedDisplay` 之前父节点如果已经配过 UITransform/Sprite，复用；没有就自动加。**防御式编程**——框架组件不能假设使用者配好了环境。
- **`setContentSize(16, 16)`**：16px 的小方块，经典红点大小。
- **`sizeMode = CUSTOM`**：告诉 Sprite 用我设置的尺寸，别根据图片自适应。
- **`color = Color(244, 67, 54)`**：Material Design 红，足够醒目。

---

### 3.4 需求：提供显隐 API

**文件**：同上，追加方法

```typescript
setRed(isRed: boolean): void {
    this.node.active = isRed;
}
```

**为什么**：
- **一行就够**。`this.node.active = false` 既不渲染也不参与布局，是 Cocos 的隐藏最佳实践。
- 不用 `opacity = 0`：opacity 0 依然占据 draw call 和布局位置。

---

### 3.5 汇总完整代码

**文件**：`assets/src/core/reddot/RedDisplay.ts`

```typescript
import { _decorator, Color, Component, Sprite, UITransform } from 'cc';
const { ccclass } = _decorator;

/**
 * 最小红点视觉：纯显隐 + 16x16 红色方块。
 * 想要胶囊/数字/动画？写一个兄弟组件或子类替代它。
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

---

## 4. 关于 Cocos 3.x 的一个坑

**Cocos 3.8 的 Sprite 组件没有 `SpriteFrame` 时，单纯设 `color` 是不渲染的**。有两种解法：

### 4.1 方案一：给 Sprite 一张默认 1x1 白图（推荐）

`assets/resources/reddot/white.png` 放一张 1x1 白色图片，`onLoad` 里动态加载：

```typescript
import { resources, SpriteFrame } from 'cc';

private static _bgFrame: SpriteFrame | null = null;

public static preload(): Promise<void> {
    return new Promise((resolve) => {
        resources.load('reddot/white/spriteFrame', SpriteFrame, (err, frame) => {
            if (!err) RedDisplay._bgFrame = frame;
            resolve();
        });
    });
}

onLoad(): void {
    // ... 上面的代码 ...
    if (RedDisplay._bgFrame) this._sprite.spriteFrame = RedDisplay._bgFrame;
}
```

启动时调一次 `RedDisplay.preload()`（例如 `LaunchRoot` 里）。

### 4.2 方案二：用 `Graphics` 画圆（更硬核但零贴图依赖）

```typescript
import { Graphics } from 'cc';
const g = this.node.getComponent(Graphics) ?? this.node.addComponent(Graphics);
g.circle(0, 0, 8);
g.fillColor = new Color(244, 67, 54);
g.fill();
```

**哪种更好？**
- 新手：**用方案一**。白图最稳。
- 项目已有 `Graphics` 使用经验：方案二灵活，想要圆点就圆点，想要圆角胶囊就 `roundRect`。

本教程推荐**方案一**。实战那章（Stage 07）会把 `white.png` 真正放到 `assets/resources/` 里。

---

## 5. 怎么用（示例）

```typescript
import { _decorator, Component, Node } from 'cc';
import { RedDisplay } from './core/reddot/RedDisplay';

@ccclass('Demo')
export class Demo extends Component {
    start() {
        const dotNode = new Node('RedDot');
        this.node.addChild(dotNode);

        const display = dotNode.addComponent(RedDisplay);
        display.setRed(true);          // 红点出现
        setTimeout(() => display.setRed(false), 2000);  // 2 秒后消失
    }
}
```

---

## 6. 验证清单

- [ ] 挂到一个空节点上、启动 → 看到 16x16 红方块
- [ ] 调 `setRed(false)` → 方块消失
- [ ] 调 `setRed(true)` → 方块再出现
- [ ] 没配 UITransform / Sprite 的节点挂上去 → 不报错、红点正常显示
- [ ] （方案一）`resources/reddot/white.png` 正确加载

---

## 7. 这阶段的局限 → 下一阶段解决

现在我们有：

- 逻辑（IRed / RedGroup / @regRed）
- 视觉（RedDisplay）
- 信号（Signal）

**但两边还没接上**——要手动 `new Xxx()` 拿实例、手动 `signal.add(markDirty)`、手动 `display.setRed(inst.calcRed())`、节点销毁还得手动反订阅。

下一章做 `RedCom`——**一个组件把所有这些自动化**。翻开 [`05-redcom.md`](./05-redcom.md)。
