# 17 · Home 场景：Level 数字 + Play 按钮

## 本节目标

**新建 Home 场景**，作为游戏入口：

- 屏幕中央显示 "Level 1"（大字号）。
- 下方一个蓝色 "Play" 按钮。
- 点击 Play → 切换到 Game 场景。
- Game 场景胜利/失败 Overlay 改为"点击后返回 Home"。

预期：启动游戏 → 看到 Home → 点 Play → Game → 赢/输 → 点 Overlay → 回 Home。

一句话：**游戏有真正的入口，形成循环**。

---

## 需求分析

对照 G3_FHome 的 `FirstUiRender`，我们极简实现：

| G3_FHome | 我们 |
|----------|------|
| 顶部 Logo + Back 按钮 | ❌ 省 |
| 中央 Level 数字 + 滑动动效 | ✅ 简化为静态文字 |
| Play/Continue 按钮（大蓝色） | ✅ |
| 底部 Challenge/Home/Settings 三按钮 | ❌ 省 |
| 皮肤系统 | ❌ 省 |

**只要两个 UI 元素 + 一个场景切换**。

### 场景切换

Cocos 3.8 API：

```typescript
import { director } from 'cc';
director.loadScene('Game');  // 按场景名（去掉 .scene）
```

要求**该场景已经被加入到"场景配置"中**。Cocos 编辑器的 Project Settings → Project Data → 勾选场景。

---

## 实现思路

### 两个场景的管理

- **Home.scene** 挂 `HomeController` 组件，场景只有一个节点（Canvas + HomeController）。
- **Game.scene** 保持现状。

**关卡号暂时 hardcode 为 1**。第 18 章加存档读取。

### HomeController 职责

- `onLoad` 创建 UI：Level 文字 + Play 按钮。
- 点击 Play 切场景。

---

## 代码实现

### 文件 1：`scripts/home/HomeController.ts`（新增）

```typescript
import {
    _decorator, Component, Node, UITransform, Label, Color,
    Graphics, EventTouch, Input, director, Widget,
} from 'cc';
const { ccclass } = _decorator;

@ccclass('HomeController')
export class HomeController extends Component {
    onLoad() {
        console.log('[Arrow] Home scene loaded');
        this.buildUI();
    }

    private buildUI() {
        this.createLevelText(1);
        this.createPlayButton();
    }

    private createLevelText(levelNo: number) {
        const n = new Node('LevelText');
        this.node.addChild(n);
        n.setPosition(0, 100, 0);
        n.addComponent(UITransform).setContentSize(400, 100);
        const label = n.addComponent(Label);
        label.fontSize = 80;
        label.color = new Color(0x60, 0x6a, 0xf8, 0xff);
        label.string = `Level ${levelNo}`;
    }

    private createPlayButton() {
        const n = new Node('PlayButton');
        this.node.addChild(n);
        n.setPosition(0, -150, 0);
        n.addComponent(UITransform).setContentSize(300, 100);

        // 蓝色矩形背景
        const g = n.addComponent(Graphics);
        g.fillColor = new Color(0x5a, 0x62, 0xfa, 0xff);
        g.rect(-150, -50, 300, 100);
        g.fill();

        // 文字
        const textNode = new Node('PlayText');
        n.addChild(textNode);
        textNode.addComponent(UITransform).setContentSize(200, 60);
        const label = textNode.addComponent(Label);
        label.fontSize = 48;
        label.color = new Color(0xff, 0xff, 0xff, 0xff);
        label.string = 'Play';

        n.on(Input.EventType.TOUCH_END, this.onPlayClick, this);
    }

    private onPlayClick(_event: EventTouch) {
        console.log('[Arrow] Play clicked, loading Game scene');
        director.loadScene('Game');
    }

    onDestroy() {
        // Cocos loadScene 会销毁整个场景，节点上的监听自动失效
        // 这里无需 off
    }
}
```

**关键点**：

- 所有 UI 用代码生成，**不依赖 prefab**。新手教程阶段避免"预制体引用丢失"的问题。
- **Play 按钮的 Graphics 画在节点本地坐标**（`rect(-150, -50, 300, 100)` 居中），点击事件挂在节点上——点击范围自动用节点的 contentSize（300×100）。
- 按钮的点击反馈是 Cocos 3.8 Button 组件的功能（按下缩放）。本教程**不加 Button**，只用 Graphics + TOUCH_END，最简单够用。

### 文件 2：建立 Home.scene

1. Cocos 编辑器 Assets 面板 → `scenes/` → 右键 → **Create → Scene**，命名 `Home`。
2. 双击打开 Home.scene。
3. 选中 Canvas → Add Component → `HomeController`。
4. 保存。

### 文件 3：场景配置

1. 菜单 **Project → Project Settings → Project Data**。
2. 左侧 **Scene List**，确认 `scenes/Home` 和 `scenes/Game` 都在列表里。
3. **Start Scene** 下拉框选 `Home`（以 Home 为入口）。
4. 保存。

