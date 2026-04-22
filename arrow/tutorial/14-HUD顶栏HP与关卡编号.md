# 14 · HUD 顶栏：HP + 关卡编号

## 本节目标

**在屏幕左上角显示一个顶栏**，包含：

- 左侧：`Level 1`
- 右侧：`HP: 3`（会随着失败实时减少）

预期：

- 启动：`Level 1  HP: 3`
- 撞一次：HP 变成 2
- HUD 永远在屏幕最上层，不被棋盘遮挡。

一句话：**让玩家第一次"看见"游戏状态**。

---

## 需求分析

HUD（Heads-Up Display）是游戏里显示数值的那一层 UI。要点：

- **位置固定**（相对屏幕边，不随窗口缩放）。
- **始终在最上层**（zIndex 高于棋盘）。
- **数据驱动**：数值变了自动更新显示。

对应 G3_FBase：`CombatUiRender` 是同类的"战斗 UI 层"，画 HP 图标、关卡数、返回按钮等。我们简化成**只有两行文字**。

---

## 实现思路

### Cocos 3.8 的 Label 组件

显示文字用 `Label` 组件。不需要字体文件（使用系统字体）。

```typescript
import { Label } from 'cc';
const node = new Node('HpText');
node.addComponent(UITransform).setContentSize(200, 40);
const label = node.addComponent(Label);
label.fontSize = 32;
label.string = 'HP: 3';
label.color = Color.BLACK;
```

### Widget 组件做屏幕贴边

Cocos 3.8 的 `Widget` 组件可以让节点贴屏幕边自适应：

```typescript
import { Widget } from 'cc';
const w = node.addComponent(Widget);
w.isAlignTop = true;
w.isAlignLeft = true;
w.top = 40;
w.left = 40;
w.alignMode = Widget.AlignMode.ALWAYS;
```

对应 G3_FBase 用的 `widget: { isAlignTop: true, ...}`（那是声明式写法，我们用代码设属性是一个意思）。

### 数据驱动

HUD 需要知道 GameController 的 `hp` 和 `level`。最简单：

- HUD.setData(level, hp) 由 GameController 调用。
- HP 变化时 GameController 通知 HUD。

两行代码就完事，不用 MVVM 也不用响应式。

---

## 代码实现

### 文件 1：`game/HUD.ts`（新增）

```typescript
import {
    _decorator, Component, Node, Label, UITransform, Color, Widget,
} from 'cc';
const { ccclass } = _decorator;

/**
 * 游戏顶栏 HUD。显示关卡号和生命值。
 * 左上角 Level 文字，右上角 HP 文字。
 */
@ccclass('HUD')
export class HUD extends Component {
    private levelLabel: Label | null = null;
    private hpLabel: Label | null = null;

    onLoad() {
        this.levelLabel = this.createLabel('LevelText', true /* left */);
        this.hpLabel = this.createLabel('HpText', false /* right */);
        this.setData(1, 3);
    }

    setData(level: number, hp: number) {
        if (this.levelLabel) this.levelLabel.string = `Level ${level}`;
        if (this.hpLabel) this.hpLabel.string = `HP: ${hp}`;
    }

    private createLabel(name: string, alignLeft: boolean): Label {
        const n = new Node(name);
        this.node.addChild(n);

        n.addComponent(UITransform).setContentSize(300, 40);
        const label = n.addComponent(Label);
        label.fontSize = 36;
        label.color = new Color(0x33, 0x3a, 0x73, 0xff);  // uiLevelColor 系
        label.string = '';

        const w = n.addComponent(Widget);
        w.isAlignTop = true;
        w.top = 40;
        if (alignLeft) {
            w.isAlignLeft = true;
            w.left = 40;
        } else {
            w.isAlignRight = true;
            w.right = 40;
        }
        w.alignMode = Widget.AlignMode.ALWAYS;

        return label;
    }
}
```

**关键点**：

- **`Widget.AlignMode.ALWAYS`**：窗口大小变化时持续贴边。`ONCE` 只贴一次。`ALWAYS` 更稳。
- **label.color 用 `new Color(...)`**：不用全局常量，避免引用同一个对象到处传染。
- **`createLabel` 合并了左右逻辑**，用 `alignLeft` 参数区分。Linus 的"消除特殊情况"的缩影。

### 文件 2：`game/GameController.ts` 接入 HUD

