# 20 · 长按显示射线预览（Ray）

## 本节目标

**按住某根 Idle 箭头超过 0.3 秒，它的方向上会出现一条半透明射线**，预示它如果发射会飞到哪里（撞什么）。松手射线消失。松手立刻发射。

预期：

- Touch Start 箭头 0 → 0.3 秒内如果放手 → 直接发射（快点击）。
- Touch Start 箭头 0 → 按住 0.3 秒以上 → 出现一条射线（从箭头头延伸到前方第一个障碍/边界）。
- 放手瞬间 → 射线消失 → 箭头发射。

一句话：**瞄准辅助**。

---

## 需求分析

对照 G3_FBase `MovingIdleLogic`：

```typescript
if (data.runtime.touchTime > 0 &&
    component.index[eid] === data.runtime.arrowIndex &&
    now - data.runtime.touchTime > 0.3) {
    component.highlight.set(eid, true);
    component.ray.set(eid, true);
    data.runtime.selectedArrow = true;
}
```

核心数据：

- `touchTime`：按下箭头的时间戳。
- `arrowIndex`：当前被按住的箭头 index。
- 长按阈值 `0.3` 秒。

### 射线的终点

从箭头头沿 direction 射到"第一个障碍"或"棋盘边界"。

直接复用 `findCollision`！它返回 `{targetIdx, point}`：

- `point` 不为空 → 终点 = point（撞到另一根箭头的格子）
- `point` 为空 → 终点 = 棋盘边界的那一格（沿 direction 找到出界前的最后格子）

我们扩展一个工具函数 `computeRayEnd`。

---

## 实现思路

### 输入升级：TOUCH_START + TOUCH_END

08 章的 `InputController` 只监听 TOUCH_END。本章要加 TOUCH_START 和 TOUCH_MOVE：
- TOUCH_START 记录按下时刻和被按中的箭头索引。
- TOUCH_MOVE 判断按住时长、超过 0.3s 就进入"长按预览"模式，让 GameController 画射线。
- TOUCH_END 分流：短按走 08 章那套 fire 流程，长按就根据"按住时有没有超过 0.3s"做不同处理。

**TOUCH_END 时的分支**：

- 如果从未进入长按（time < 0.3） → 走正常 fire 流程（快点击）。
- 如果已经是长按（> 0.3） → 仍然 fire（长按后放手也是"确认发射"）。

**长按效果仅在"按住过程中"**：手指还按着屏幕时显示射线。松手瞬间就 fire。

### 射线渲染

Ray 是一个独立的 Graphics，从"箭头当前 head（像素坐标）"画到"射线终点（像素坐标）"。

**挂哪？** 一个选择：每根 ArrowView 自带一条 ray。另一个选择：全局一条 ray（同时只有一根箭头被按住）。

**选后者**。理由：**同时只会有一根手指按着一根箭头**，全局一条足够。不用为每根箭头都创建 Graphics。

新增 `RayView` 组件，GameController 持有一个实例。

---

## 代码实现

### 文件 1：`core/CollisionCheck.ts` 加 `computeRayEnd`

```typescript
/**
 * 计算从 shooter 射出的射线终点：
 * - 撞到别的箭头 → 返回那一格
 * - 飞出棋盘 → 返回出界前的最后一格
 */
export function computeRayEnd(
    shooterIdx: number,
    runtimes: readonly ArrowRuntime[],
    direction: Direction,
    rows: number, cols: number,
): Cell {
    const shooter = runtimes[shooterIdx];
    const head = shooter.coords[shooter.coords.length - 1];
    let r = head[0], c = head[1];
    let lastInside: Cell = [r, c];

    while (true) {
        r += direction[0];
        c += direction[1];
        if (!isInsideBoard(r, c, rows, cols)) return lastInside;
        for (let j = 0; j < runtimes.length; j++) {
            if (j === shooterIdx) continue;
            const rt = runtimes[j];
            if (rt.mode >= ArrowMoveMode.Start) continue;  // 已起飞 / 已逃脱 → 不挡路，和 findCollision 保持一致
            if (rt.coords.some(p => p[0] === r && p[1] === c)) return [r, c];
        }
        lastInside = [r, c];
    }
}
```

