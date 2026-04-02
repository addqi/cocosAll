# 02 — 涂色系统（core/paint）

## 概述

涂色系统负责：屏幕坐标→格子转换、命中检测与吸附、涂色执行、拖动路径补线。这是核心玩法的大脑，不涉及渲染（只写 PixelBuffer 数据）。

## 需要创建的文件

```
src/core/paint/
├── CellConverter.ts    # 坐标转换
├── CellHitTest.ts      # 命中检测 + 吸附
├── PaintExecutor.ts    # 涂色执行
└── LineFill.ts         # Bresenham 补线
```

---

## 1. CellConverter.ts — 坐标转换

**原项目参考**: `features/G15/G15_FBase/src/core/function/G15_FBase_PointerToCellFunction.ts`

将触摸点的屏幕坐标转换为网格的 row/col。

### 核心算法

```typescript
// 原项目: G15_FBase_PointerToCellFunction.ts 第33-39行
//
// 输入: localX/localY = 触摸点在内容节点本地坐标系中的位置
//       ox/oy = 内容偏移, scale = 缩放值
// 步骤:
// 1. 去偏移、去缩放: 得到内容坐标系下的裸坐标
// 2. 加半宽 / 除格子宽 = 列号
// 3. 半高减去 / 除格子高 = 行号 (Y轴翻转: 屏幕Y朝上, 行号朝下)

const localX = (pointerLocalX - offsetX) / scale;
const localY = (pointerLocalY - offsetY) / scale;
const colF = (localX + totalWidth / 2) / cellWidth;
const rowF = (totalHeight / 2 - localY) / cellHeight;
const col = Math.floor(colF);
const row = Math.floor(rowF);
// 越界检查
if (col < 0 || col >= gridCols || row < 0 || row >= gridRows) return null;
return { row, col };
```

### 接口设计

```typescript
import { CellPosition } from '../../types';

export class CellConverter {
    constructor(
        private gridCols: number,
        private gridRows: number,
        private cellWidth: number,
        private cellHeight: number,
    ) {}

    /**
     * 屏幕触摸坐标 → 格子行列
     * @param localX  触摸点在内容节点本地坐标 X
     * @param localY  触摸点在内容节点本地坐标 Y
     * @param offsetX 内容偏移 X
     * @param offsetY 内容偏移 Y
     * @param scale   当前缩放值
     */
    pointerToCell(localX: number, localY: number, offsetX: number, offsetY: number, scale: number): CellPosition | null;

    /** 更新网格尺寸（切换关卡时调用） */
    updateGridSize(cols: number, rows: number): void;
}
```

---

## 2. CellHitTest.ts — 命中检测 + 吸附

**原项目参考**: `features/G15/G15_FBase/src/core/function/G15_FBase_PointerSnapPaintCellFunction.ts` + `G15_FBase_CellHitTestFunction.ts`

判断触摸点是否命中了一个**可涂色**的格子。当手指不在目标格正中心时，会按偏离方向检查相邻格并在指定半径内吸附。

### 吸附算法详解

```typescript
// 原项目: G15_FBase_PointerSnapPaintCellFunction.ts 第31-81行
//
// 规则（按优先级）:
// 1. 本格可涂色 → 直接返回本格
// 2. 本格不可涂色 → 计算手指相对本格中心的偏移 dx/dy
//    → 按主方向(|dx|>=|dy|则水平, 否则垂直)找相邻格
//    → 相邻格可涂色 && 距离在 snapRadius 内 → 返回相邻格
// 3. 都不满足 → 返回 null

function canPaintCell(row: number, col: number, brushIndex: number): boolean {
    // 格子在范围内 && 格子的正确颜色 === 当前画笔 && 格子未被正确填充
    return boardData.getBrushIndex(row, col) === brushIndex
        && !isCellFilled(row, col);
}

// 1. 先检查本格
if (canPaintCell(row, col)) return { row, col };

// 2. 按偏离方向找相邻格
const dx = localX - centerX(col);
const dy = localY - centerY(row);
let targetRow = row, targetCol = col;
if (Math.abs(dx) >= Math.abs(dy)) {
    targetCol += dx >= 0 ? 1 : -1;
} else {
    targetRow += dy >= 0 ? -1 : 1;  // 注意Y轴方向
}

// 3. 检查相邻格 + 距离限制
if (!canPaintCell(targetRow, targetCol)) return null;
const ndx = localX - centerX(targetCol);
const ndy = localY - centerY(targetRow);
if (Math.abs(ndx) > halfCellWidth + snapRadiusLocal) return null;
if (Math.abs(ndy) > halfCellHeight + snapRadiusLocal) return null;
return { row: targetRow, col: targetCol };
```

