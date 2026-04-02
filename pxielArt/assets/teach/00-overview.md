# 00 — 项目全景：像素涂色游戏（Pixel Art Coloring）

## 目标

在 Cocos Creator 3.8 中复刻一个像素涂色游戏。用户在网格上按编号选择颜色，点击或拖动格子涂色，最终完成一幅像素画。

## 原项目参考路径

```
原项目源码：features/G15/G15_FBase/src/
├── core/       ← 核心玩法（触摸、涂色、缩放、盘面）
├── ui/         ← UI层（调色板、工具栏、结算、教程）
├── storage/    ← 存档
├── ad/         ← 广告
└── world/      ← 场景管理
```

## 核心架构思想

### 1. 一像素一格子

整个涂色盘面由**三张动态纹理**叠加而成，每张纹理的分辨率 = 网格尺寸（如 100×100），Nearest 滤波放大显示：

| 层（从底到顶） | 作用 | 数据 |
|---|---|---|
| **Board 层** | 灰度底图，显示原始图案轮廓 | `Uint8Array`，每格灰度值 0-254，255=空 |
| **Digit 层** | 数字+网格线（GPU shader 绘制） | `Uint8Array`，R=数字编码(1-99)，A=可见性 |
| **Brush 层** | 涂色结果层，初始全透明 | `Uint8Array`，点击后写入 RGBA 颜色 |

涂色操作 = 在 Brush 层的 Uint8Array 里写 4 个字节，然后 uploadData 到 GPU。

### 2. 数据驱动，分层解耦

```
数据层（纯 TS 类）  →  逻辑层（处理输入/判断/状态变更）  →  渲染层（管理纹理/Sprite/上传 GPU）
```

- **数据变化**和**渲染刷新**分开：先批量写像素，最后统一 upload 一次
- **输入处理**和**涂色逻辑**分开：手势识别结果通过回调/事件驱动涂色
- **核心玩法**和**UI**分开：core 不知道 palette 的存在

### 3. 关键数据结构

```typescript
/** 格子位置 */
interface CellPosition { row: number; col: number; }

/** 格子+画笔条目（用于涂色操作） */
interface CellBrushEntry { row: number; col: number; brushIndex: number; }

/** 涂色记录（含匹配结果） */
interface PaintEntry { row: number; col: number; brushIndex: number; matched: boolean; }

/** 谜题数据 */
interface PuzzleData {
    gridSize: number;        // 网格尺寸（正方形边长）
    palette: string[];       // 调色板 hex 颜色数组, 如 ['#ff0000', '#00ff00']
    pixels: string;          // RLE 编码的像素数据
}
```

### 4. 像素索引公式

所有层共用同一套索引：

```
pixelIndex = (row * gridCols + col) * 4
buf[pixelIndex + 0] = R
buf[pixelIndex + 1] = G
buf[pixelIndex + 2] = B
buf[pixelIndex + 3] = A
```

## 复刻项目目录结构

```
src/
├── types.ts                    # 共享类型定义（CellPosition, PaintEntry 等）
├── config/
│   └── GameConfig.ts           # 全局配置常量
├── core/
│   ├── data/
│   │   ├── PixelBuffer.ts      # 像素缓冲区封装（setPixel/getAlpha/fill）
│   │   ├── BoardData.ts        # 盘面数据（每格应该是什么颜色）
│   │   └── BrushState.ts       # 画笔状态（当前选中颜色索引）
│   ├── paint/
│   │   ├── CellConverter.ts    # 屏幕坐标 → 格子行列
│   │   ├── CellHitTest.ts      # 命中检测 + 吸附算法
│   │   ├── PaintExecutor.ts    # 涂色执行（写像素+判断匹配+记录）
│   │   └── LineFill.ts         # Bresenham 拖动补线
│   ├── input/
│   │   ├── TouchHandler.ts     # 触摸事件标准化
│   │   └── GestureDetector.ts  # 手势识别（单指/双指/拖动）
│   └── viewport/
│       └── ViewportController.ts # 缩放/平移/边界钳制
├── render/
│   ├── BoardLayer.ts           # Board 层渲染（灰度底图）
│   ├── BrushLayer.ts           # Brush 层渲染（涂色结果）
│   └── DigitLayer.ts           # Digit 层渲染（数字+网格线）
├── ui/
│   └── palette/
│       └── PalettePanel.ts     # 调色板面板
└── GameManager.ts              # 主控组装
```

## 实现顺序

按以下顺序逐步构建，每一步都可独立运行验证：

1. **Phase 1: core/data** — 数据基础（types + PixelBuffer + BoardData + BrushState）
2. **Phase 2: core/paint** — 涂色逻辑（坐标转换 + 命中检测 + 涂色执行 + 补线）
3. **Phase 3: core/input** — 输入系统（触摸标准化 + 手势识别）
4. **Phase 4: core/viewport** — 视口控制（缩放 + 平移 + 边界钳制）
5. **Phase 5: render** — 渲染层（三层纹理管理）
6. **Phase 6: ui/palette** — 调色板 UI
7. **Phase 7: GameManager** — 主控组装，串联所有模块

每个 Phase 对应一份 teach 文档（01 到 07）。