**关键点**：**复用 while 循环结构**，和 findCollision 一个模子。出界返回 lastInside（记录了最后一个合法格）。

### 文件 2：`game/RayView.ts`（新增）

```typescript
import {
    _decorator, Component, UITransform, Graphics, Color,
} from 'cc';
import { Cell } from '../core/LevelData';
import { gridToPixel } from '../core/Coord';
import { Config } from '../common/Config';
const { ccclass } = _decorator;

const RAY_COLOR = new Color(0xd7, 0xd9, 0xe8, 0x80);  // 半透明浅灰
const RAY_WIDTH = 8;  // 比箭头细

@ccclass('RayView')
export class RayView extends Component {
    private graphics: Graphics | null = null;

    onLoad() {
        this.ensureGraphics();
        this.clear();
    }

    /** 画一条从 fromCell 到 toCell 的射线 */
    show(from: Cell, to: Cell, rows: number, cols: number) {
        const g = this.graphics!;
        g.clear();
        const fp = gridToPixel(from[0], from[1], rows, cols);
        const tp = gridToPixel(to[0], to[1], rows, cols);
        g.strokeColor = RAY_COLOR;
        g.lineWidth = RAY_WIDTH;
        g.moveTo(fp.x, fp.y);
        g.lineTo(tp.x, tp.y);
        g.stroke();
    }

    clear() {
        this.graphics?.clear();
    }

    private ensureGraphics() {
        if (this.graphics) return;
        if (!this.node.getComponent(UITransform)) {
            this.node.addComponent(UITransform);
        }
        this.graphics = this.node.addComponent(Graphics);
    }
}
```

### 文件 3：`InputController.ts` 升级为按下+松开

```typescript
import {
    _decorator, Component, EventTouch, Input, UITransform, Vec3, director,
} from 'cc';
import { findArrowIndex } from '../core/Coord';
import { ArrowRuntime, ArrowMoveMode } from '../core/ArrowState';
import { LevelData } from '../core/LevelData';
const { ccclass } = _decorator;

export interface InputHandlers {
    onTouchStartArrow: (idx: number) => void;
    onTouchEndArrow: (idx: number, longPressed: boolean) => void;
    onTouchCancel: () => void;
}

@ccclass('InputController')
export class InputController extends Component {
    private data: LevelData | null = null;
    private runtimes: ArrowRuntime[] = [];
    private handlers: InputHandlers | null = null;

    private touchedArrowIdx = -1;
    private touchStartTime = 0;

    setup(data: LevelData, runtimes: ArrowRuntime[], handlers: InputHandlers) {
        this.data = data;
        this.runtimes = runtimes;
        this.handlers = handlers;

        let ui = this.node.getComponent(UITransform);
        if (!ui) ui = this.node.addComponent(UITransform);
        ui.setContentSize(100000, 100000);

        this.node.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.on(Input.EventType.TOUCH_CANCEL, this.onTouchEndOrCancel, this);
    }

    onDestroy() {
        this.node.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.off(Input.EventType.TOUCH_CANCEL, this.onTouchEndOrCancel, this);
    }

    private onTouchStart(event: EventTouch) {
        if (!this.data || !this.handlers) return;
        const local = this.eventToLocal(event);
        const idx = findArrowIndex(local.x, local.y, this.runtimes, this.data.rows, this.data.cols);
        if (idx < 0) {
            this.touchedArrowIdx = -1;
            return;
        }
        this.touchedArrowIdx = idx;
        this.touchStartTime = director.getTotalTime() / 1000;
        this.handlers.onTouchStartArrow(idx);
    }

    private onTouchEnd(event: EventTouch) {
        if (!this.handlers) return;
        if (this.touchedArrowIdx < 0) return;
        const now = director.getTotalTime() / 1000;
        const longPressed = (now - this.touchStartTime) >= 0.3;
        this.handlers.onTouchEndArrow(this.touchedArrowIdx, longPressed);
        this.touchedArrowIdx = -1;
    }

    private onTouchEndOrCancel() {
        if (this.touchedArrowIdx < 0) return;
        this.handlers?.onTouchCancel();
        this.touchedArrowIdx = -1;
    }

    /** 外部查询：当前是否按住某根箭头已超过 0.3 秒 */
    isLongPressing(): { idx: number; longPressed: boolean } {
        if (this.touchedArrowIdx < 0) return { idx: -1, longPressed: false };
        const now = director.getTotalTime() / 1000;
        return {
            idx: this.touchedArrowIdx,
            longPressed: (now - this.touchStartTime) >= 0.3,
        };
    }

    private eventToLocal(event: EventTouch): { x: number; y: number } {
        const uiLoc = event.getUILocation();
        const world = new Vec3(uiLoc.x, uiLoc.y, 0);
        const ui = this.node.getComponent(UITransform)!;
        return ui.convertToNodeSpaceAR(world);
    }
}
```