### 配置参数

```typescript
// 原项目: G15_FBase_GameConfig.ts 第101行
paintSnapRadiusPx: 40  // 吸附半径（屏幕像素）
// 转换为本地坐标: snapRadiusLocal = paintSnapRadiusPx / scale
```

### 接口设计

```typescript
export class CellHitTest {
    constructor(
        private cellConverter: CellConverter,
        private boardData: BoardData,
        private brushState: BrushState,
        private brushPixels: PixelBuffer,  // 用于判断 isFilled
        private snapRadiusPx: number,
    ) {}

    /**
     * 查找可涂色的目标格子（含吸附逻辑）
     * @returns 目标格子位置，或 null
     */
    snapPaintCell(
        localX: number, localY: number,
        offsetX: number, offsetY: number, scale: number
    ): CellPosition | null;

    /**
     * 简单命中检测（不含吸附，只检查 snapPaintCell 是否返回非 null）
     */
    hitTest(localX: number, localY: number,
            offsetX: number, offsetY: number, scale: number): boolean;
}
```

---

## 3. PaintExecutor.ts — 涂色执行

**原项目参考**: `features/G15/G15_FBase/src/core/function/G15_FBase_CellPaintRecordFunction.ts` + `G15_FBase_CellBrushWriteFunction.ts`

执行涂色操作：写像素 + 判断匹配 + 记录结果。**只写数据，不触发渲染**（渲染由外部调 flush）。

### 核心逻辑

```typescript
// 原项目: G15_FBase_CellPaintRecordFunction.ts 第72-98行
//
// 对每个待涂的格子:
// 1. 查正确答案: cellBrushIndex = boardData.getBrushIndex(row, col)
// 2. 判断匹配: matched = (cellBrushIndex >= 0 && cellBrushIndex === cell.brushIndex)
// 3. 写 Brush 层:
//    - matched → alpha=255 (全不透明, 表示正确涂色)
//    - !matched → alpha=100 (半透明, 表示涂错了)
// 4. 如果 matched，还要:
//    - Board 层 alpha→0 (灰度底图消失)
//    - Digit 层 R→0, alpha→0 (数字消失)
// 5. 记录到 entries 数组
```

### Hex 颜色解析（带缓存）

```typescript
// 原项目: G15_FBase_CellBrushWriteFunction.ts 第43-54行
// 用 Map 缓存已解析的颜色，palette 变化时清空
let cachedPalette: string[] | null = null;
const colorCache = new Map<number, [number, number, number]>();

// 查询时:
if (palette !== cachedPalette) { colorCache.clear(); cachedPalette = palette; }
let rgb = colorCache.get(brushIndex);
if (!rgb) {
    const hexStr = palette[brushIndex] ?? '#000000';
    const hex = parseInt(hexStr.slice(1), 16);
    rgb = [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
    colorCache.set(brushIndex, rgb);
}
```

### 接口设计

