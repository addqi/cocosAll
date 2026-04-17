# Stage 1 — 最小红点节点

> **这一阶段结束，你会得到**：一个能挂在任意 UI 节点上的 `RedDotView` 组件，调用 `setCount(5)` 显示红底 "5"，调用 `setCount(0)` 自动隐藏。
> **代码量**：约 80 行，一个文件。

---

## 1. 要解决什么问题

红点最朴素的需求：**某个按钮角上画个红色小圆点，能显示数字，count=0 时隐藏。**

这一阶段我们不做树、不做注册、不做事件，**只做"画"**。
先搞定"能看见"，再谈"怎么管理"。

---

## 2. Linus 式三连问

### 🟢 数据结构

一个红点的**最小状态**只有一个变量：

```typescript
count: number
```

- `count === 0` → 隐藏
- `count === 1` → 显示纯点（可不显示数字）
- `count >= 2` → 显示数字
- `count > 99` → 显示 "99+"

就这。不要加 `visible`、`showNumber`、`type` 这些，它们全是 `count` 的**派生状态**。派生状态永远不该存，现算。

### 🟡 特殊情况

| 情况 | 糟糕设计 | 好设计 |
|------|---------|--------|
| 不显示数字，只要点 | `showDot: boolean` + `showNum: boolean` 两个开关 | `displayMode` 配置，一个枚举完事 |
| 99+ 的边界 | `if (count > 99) label = '99+'; else label = String(count);` | 抽一个 `formatCount(count, cap)` 函数 |
| count = 0 | 到处 `if (count > 0)` 判断显示 | 组件内部一次性处理：`node.active = count > 0` |

### 🔴 复杂度

这阶段**只允许两层缩进**。一个组件、一个方法 `setCount`，仅此而已。

---

## 3. 设计方案

### 3.1 API 形态（先定接口）

```typescript
// 挂在一个空 Node 上，然后 setCount 即可
const view = node.addComponent(RedDotView);
view.setCount(5);     // 显示红底 "5"
view.setCount(0);     // 隐藏
view.setCount(150);   // 显示 "99+"
```

> 💡 **关键原则**：`setCount` 是 **唯一的设值入口**。不要暴露 `setVisible`、`setText` 这种 API，让外部只关心"有几个"。

### 3.2 显示模式

我们提供三种模式（枚举，不是布尔），默认 `NumberOrDot`：

| 模式 | 含义 |
|------|------|
| `DotOnly` | 只显示点，不显示数字（适合"有新内容"提示） |
| `NumberOnly` | 必须有数字，count=0 隐藏 |
| `NumberOrDot` | count=1 显示点，count>=2 显示数字（最常用） |

### 3.3 外观参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| 背景色 | 红色 `#F44336` | 可改 |
| 点直径（无数字时） | 16 px | |
| 胶囊高度（有数字时） | 28 px | |
| 字号 | 20 | |
| "最大数字" | 99 | 超过显示 "99+" |

---

## 4. 完整代码

### `assets/src/core/reddot/RedDotView.ts`