```typescript
import { HUD } from './HUD';

private hud: HUD | null = null;

onLoad() {
    console.log('[Arrow] Game scene loaded.');
    this.boardView = this.createBoardView();
    this.input = this.boardView.node.addComponent(InputController);
    this.hud = this.createHUD();
    this.loadLevel(1);
}

private createHUD(): HUD {
    const node = new Node('HUD');
    this.node.addChild(node);
    return node.addComponent(HUD);
}

private onLevelLoaded(data: LevelData) {
    // ... 已有代码
    this.hp = this.HP_MAX;
    this.refreshHUD(1 /* 关卡号先写死 */);
}

private refreshHUD(level: number) {
    this.hud?.setData(level, this.hp);
}

// update 里的 Back 到达处：
if (arrived) {
    markBack(rt);
    this.hp -= 1;
    console.log(`[Arrow] Arrow ${i} bounced back. HP = ${this.hp}`);
    this.refreshHUD(1);  // 关卡号先写死，第 18 章接到 GameData 后改
}
```

**关键修改**：

- HUD 挂在 `GameController` 同级节点下，**不挂在 BoardView 下**。这样之后做屏幕适配时（未来章节），BoardView 的 scale 不会影响 HUD。
- 扣 HP 后立刻 refreshHUD。

---

## 运行效果

启动：

```
 Level 1                           HP: 3
 
 [棋盘居中]
```

撞一次箭头：右上 `HP: 3` → `HP: 2`。

---

## 易错点

### 易错 1：HUD 挂在 BoardView 下

```typescript
this.boardView.node.addChild(hudNode);  // ❌
```

BoardView 在第 06 章设了 `setScale(layout.scale, ...)`，HUD 会跟着一起缩放，字一会儿大一会儿小。

**规则**：UI 层（HUD、按钮、弹窗）挂 **Canvas**，不挂 BoardView。

### 易错 2：Widget 没 `alignMode`

```typescript
w.isAlignTop = true;
w.top = 40;
// 缺 alignMode
```

Cocos 3.8 默认 `ONCE`，窗口拖拽改大小时 HUD 不跟着贴边。

**规则**：HUD 这种必贴边的 UI，**永远 `ALWAYS`**。

### 易错 3：Label 的 `contentSize` 设得太小

```typescript
n.addComponent(UITransform).setContentSize(50, 20);
label.string = 'HP: 10';   // 装不下 → 截断
```

Label 不自动扩大 UITransform。contentSize 不够就被裁。给 300×40 保守点。

### 易错 4：忘了 `refreshHUD` 在关卡加载后调

第一次打开，HUD 还是 `setData(1, 3)` 的硬编码默认值。没问题，但如果后续关卡 HP 不是 3，或者从存档加载中间态，会显示错。

**规则**：**关卡初始化完毕 → 立刻 refreshHUD**。和 refreshAllArrows 放一起。

### 易错 5：HUD 文字颜色在浅色棋盘上看不清

目前背景是 Cocos 默认灰色，`0x333a73` 深蓝色文字够清楚。如果你给棋盘加了深色背景，就要换白色文字。

**规则**：颜色常量放 `Config.ts` 或 HUD 里一处，不要散在多个地方。

---

## 扩展练习

1. **HP 用图标代替数字**：用 3 个小红心 `Sprite` 代替 `HP: 3`。死一个消失一个。提示：循环创建 3 个 Sprite 放水平 layout 里。

2. **HP 变化的动画**：扣 HP 时让数字闪红 + 轻微抖动。提示：`tween(node).to(0.1, { position: x+5 }).to(0.1, { position: x-5 })`。

3. **思考题**：现在 HUD 和 GameController 是"推模式"——后者扣 HP 后主动调 `refreshHUD`。另一种写法是"拉模式"——HUD 在 `update` 里自己读 GameController 的 hp。两种方式各有什么优劣？哪个更符合"单一职责"？

   （答案：推模式更好。推模式下 HUD 不知道 GameController 的存在，可以独立测试；拉模式 HUD 依赖 GameController 的内部字段，耦合高。）

---

**工程状态**：

```
game/
├── ArrowView.ts
├── BoardView.ts
├── GameController.ts          ← 创建 HUD + refreshHUD
├── HUD.ts                     ← 新增
└── InputController.ts
```

下一章：**15 · 胜利判定与通关界面** —— 玩家能真的赢了。
