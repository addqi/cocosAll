# 04 — 视口缩放平移（core/viewport）

## 概述

视口系统管理整个涂色盘面的缩放和平移。用户可以双指缩放查看全局，或放大到单个格子精确涂色。所有图层（Board、Brush、Digit）作为 Content 节点的子节点，变换自动继承。

## 需要创建的文件

```
src/core/viewport/
└── ViewportController.ts   # 缩放/平移/边界钳制
```

---

## 原项目架构

**原项目参考**:
- `features/G15/G15_FBase/src/core/domain/G15_FBase_ContentDomain.ts` — 状态容器
- `features/G15/G15_FBase/src/core/component/G15_FBase_ContentComp.ts` — 数据定义
- `features/G15/G15_FBase/src/core/logic/G15_FBase_PinchZoomLogic.ts` — 缩放逻辑
- `features/G15/G15_FBase/src/core/logic/G15_FBase_ViewportDragLogic.ts` — 拖动逻辑
- `features/G15/G15_FBase/src/core/function/G15_FBase_OffsetClampFunction.ts` — 边界钳制
- `features/G15/G15_FBase/src/core/render/G15_FBase_ContentRender.ts` — 变换应用

### 视口状态

```typescript
// 原项目: G15_FBase_ContentComp.ts
interface ViewportState {
    scale: number;       // 当前缩放值
    minScale: number;    // 最小缩放（刚好完整显示整个图案）
    offsetX: number;     // 触摸偏移 X
    offsetY: number;     // 触摸偏移 Y
    gridCols: number;    // 当前关卡实际列数
    gridRows: number;    // 当前关卡实际行数
}
```

### fitScale 计算（初始化）

```typescript
// 原项目: G15_FBase_BoardInitLogic.ts 第92-97行
// 计算刚好让整个图案完整显示在视口中的缩放值
const contentW = gridSize * cellWidth;   // 图案总宽度（像素）
const contentH = gridSize * cellHeight;  // 图案总高度（像素）
const fitScale = Math.min(viewportWidth / contentW, viewportHeight / contentH);
// fitScale 同时作为 minScale（不允许缩得比全景更小）
```

---

## 1. 双指缩放

**原项目参考**: `G15_FBase_PinchZoomLogic.ts`

```typescript
// 原项目: G15_FBase_PinchZoomLogic.ts 第37-66行
onPinchZoom(touches) {
    const dx = touches[1].x - touches[0].x;
    const dy = touches[1].y - touches[0].y;
    const distSq = dx * dx + dy * dy;

    if (lastPinchDistSq > 0) {
        // 缩放比 = sqrt(当前双指距离² / 上次双指距离²)
        let newScale = oldScale * Math.sqrt(distSq / lastPinchDistSq);
        // 钳制到 [minScale, maxScale]
        newScale = Math.max(minScale, Math.min(maxScale, newScale));

        if (newScale !== oldScale) {
            state.scale = newScale;
            clampOffset(); // 缩放后重新钳制偏移
        }
    }
    lastPinchDistSq = distSq;
}
```

### 配置

```typescript
// 原项目: G15_FBase_GameConfig.ts
maxScale: 1.0,           // 最大缩放（每格≈240屏幕像素）
// minScale 由 fitScale 动态计算
```

---

## 2. 单指拖动

**原项目参考**: `G15_FBase_ViewportDragLogic.ts`

```typescript
// 原项目: G15_FBase_ViewportDragLogic.ts 第25-38行
// 极简: 当前偏移 += 手指移动增量, 然后钳位
onDragPan(dx, dy) {
    state.offsetX += dx;
    state.offsetY += dy;
    clampOffset();
}
```

---

## 3. 偏移边界钳制

**原项目参考**: `G15_FBase_OffsetClampFunction.ts`

确保平移后盘面不会飞出屏幕。

```typescript
// 原项目: G15_FBase_OffsetClampFunction.ts 第21-55行
function clampOffset() {
    const scaledW = gridCols * cellWidth * scale;  // 缩放后盘面宽
    const scaledH = gridRows * cellHeight * scale; // 缩放后盘面高

    // 放大状态下允许额外留白（viewportPadding=200 像素）
    const padding = scale > minScale ? viewportPadding : 0;

    // X 轴钳制
    if (scaledW > viewportWidth) {
        // 盘面比视口宽 → 允许左右平移, 但不能超出
        const maxOX = (scaledW - viewportWidth) / 2 + padding;
        offsetX = Math.max(-maxOX, Math.min(maxOX, offsetX));
    } else {
        // 盘面比视口窄 → 居中
        offsetX = 0;
    }

    // Y 轴同理
    if (scaledH > viewportHeight) {
        const maxOY = (scaledH - viewportHeight) / 2 + padding;
        offsetY = Math.max(-maxOY, Math.min(maxOY, offsetY));
    } else {
        offsetY = 0;
    }
}
```

### 配置

```typescript
// 原项目: G15_FBase_GameConfig.ts
viewportWidth: 960,       // 视口宽度
viewportHeight: 1320,     // 视口高度
viewportPadding: 200,     // 放大时的额外留白
```

---

## 4. 缩放淡入淡出

**原项目参考**: `G15_FBase_ZoomFadeLogic.ts`

放大时底图渐白、数字/网格线渐显的视觉效果。这是可选的视觉增强。

```typescript
// 原项目: G15_FBase_ZoomFadeLogic.ts 第62-66行
// 在 minScale*1.2 到 gridFullScale 之间做 smoothstep 插值
const gridShowScale = minScale * 1.2;
const alpha = smoothstep(gridShowScale, gridFullScale, currentScale);

// alpha=0 → 原始灰度（远景）
// alpha=1 → 淡化为白色（近景），数字完全可见
```

---

## 接口设计

```typescript
export class ViewportController {
    /** 当前缩放 */
    scale: number;
    /** 最小缩放（fitScale） */
    minScale: number;
    /** 偏移 */
    offsetX: number = 0;
    offsetY: number = 0;

    constructor(
        private gridCols: number,
        private gridRows: number,
        private cellWidth: number,
        private cellHeight: number,
        private viewportWidth: number,
        private viewportHeight: number,
        private maxScale: number,
        private viewportPadding: number,
    ) {
        // 计算 fitScale
        const contentW = gridCols * cellWidth;
        const contentH = gridRows * cellHeight;
        this.minScale = Math.min(viewportWidth / contentW, viewportHeight / contentH);
        this.scale = this.minScale;
    }

    /** 双指缩放 */
    applyPinchZoom(distSq: number, lastDistSq: number): void;

    /** 单指拖动 */
    applyDrag(dx: number, dy: number): void;

    /** 边界钳制（缩放/拖动后必须调用） */
    clampOffset(): void;

    /** 更新关卡尺寸（切换关卡时） */
    updateGridSize(cols: number, rows: number): void;
}
```

---

## Content 节点变换

在 Cocos 3.8 中, Content 节点的变换直接反映视口状态:

```typescript
// 对应原项目: G15_FBase_ContentRender.ts 第10-19行
// Content 节点的 position 和 scale 绑定到视口状态
contentNode.setPosition(viewport.offsetX, viewport.offsetY, 0);
contentNode.setScale(viewport.scale, viewport.scale, 1);
// Board/Brush/Digit 作为 Content 的子节点, 自动继承变换
```
