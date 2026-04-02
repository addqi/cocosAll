# 03 — 输入与手势（core/input）

## 概述

输入系统负责将 Cocos 原生触摸事件转化为游戏逻辑能理解的手势：单指点击、单指拖动、双指捏合缩放。核心难点是**50ms 单指确认延迟**——避免双指缩放的第一根手指被误判为涂色。

## 需要创建的文件

```
src/core/input/
├── TouchHandler.ts      # Cocos 触摸事件接入
└── GestureDetector.ts   # 手势状态机
```

---

## 1. GestureDetector.ts — 手势状态机

**原项目参考**:
- `features/G15/G15_FBase/src/core/logic/G15_FBase_TouchMoveLogic.ts`（TouchStartLogic + TouchMoveLogic + PinchEndLogic）
- `features/G15/G15_FBase/src/core/signal/G15_FBase_SingleTouchStartRouter.ts`

### 手势状态定义

```typescript
// 原项目: G15_FBase_TouchStartLogic.defineRuntimeData（第36-52行）
interface GestureState {
    /** 是否命中了可涂色格子（决定是涂色模式还是拖动模式） */
    hited: boolean;
    /** 本次 touch 期间是否曾进入双指 */
    hadPinchGesture: boolean;
    /** 上次双指距离平方（用于计算缩放比） */
    lastPinchDistSq: number;
    /** 是否已移动超过阈值 */
    moved: boolean;
    /** 拖动涂色时的上一个格子位置 */
    lastPaintRow: number;
    lastPaintCol: number;
    hasLastPaintPos: boolean;
    /** 本次 touch 是否已经执行过涂色 */
    paintStarted: boolean;
}
```

### 50ms 单指确认延迟

```typescript
// 原项目: G15_FBase_SingleTouchStartRouter.ts 第54-82行
// 问题: 用户想双指缩放时,第一根手指先 touchstart,第二根几十ms后才到。
// 如果不延迟,第一根手指会被当成涂色点击。
//
// 方案: touchstart 来了先 Defer，50ms 后:
// - 如果期间出现第二根手指 → Cancel（不是单指）
// - 如果一直是单指 → FireOnce（确认单指）

const SINGLE_TOUCH_DELAY = 0.05; // 50ms

onTouchStart() {
    this._delayStartTime = now;
    this._pendingSingleTouch = true;
}

onUpdate() {
    if (!this._pendingSingleTouch) return;
    if (touches.length >= 2 || hadPinchGesture) {
        this._pendingSingleTouch = false; // Cancel
        return;
    }
    if (now - this._delayStartTime >= SINGLE_TOUCH_DELAY) {
        this._pendingSingleTouch = false;
        this._confirmSingleTouch(); // FireOnce
    }
}
```

### TouchStart 逻辑

```typescript
// 原项目: G15_FBase_TouchStartLogic.onExecute（第54-82行）
onTouchStart() {
    // 1. 重置所有状态
    state.hited = false;
    state.moved = false;
    state.hadPinchGesture = false;
    state.hasLastPaintPos = false;
    state.paintStarted = false;

    // 2. 双指 → 直接进入 pinch 模式
    if (touches.length >= 2) {
        state.hadPinchGesture = true;
        state.lastPinchDistSq = calcDistSq(touches[0], touches[1]);
        return;
    }

    // 3. 单指 → 命中检测（决定涂色还是拖动）
    state.hited = cellHitTest.hitTest(...);
    if (state.hited) {
        const pos = cellHitTest.snapPaintCell(...);
        if (pos) {
            state.lastPaintRow = pos.row;
            state.lastPaintCol = pos.col;
            state.hasLastPaintPos = true;
        }
    }
}
```

### TouchMove 逻辑

```typescript
// 原项目: G15_FBase_TouchMoveLogic.onExecute（第112-125行）
onTouchMove() {
    // 双指 → 标记 pinch
    if (touches.length >= 2) {
        state.hadPinchGesture = true;
        return;
    }
    if (state.hadPinchGesture) return; // 曾经双指过就不再处理

    // 单指 → 移动距离阈值检测
    if (!state.moved) {
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
        state.moved = true;
    }
}
```