**关键点**：

- **用 `InputHandlers` 接口而不是单函数**：本章 `InputController` 要回报的事件变多了（长按开始、长按中、放手 fire），一个函数塞不下。接口把相关回调聚成一组，将来再加"双击"等也只加字段、调用方逐步补。
- **`touchedArrowIdx = -1` 表示未按住**。防御性设计。
- **`isLongPressing()` 提供给外部每帧查询**（GameController 用来画 Ray）。

### 文件 4：`GameController.ts` 接入 Ray

```typescript
import { RayView } from './RayView';
import { computeRayEnd } from '../core/CollisionCheck';

private rayView: RayView | null = null;

onLoad() {
    // ... 已有
    this.boardView = this.createBoardView();
    this.rayView = this.createRayView();
    this.input = this.boardView.node.addComponent(InputController);
    // ...
}

private createRayView(): RayView {
    const node = new Node('RayView');
    this.boardView!.node.addChild(node);  // 挂在 BoardView 下，跟着 scale 缩放
    return node.addComponent(RayView);
}

// setup 改动：
private onLevelLoaded(data: LevelData) {
    // ... 已有
    this.input?.setup(data, this.runtimes, {
        onTouchStartArrow: (idx) => this.onArrowTouchStart(idx),
        onTouchEndArrow: (idx, longPressed) => this.onArrowTouchEnd(idx, longPressed),
        onTouchCancel: () => this.onTouchCancel(),
    });
}

private onArrowTouchStart(idx: number) {
    // 什么都不做，长按效果由 update 里每帧判断
    console.log(`[Arrow] Arrow ${idx} touch start`);
}

private onArrowTouchEnd(idx: number, longPressed: boolean) {
    this.rayView?.clear();
    if (this.gameOver) return;
    const rt = this.runtimes[idx];
    if (!canFire(rt)) return;

    const data = this.levelData!;
    const result = findCollision(
        idx, this.runtimes, data.arrows[idx].direction, data.rows, data.cols
    );
    fire(rt, result.targetIdx >= 0, result.point);
    console.log(`[Arrow] Arrow ${idx} fired. longPressed=${longPressed}`);
    this.refreshArrow(idx);
}

private onTouchCancel() {
    this.rayView?.clear();
}

// update 里加：
update(dt: number) {
    // ... 已有 runtime 推进 ...

    // 长按中 → 画 Ray
    this.updateRay();

    // 胜负判定 ...
}

private updateRay() {
    if (!this.input || !this.rayView || !this.levelData) return;
    const { idx, longPressed } = this.input.isLongPressing();
    if (idx < 0 || !longPressed) {
        this.rayView.clear();
        return;
    }
    const rt = this.runtimes[idx];
    if (rt.mode !== ArrowMoveMode.Idle) {
        this.rayView.clear();
        return;
    }
    const arrow = this.levelData.arrows[idx];
    const head = rt.coords[rt.coords.length - 1];
    const endCell = computeRayEnd(
        idx, this.runtimes, arrow.direction, this.levelData.rows, this.levelData.cols
    );
    this.rayView.show(head, endCell, this.levelData.rows, this.levelData.cols);
}
```

**关键点**：

