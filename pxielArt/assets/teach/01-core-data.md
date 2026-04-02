# 01 — 核心数据层（core/data）

## 概述

数据层定义了游戏的所有状态，是纯 TypeScript 类（不继承 Component），不依赖任何 Cocos 引擎 API。逻辑层和渲染层都从这里读写数据。

## 需要创建的文件

```
src/
├── types.ts                 # 共享类型
└── core/
    └── data/
        ├── PixelBuffer.ts   # 像素缓冲区封装
        ├── BoardData.ts     # 盘面数据
        └── BrushState.ts    # 画笔状态
```

---

## 1. types.ts — 共享类型定义

**原项目参考**: `features/G15/G15_FBase/G15_FBase_Namespace.ts`（第 82-103 行）

```typescript
/** 格子位置（行列坐标） */
export interface CellPosition {
    row: number;
    col: number;
}

/** 格子画刷条目：标识某个格子及其对应的画笔索引 */
export interface CellBrushEntry {
    row: number;
    col: number;
    brushIndex: number;
}

/** 单次涂色记录（含匹配结果） */
export interface PaintEntry {
    row: number;
    col: number;
    brushIndex: number;
    /** 涂的颜色是否与正确答案匹配 */
    matched: boolean;
}

/** 谜题原始数据（从 JSON 加载） */
export interface PuzzleData {
    /** 网格边长（正方形） */
    gridSize: number;
    /** 调色板 hex 字符串数组，如 ['#ff0000', '#00ff00', ...] */
    palette: string[];
    /** RLE 编码的像素数据，格式: "3,5:2,7" → [3,5,5,7] */
    pixels: string;
}
```

---

## 2. PixelBuffer.ts — 像素缓冲区封装

**原项目参考**: `features/G15/G15_FBase/src/core/component/G15_FBase_BrushComp.ts` + `G15_FBase_CellBrushWriteFunction.ts`

Board/Brush/Digit 三层都使用 RGBA Uint8Array 作为像素数据。封装通用操作，避免裸数组操作散落在各处。

### 核心接口

```typescript
export class PixelBuffer {
    /** RGBA 像素数据，直接给 Texture2D.uploadData 使用 */
    readonly data: Uint8Array;
    readonly width: number;   // 列数
    readonly height: number;  // 行数

    constructor(width: number, height: number);

    /** 填充所有像素为指定颜色 */
    fill(r: number, g: number, b: number, a: number): void;

    /** 设置单个像素的 RGBA */
    setPixel(row: number, col: number, r: number, g: number, b: number, a: number): void;

    /** 获取单个像素的 alpha 值 */
    getAlpha(row: number, col: number): number;

    /** 获取单个像素的 R 值（Digit 层用 R 存数字编码） */
    getR(row: number, col: number): number;

    /** 计算像素索引（内部用） */
    private _index(row: number, col: number): number;
}
```

### 关键实现

像素索引公式（全项目统一）：
```typescript
// 原项目: G15_FBase_CellBrushWriteFunction.ts 第59行
const idx = (row * gridCols + col) * 4;
```

写入颜色（从调色板 hex 解析）：
```typescript
// 原项目: G15_FBase_CellBrushWriteFunction.ts 第50-53行
const hexStr = palette[cell.brushIndex] ?? '#000000';
const hex = parseInt(hexStr.slice(1), 16);
const r = (hex >> 16) & 0xff;
const g = (hex >> 8) & 0xff;
const b = hex & 0xff;
```

判断已填充（alpha === 255 表示正确涂色）：
```typescript
// 原项目: G15_FBase_CellFilledFunction.ts 第34-35行
const idx = (row * gridCols + col) * 4 + 3;
return brushPixels[idx] === 255;
```

---

## 3. BoardData.ts — 盘面数据

**原项目参考**: `features/G15/G15_FBase/src/core/component/G15_FBase_BoardComp.ts` + `G15_FBase_PuzzleDecodeFunction.ts` + `G15_FBase_RleDecodeFunction.ts`

存储"每个格子应该涂什么颜色"的答案数据。

### 核心接口

```typescript
export class BoardData {
    /** 网格列数 */
    readonly gridCols: number;
    /** 网格行数 */
    readonly gridRows: number;
    /** 调色板 hex 颜色数组 */
    readonly palette: string[];
    /**
     * 扁平盘面数据, cellData[row * gridCols + col] = paletteIndex
     * -1 表示空格（不需要涂色）
     */
    readonly cellData: Int8Array;

    constructor(puzzleData: PuzzleData);

    /** 获取指定格子的画笔索引（即正确答案），-1 = 空格 */
    getBrushIndex(row: number, col: number): number;

    /** 判断格子是否为空格（不需要涂色） */
    isEmpty(row: number, col: number): boolean;
}
```

### RLE 解码算法

原项目用 RLE 压缩存储像素数据，需要先解码：

```typescript
// 原项目: G15_FBase_RleDecodeFunction.ts 第11-28行
// 格式: 逗号分隔, 纯数字=单值, "值:次数"=重复
// 例: "3,5:2,7" → [3, 5, 5, 7]
function rleDecode(encoded: string): number[] {
    if (!encoded) return [];
    const result: number[] = [];
    const parts = encoded.split(',');
    for (const part of parts) {
        const colonIdx = part.indexOf(':');
        if (colonIdx === -1) {
            result.push(parseInt(part, 10));
        } else {
            const value = parseInt(part.slice(0, colonIdx), 10);
            const count = parseInt(part.slice(colonIdx + 1), 10);
            for (let i = 0; i < count; i++) {
                result.push(value);
            }
        }
    }
    return result;
}
```

### 灰度转换（Board 层初始化用）

原项目将调色板颜色转为灰度作为底图：

```typescript
// 原项目: G15_FBase_HexToGrayFunction.ts（ITU-R BT.709 加权）
function hexToGray(hex: string): number {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
}
```

Board 层初始化时，将调色板索引映射为灰度值：
```typescript
// 原项目: G15_FBase_TexInitFunction.ts 第38-53行
// baseGray(0x86=134) 到 254 之间映射，空格=255(不可见)
const rawGray = grayPalette[idx];
const mappedGray = baseGray + ((255 - baseGray) * rawGray) / 255;
// 限制最大 254，255 保留给空格
const gray = Math.min(254, Math.round(mappedGray));
```

---

## 4. BrushState.ts — 画笔状态

**原项目参考**: `features/G15/G15_FBase/src/core/component/G15_FBase_BrushComp.ts` + `core/domain/G15_FBase_BrushDomain.ts`

极简的状态容器，记录当前选中的画笔颜色。

```typescript
export class BrushState {
    /** 当前选中的画笔索引（对应 palette 数组下标） */
    currentIndex: number = 0;

    /** 调色板引用（由 GameManager 初始化时设置） */
    palette: string[] = [];

    /** 获取当前画笔颜色的 hex 字符串 */
    get currentColor(): string {
        return this.palette[this.currentIndex] ?? '#000000';
    }

    /** 获取当前画笔颜色的 RGB 分量 */
    get currentRGB(): [number, number, number] {
        const hex = parseInt(this.currentColor.slice(1), 16);
        return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
    }
}
```

---

## 模块依赖关系

```
types.ts ← 被所有模块引用
PixelBuffer.ts ← 被 render/ 和 core/paint/ 引用
BoardData.ts ← 依赖 types.ts
BrushState.ts ← 依赖 types.ts
```

数据层之间无循环依赖，全部是单向引用。