```typescript
import { _decorator, Color, Component, Label, Sprite, UITransform } from 'cc';

const { ccclass, property } = _decorator;

/** 显示模式 */
export enum RedDotDisplayMode {
    /** 只显示点，不显示数字 */
    DotOnly = 0,
    /** 必须有数字（count=0 隐藏） */
    NumberOnly = 1,
    /** count=1 显示点；count>=2 显示数字（默认） */
    NumberOrDot = 2,
}

export interface RedDotViewStyle {
    bgColor: Color;
    dotSize: number;       // 纯点模式下的直径
    capsuleHeight: number; // 胶囊模式下的高度
    fontSize: number;
    fontColor: Color;
    maxDisplay: number;    // 超过显示 "99+"
}

const DEFAULT_STYLE: RedDotViewStyle = {
    bgColor: new Color(244, 67, 54, 255),
    dotSize: 16,
    capsuleHeight: 28,
    fontSize: 20,
    fontColor: new Color(255, 255, 255, 255),
    maxDisplay: 99,
};

@ccclass('RedDotView')
export class RedDotView extends Component {

    private _count = 0;
    private _mode: RedDotDisplayMode = RedDotDisplayMode.NumberOrDot;
    private _style: RedDotViewStyle = { ...DEFAULT_STYLE };

    private _bgSprite: Sprite | null = null;
    private _label: Label | null = null;
    private _labelNode: any = null;

    onLoad(): void {
        this._ensureChildren();
        this._refresh();
    }

    /** 唯一的设值入口 */
    setCount(count: number): void {
        const c = Math.max(0, Math.floor(count));
        if (c === this._count) return;
        this._count = c;
        this._refresh();
    }

    getCount(): number {
        return this._count;
    }

    setMode(mode: RedDotDisplayMode): void {
        if (mode === this._mode) return;
        this._mode = mode;
        this._refresh();
    }

    setStyle(style: Partial<RedDotViewStyle>): void {
        this._style = { ...this._style, ...style };
        this._applyStyle();
        this._refresh();
    }

    private _ensureChildren(): void {
        if (!this.node.getComponent(UITransform)) {
            this.node.addComponent(UITransform);
        }
        this._bgSprite = this.node.getComponent(Sprite) ?? this.node.addComponent(Sprite);
        this._bgSprite.sizeMode = Sprite.SizeMode.CUSTOM;

        const labelName = 'RedDotLabel';
        let lblNode = this.node.getChildByName(labelName);
        if (!lblNode) {
            const { Node } = require('cc');
            lblNode = new Node(labelName);
            this.node.addChild(lblNode);
            lblNode.addComponent(UITransform);
            lblNode.addComponent(Label);
        }
        this._labelNode = lblNode;
        this._label = lblNode.getComponent(Label);
        this._applyStyle();
    }

    private _applyStyle(): void {
        if (this._bgSprite) this._bgSprite.color = this._style.bgColor.clone();
        if (this._label) {
            this._label.fontSize = this._style.fontSize;
            this._label.color = this._style.fontColor.clone();
            this._label.horizontalAlign = Label.HorizontalAlign.CENTER;
            this._label.verticalAlign = Label.VerticalAlign.CENTER;
        }
    }

    private _refresh(): void {
        const { shouldShow, showNumber, text } = this._decide();

        this.node.active = shouldShow;
        if (!shouldShow) return;

        const ut = this.node.getComponent(UITransform)!;
        if (showNumber) {
            const h = this._style.capsuleHeight;
            const w = Math.max(h, h * 0.6 + text.length * this._style.fontSize * 0.55);
            ut.setContentSize(w, h);
        } else {
            ut.setContentSize(this._style.dotSize, this._style.dotSize);
        }

        if (this._label && this._labelNode) {
            this._labelNode.active = showNumber;
            if (showNumber) this._label.string = text;
        }
    }

    private _decide(): { shouldShow: boolean; showNumber: boolean; text: string } {
        const c = this._count;
        const cap = this._style.maxDisplay;
        const text = c > cap ? `${cap}+` : String(c);

        switch (this._mode) {
            case RedDotDisplayMode.DotOnly:
                return { shouldShow: c > 0, showNumber: false, text: '' };
            case RedDotDisplayMode.NumberOnly:
                return { shouldShow: c > 0, showNumber: true, text };
            case RedDotDisplayMode.NumberOrDot:
            default:
                return { shouldShow: c > 0, showNumber: c >= 2, text };
        }
    }
}
```

### 关键解读

1. **`setCount` 做早退**：`if (c === this._count) return;`
   → 避免不必要的 `_refresh()`。Cocos UI 的 dirty 刷新会触发 draw call，能省就省。

2. **`_decide` 集中判断**：所有"该不该显示、显示什么"的逻辑收敛在一个方法里。
   → 未来想加新模式，只改它，不改 `_refresh`。

3. **`_applyStyle` 和 `_refresh` 分离**：
   - `_applyStyle` 只改颜色/字号这些**静态样式**
   - `_refresh` 改尺寸/文字/可见性这些**随 count 变化的**
   → 单一职责。

4. **没有用 Cocos Graphics 画圆**：用纯色 Sprite 做方块胶囊。圆点/圆角胶囊在 Stage 5 再通过 SpriteFrame 切九宫格贴图实现；先让**功能跑通**，外观后面再 polish。

---

## 5. 怎么用（示例）

假设你在某个 UI 脚本里（比如挂在一个按钮上）：

```typescript
import { _decorator, Component, Node, UITransform } from 'cc';
import { RedDotView, RedDotDisplayMode } from '../core/reddot/RedDotView';

const { ccclass } = _decorator;

@ccclass('DemoButton')
export class DemoButton extends Component {
    private _dot: RedDotView | null = null;

    start() {
        // 1. 在按钮右上角创建一个空节点
        const dotNode = new Node('RedDot');
        this.node.addChild(dotNode);
        const ut = this.node.getComponent(UITransform)!;
        dotNode.setPosition(ut.width / 2, ut.height / 2, 0);

        // 2. 挂上 RedDotView 组件
        this._dot = dotNode.addComponent(RedDotView);
        this._dot.setMode(RedDotDisplayMode.NumberOrDot);

        // 3. 测试
        this._dot.setCount(0);        // 隐藏
        // this._dot.setCount(1);     // 纯红点
        // this._dot.setCount(5);     // 胶囊 "5"
        // this._dot.setCount(1000);  // 胶囊 "99+"
    }
}
```

---

## 6. 验证清单

在浏览器预览里依次调用，确认这四件事：

- [ ] `setCount(0)` → 红点节点**完全消失**（`active=false`）
- [ ] `setCount(1)` → 显示 **16×16 红色方块**，无数字
- [ ] `setCount(9)` → 显示**红色胶囊**，白字 "9"
- [ ] `setCount(200)` → 显示**红色胶囊**，白字 "99+"

全对才能进入 Stage 2。有任何一条没对，检查 `_decide` 和 `_refresh`。

---

## 7. 这阶段的局限 → 下一阶段解决

现在的 `RedDotView` **是个孤岛**：
- 你只能一个个 `setCount`，不知道红点之间的**关系**
- 父按钮上的红点，需要你**手动数一遍所有子页面**才能填

这就是树形结构要解决的问题。继续看 [`02-tree-bubble.md`](./02-tree-bubble.md)。