- **RayView 挂在 BoardView 下**，跟着缩放。保持视觉一致。
- **`updateRay()` 每帧调一次**：只要处于长按中，就更新 Ray。按住时箭头不会动（Idle），所以 Ray 终点基本稳定——但**每帧重画**也无妨，简单。
- **TouchCancel 处理**：手指滑出屏幕、系统中断时触发。必须 clear Ray。

---

## 运行效果

1. 点击箭头（< 0.3s 放手）：立刻发射，没有 Ray 出现（太快看不见）。
2. 按住箭头（> 0.3s）：**射线出现**，从箭头头延伸到前方第一个障碍或边界。
3. 松手：射线消失，箭头发射。
4. 用 level_02（有互挡）验证：长按箭头 0，Ray 短——终点是箭头 1 的尾格。

Console：

```
[Arrow] Arrow 0 touch start
[Arrow] Arrow 0 fired. longPressed=true
```

---

## 易错点

### 易错 1：Ray 画在 Canvas 层，BoardView 缩放后坐标不对

```typescript
this.node.addChild(rayNode);  // ❌ 挂到 GameController（Canvas）
```

Ray 用 BoardView 的本地坐标（`gridToPixel`），但如果 Ray 挂 Canvas 而不是 BoardView，Canvas 的坐标系没有 BoardView 的 scale → 画到奇怪位置。

**规则**：**RayView 挂 BoardView.node**。和其他画面一起缩放。

### 易错 2：长按判定漏掉 `rt.mode === Idle`

```typescript
if (idx < 0 || !longPressed) return;
// 没判 rt.mode
```

玩家长按一根正在 Start/Back 的箭头（比如第 13 章失败后按住正在回弹的箭头），Ray 会画在移动中的位置，很乱。

**规则**：**Ray 只在 Idle 状态显示**。参考 G3_FBase 的 `MovingIdleLogic` 里判定。

### 易错 3：TOUCH_CANCEL 没处理

```typescript
this.node.on(TOUCH_START, ...);
this.node.on(TOUCH_END, ...);
// 漏了 TOUCH_CANCEL
```

手指滑出屏幕、系统弹通知打断触摸 → TOUCH_END 不触发，但 TOUCH_CANCEL 触发。**Ray 卡住不消失**。

**规则**：**三种触摸事件要一套管**（START/END/CANCEL）。

### 易错 4：computeRayEnd 返回错了格子

比如 shooter 的头刚好就在棋盘边界 `[1,5]`（已经在最右列）。while 循环第一步就 "出界 return lastInside = head"。**射线从 head 到 head，画不出线**（长度 0）。

**处理**：RayView 或 GameController 判断 from === to 时跳过画线。或者接受"射线长度 0"的显示（什么都不画），不影响体验。

### 易错 5：速度超快的松手产生 Ray 闪烁

玩家按下 0.35s 放手的一刻，有那么一两帧 Ray 显示又消失。视觉上可能有闪烁。

**优化**：onTouchEnd 最开头就 `rayView.clear()`，视觉上先抹掉 Ray 再 fire。已在代码里做了。

---

## 扩展练习

1. **被撞目标高亮**：长按时除了 Ray，把"被撞的那根箭头"闪一下（找到 target index，临时 setColor 或 alpha）。提示：computeRayEnd 只返回格子，你需要反查 index——或者让 computeRayEnd 返回 `{end: Cell, targetIdx: number}`。

2. **Ray 动画**：让 Ray 颜色有脉动效果（alpha 0.5~1.0 正弦波动）。用 `director.getTotalTime()` 驱动。

3. **思考题**：G3_FBase 的 Ray 实现有个特殊处理——**长按超过阈值才"选中"箭头**，不选中时点击松开不发射。我们这里"选没选中都松开就发射"更宽松。两种设计哪个更好？对玩家体验有什么影响？

---

**工程状态**：

```
core/
├── CollisionCheck.ts            ← 加 computeRayEnd
game/
├── InputController.ts            ← 支持 START+END+CANCEL + isLongPressing
├── RayView.ts                    ← 新增
└── GameController.ts             ← 接入 RayView + updateRay
```

下一章（最后一章）：**21 · 扩展练习** —— 给新人留的自由发挥空间。