### TouchEnd 条件分发

```typescript
// 原项目: G15_FBase_PaintRouter.ts 第59-70行（TouchEnd→Paint 路由条件）
//
// 点击涂色: !hadPinchGesture && !moved → 执行涂色
// 拖动涂色: !hadPinchGesture && hited && moved → 每帧 move 时涂色
// 拖动平移: !hadPinchGesture && !hited && moved → 平移视口
// 双指缩放: hadPinchGesture → PinchZoomLogic 处理
```

### 接口设计

```typescript
export interface GestureCallbacks {
    /** 点击涂色（touchEnd 时触发，!pinch && !moved） */
    onTapPaint: (localX: number, localY: number) => void;
    /** 拖动涂色（touchMove 时触发，!pinch && hited && moved） */
    onDragPaint: (localX: number, localY: number) => void;
    /** 拖动平移（touchMove 时触发，!pinch && !hited && moved） */
    onDragPan: (dx: number, dy: number) => void;
    /** 双指缩放（touchMove 时触发，pinch） */
    onPinchZoom: (scaleDelta: number, centerX: number, centerY: number) => void;
    /** 触摸结束 */
    onTouchEnd: () => void;
}

export class GestureDetector {
    constructor(
        private callbacks: GestureCallbacks,
        private hitTestFn: (localX: number, localY: number) => boolean,
    ) {}

    /** 移动阈值（像素） */
    moveThreshold: number = 5;

    /** 处理 touchStart */
    handleTouchStart(touches: Touch[]): void;
    /** 处理 touchMove */
    handleTouchMove(touches: Touch[]): void;
    /** 处理 touchEnd */
    handleTouchEnd(touches: Touch[]): void;
}
```

---

## 2. TouchHandler.ts — Cocos 触摸事件接入

**原项目参考**: `features/G15/G15_FBase/src/core/signal/G15_FBase_ViewportTouchRouter.ts`

将 Cocos 的 `EventTouch` 转为 GestureDetector 需要的标准化输入。这是唯一依赖 Cocos 引擎 API 的输入层文件。

### 接口设计

```typescript
import { Component, Node, EventTouch, UITransform, Vec3 } from 'cc';

export class TouchHandler {
    private _gestureDetector: GestureDetector;
    private _node: Node;

    constructor(node: Node, gestureDetector: GestureDetector) {
        this._node = node;
        this._gestureDetector = gestureDetector;
        node.on(Node.EventType.TOUCH_START, this._onStart, this);
        node.on(Node.EventType.TOUCH_MOVE, this._onMove, this);
        node.on(Node.EventType.TOUCH_END, this._onEnd, this);
        node.on(Node.EventType.TOUCH_CANCEL, this._onEnd, this);
    }

    /** 屏幕坐标 → 节点本地坐标 */
    private _toLocal(event: EventTouch): Vec3 {
        const ut = this._node.getComponent(UITransform)!;
        const loc = event.getUILocation();
        return ut.convertToNodeSpaceAR(new Vec3(loc.x, loc.y, 0));
    }

    destroy(): void {
        this._node.off(Node.EventType.TOUCH_START, this._onStart, this);
        this._node.off(Node.EventType.TOUCH_MOVE, this._onMove, this);
        this._node.off(Node.EventType.TOUCH_END, this._onEnd, this);
        this._node.off(Node.EventType.TOUCH_CANCEL, this._onEnd, this);
    }
}
```

---

## 手势判定决策树

```
touchStart
  ├── touches >= 2 → pinch 模式
  └── touches == 1 → 50ms 延迟确认
       └── 确认单指 → cellHitTest?
            ├── hit=true → 涂色模式候选
            └── hit=false → 拖动模式候选

touchMove
  ├── touches >= 2 → onPinchZoom
  ├── hadPinch → 忽略
  ├── !moved && dist<5 → 忽略（还没移动够）
  └── moved=true
       ├── hited → onDragPaint
       └── !hited → onDragPan

touchEnd
  ├── hadPinch → 不涂色
  ├── moved → 不涂色（拖动已经处理了）
  └── !hadPinch && !moved → onTapPaint（点击涂色）
```