### 文件 4：Game 场景胜利/失败 Overlay 回 Home

改 `GameController.ts`：

```typescript
import { director } from 'cc';

private triggerWin() {
    this.gameOver = true;
    console.log('[Arrow] 🎉 Level passed!');
    this.overlay?.show('You Win!', () => director.loadScene('Home'));
}

private checkFail() {
    // ... 已有
    this.overlay?.show('You Lose...\nTap to retry', () => director.loadScene('Home'));
}
```

**简化**：胜利失败都回 Home。第 18 章接存档后可以改"胜利后 level+1 自动继续 Game"。

---

## 运行效果

启动：

```
┌─────────────────────────┐
│                         │
│       Level 1           │
│                         │
│                         │
│    ┌───────────────┐    │
│    │     Play      │    │
│    └───────────────┘    │
│                         │
└─────────────────────────┘
```

点 Play → 切到 Game 场景 → 玩一局 → 赢/输 → 点 Overlay → 回 Home。

Console：

```
[Arrow] Home scene loaded
[Arrow] Play clicked, loading Game scene
[Arrow] Game scene loaded.
[Arrow] Level loaded: 5 x 5, arrows = 3
...
[Arrow] 🎉 Level passed!
(点 Overlay)
[Arrow] Home scene loaded
```

---

## 易错点

### 易错 1：`director.loadScene('Game')` 报场景不存在

常见原因：

- 场景没保存（scenes 目录下没有 Game.scene 文件）。
- 场景没加入 Scene List。
- 场景名字大小写不匹配（Cocos 对大小写在某些平台**敏感**）。

**规则**：**`loadScene` 的参数 = Assets 面板里 .scene 文件的文件名（不带后缀）**。大小写原样。

### 易错 2：Home 场景的 Canvas 没保留

新建场景时 Cocos 自动生成 Canvas 节点。如果你手贱把它删了 → HomeController 没得挂 + UI 不渲染。

**规则**：**新建场景后别动根节点**。把脚本挂在 Canvas 上。

### 易错 3：`director.loadScene` 后旧场景的 update 继续跑

```typescript
update(dt) {
    // ... 箭头推进 ...
    // 假设这里触发 director.loadScene('Home')
}
```

Cocos 的 `loadScene` 会**在下一帧销毁当前场景**，所以本帧 update 剩余代码还在跑。如果你在 loadScene 之后访问已销毁的节点，会崩。

**规则**：**loadScene 的调用放在方法最后一句**，或至少确保 loadScene 之后没有访问 this.boardView/this.runtimes 的代码。

### 易错 4：Play 按钮 Graphics 画的区域和 contentSize 不对齐

```typescript
n.addComponent(UITransform).setContentSize(300, 100);
g.rect(0, 0, 300, 100);  // ❌ 从节点左下角开始画
```

UITransform 默认 anchor (0.5, 0.5) = 节点本地原点在中心。`rect(0, 0, ...)` 画的是**从中心往右上** → 右上象限出现一个蓝块，点击范围却是居中 300×100 的区域。**点击和显示错位**。

**规则**：**rect 的起点用 `-width/2, -height/2`** 让图形围绕中心。

### 易错 5：Home 场景字体颜色和背景撞了

如果你给 Canvas 设了深色背景，文字仍是深蓝 `0x606af8` 可能看不清。配色来自 G3_FHome 的 `uiLevelColor`，默认背景白色上好看。

**规则**：**统一先定背景色，再定文字色**。配色集中在一处（Config 或 skin 文件）便于调整。

---

## 扩展练习

1. **加 Home 背景图**：直接在 Canvas 下画一个铺满屏幕的浅色 Graphics 矩形，模仿 G3_FHome 的白色基调。

2. **按钮按下动效**：在 `onPlayClick` 前用 `TOUCH_START` 缩放 0.9，`TOUCH_END` 恢复 1.0。简单版：用 `tween` 做。

3. **思考题**：现在 Home 场景只有静态文字 + 按钮。G3_FHome 的 `FirstUiEffectLogic` 里做了"数字从下往上滑入"的动效。如果要给 Level 数字加这种切换动效（level 变化时旧数字上滑淡出、新数字从下滑入），数据结构上需要哪些字段？（Hint：`oldLevel / newLevel / slideOffsetY / oldOpacity / newOpacity / isAnimating` 对应 G3_FHome 同名字段）

---

**工程状态**：

```
scripts/
├── core/ ...
├── common/Config.ts
├── data/ (空)
├── home/
│   └── HomeController.ts       ← 新增
└── game/
    ├── ArrowView.ts
    ├── BoardView.ts
    ├── GameController.ts        ← Overlay 回 Home
    ├── GameOverOverlay.ts
    ├── HUD.ts
    └── InputController.ts

Assets scenes:
├── Home.scene                   ← 新增
└── Game.scene

Start Scene: Home
```

下一章：**18 · 本地存档** —— 让关卡号真的会保存，通关后从 Level 1 变 Level 2。