```typescript
export class PaintExecutor {
    constructor(
        private brushPixels: PixelBuffer,   // Brush 层
        private boardPixels: PixelBuffer,   // Board 层
        private digitPixels: PixelBuffer,   // Digit 层
        private boardData: BoardData,
        private brushState: BrushState,
    ) {}

    /** 涂色记录（本次 touch 生命周期内累计） */
    readonly entries: PaintEntry[] = [];

    /** 清空记录（每次 touchStart 时调用） */
    clearEntries(): void;

    /**
     * 批量涂色
     * @param cells 待涂格子数组
     * @returns 每个格子是否匹配成功
     */
    paintCells(cells: CellBrushEntry[]): boolean[];

    /** 是否需要刷新 Brush 纹理（有写入操作后为 true） */
    brushDirty: boolean;
    /** 是否需要刷新 Board 纹理 */
    boardDirty: boolean;
    /** 是否需要刷新 Digit 纹理 */
    digitDirty: boolean;

    /** 重置 dirty 标记（flush 之后调用） */
    resetDirty(): void;
}
```

---

## 4. LineFill.ts — Bresenham 拖动补线

**原项目参考**: `features/G15/G15_FBase/src/core/function/G15_FBase_CollectPaintCellsFunction.ts`

当用户拖动涂色时，手指移动速度可能很快，两帧之间跳过多个格子。用 Bresenham 直线算法在起点和终点之间补全所有经过的格子。

### 算法实现

```typescript
// 原项目: G15_FBase_CollectPaintCellsFunction.ts 第41-88行
// 标准 Bresenham 直线算法, 增加了:
// - skipFirst: 连续拖动时跳过起点（避免重复涂起点格子）
// - 跳过空格（cellBrushIndex < 0）
// - 跳过已正确填充的格子（brushPixels alpha === 255）

function collectPaintCells(
    hasFrom: boolean,        // 是否有起点
    fromRow: number, fromCol: number,  // 起点
    toRow: number, toCol: number,      // 终点
    brushIndex: number,      // 当前画笔
    skipFirst: boolean,      // 是否跳过首格
    out: CellBrushEntry[]    // 输出缓冲（复用，减少 GC）
): CellBrushEntry[] {
    out.length = 0;
    const x0 = hasFrom ? fromCol : toCol;
    const y0 = hasFrom ? fromRow : toRow;
    const x1 = toCol, y1 = toRow;

    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0, y = y0;
    let first = true;

    while (true) {
        if (!skipFirst || !first) {
            // 只收集非空格 && 未正确填充的格子
            if (cellBrushIndex(y, x) >= 0) {
                if (brushPixels.getAlpha(y, x) !== 255) {
                    out.push({ row: y, col: x, brushIndex });
                }
            }
        }
        if (x === x1 && y === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x += sx; }
        if (e2 <= dx) { err += dx; y += sy; }
        first = false;
    }
    return out;
}
```

### 接口设计

```typescript
export class LineFill {
    constructor(
        private boardData: BoardData,
        private brushPixels: PixelBuffer,
    ) {}

    /** 复用缓冲区，避免每帧创建数组 */
    private _pending: CellBrushEntry[] = [];

    /**
     * 收集从起点到终点路径上所有需要涂色的格子
     */
    collect(
        hasFrom: boolean,
        fromRow: number, fromCol: number,
        toRow: number, toCol: number,
        brushIndex: number,
        skipFirst: boolean,
    ): CellBrushEntry[];
}
```

---

## 涂色管线总流程

```
TouchEnd（点击）/ TouchMove（拖动）
  ↓
CellConverter.pointerToCell()        → 屏幕坐标 → {row, col}
  ↓
CellHitTest.snapPaintCell()          → 吸附到可涂格子
  ↓
LineFill.collect()                   → 补全路径上所有格子
  ↓
PaintExecutor.paintCells(cells)      → 写像素 + 判断匹配 + 记录
  ↓
[不触发渲染, 由外部统一 flush]
```

## 模块依赖

```
CellConverter ← 无依赖
CellHitTest ← 依赖 CellConverter, BoardData, BrushState, PixelBuffer
PaintExecutor ← 依赖 PixelBuffer×3, BoardData, BrushState
LineFill ← 依赖 BoardData, PixelBuffer
```
