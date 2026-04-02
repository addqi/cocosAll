# 06 — 调色板 UI（ui/palette）

## 概述

调色板面板位于屏幕底部，显示当前关卡的所有可用颜色。用户点击色块切换当前画笔颜色。面板支持分页滑动（颜色多时分多页）、进度条显示、选中动效。

## 需要创建的文件

```
src/ui/palette/
└── PalettePanel.ts     # 调色板面板组件
```

---

## 原项目参考

```
原项目: features/G15/G15_FBase/src/ui/palette/
├── config/
│   ├── G15_FBase_PaletteConfig.ts       ← 布局配置
│   └── G15_FBase_PaletteAnimConfig.ts   ← 动画配置
├── logic/
│   ├── G15_FBase_PaletteClickLogic.ts   ← 点击切换画笔
│   └── G15_FBase_PaletteSwipeLogic.ts   ← 滑动翻页
├── function/
│   ├── G15_FBase_UpdateProgressFunction.ts   ← 更新填色进度
│   ├── G15_FBase_PaletteCreateFunction.ts    ← 创建色块实体
│   └── G15_FBase_FindNextUnfinishedBrushFunction.ts ← 查找下一个未完成颜色
├── render/
│   ├── G15_FBase_PaletteItemRender.ts   ← 色块渲染
│   └── G15_FBase_PaletteContentRender.ts ← 面板容器
└── component/
    └── ...
```

---

## 1. 布局配置

**原项目参考**: `G15_FBase_PaletteConfig.ts`

```typescript
// 原项目: G15_FBase_PaletteConfig.ts 第8-56行
const PaletteLayout = {
    designWidth: 960,        // UI 设计基准宽度
    columnCount: 5,          // 每页横向格子数
    rowCount: 2,             // 每页纵向格子数
    spacing: 40,             // 格子间距
    edgeMarginLeft: 24,      // 左右边缘留白
    spacingTopBottom: 13,    // 上下间距
    marginBottom: 22,        // 容器下边距
    marginTop: 22,           // 容器上边距
    paletteMarginBottom: 201,// 面板离屏幕底部距离

    // 文字
    textSizeNormal: 60,      // 数字默认大小
    textSizeAfterClick: 72,  // 点击后放大大小
    textFont: 'SPARTAN-BOLD',

    // 分页
    defaultPageIndex: 1,     // 默认显示页
    swipeThreshold: 50,      // 翻页滑动阈值
    snapSpeed: 3000,         // 吸附动画速度
};
```

### 色块尺寸计算

```typescript
// 每页显示 columnCount × rowCount 个色块
// 每页 = 10 个色块 (5×2)
// 色块宽度 = (设计宽度 - 边距*2 - 间距*(列数-1)) / 列数
const itemWidth = (designWidth - edgeMarginLeft * 2 - spacing * (columnCount - 1)) / columnCount;
```

---

## 2. 点击切换画笔

**原项目参考**: `G15_FBase_PaletteClickLogic.ts`

```typescript
// 原项目: G15_FBase_PaletteClickLogic.ts 第52-82行
onClickPaletteItem(paletteIndex: number) {
    // 1. 更新选中状态
    prevSelectedIndex = selectedIndex;
    selectedIndex = paletteIndex;

    // 2. 设置画笔颜色
    brushState.currentIndex = paletteIndex;

    // 3. 播放选中动效（缩放 + 数字弹跳）
    // tween: scale 1 → selectScaleUp, label scale 1 → labelScalePeak
}
```

### 与核心的交互

调色板 → 核心的**唯一交互点**是设置 `BrushState.currentIndex`。调色板不直接操作像素或纹理。

---

## 3. 填色进度

**原项目参考**: `G15_FBase_UpdateProgressFunction.ts`

每个色块下方显示填色进度条。

```typescript
// 原项目: G15_FBase_UpdateProgressFunction.ts 第18-46行
function updateProgress(paletteIndex: number) {
    const total = brushTotalCount(paletteIndex);   // 该颜色总格子数
    const filled = brushFilledCount(paletteIndex); // 已正确填充格子数
    const progress = total === 0 ? 0 : filled / total;
    // 更新进度条 UI
}
```

### 计数方法

- **总数**: 遍历 BoardData，统计 `getBrushIndex(r,c) === paletteIndex` 的格子数
- **已填充**: 遍历 Brush 层像素，统计对应格子 `alpha === 255` 的数量

---

## 4. 分页滑动

**原项目参考**: `G15_FBase_PaletteSwipeLogic.ts`

当调色板颜色数量超过每页容量（10 个）时，支持左右滑动翻页。

### 页数计算

```typescript
// 总页数 = 工具页(1) + 颜色页数
// 颜色页数 = ceil(palette.length / (columnCount * rowCount))
const colorPageCount = Math.ceil(palette.length / (columnCount * rowCount));
const totalPages = 1 + colorPageCount; // 第0页=工具, 第1页起=颜色
```

### 滑动吸附

```typescript
// 原项目: G15_FBase_PaletteSwipeLogic.ts
// 手指滑动 > swipeThreshold → 强制翻页
// 松手后 → 按 snapSpeed 吸附到最近整页
```

---

## 5. 色块渲染结构

每个色块包含：

```
色块节点 (Button)
├── 背景 (Sprite, 圆角矩形)
├── 颜色填充 (Sprite, 调色板颜色)
├── 数字 (Label, 显示编号 1-99)
├── 进度条背景 (Sprite)
├── 进度条填充 (Sprite, 宽度按进度裁剪)
└── 完成勾 (Sprite, progress===1 时显示)
```

---

## 接口设计

```typescript
import { Component, Node } from 'cc';

@ccclass('PalettePanel')
export class PalettePanel extends Component {
    /** 初始化调色板 */
    init(palette: string[], onSelect: (index: number) => void): void;

    /** 更新指定颜色的进度 */
    updateProgress(index: number, filled: number, total: number): void;

    /** 批量更新所有颜色的进度 */
    updateAllProgress(filledCounts: number[], totalCounts: number[]): void;

    /** 高亮选中色块 */
    setSelected(index: number): void;

    /** 跳转到指定颜色所在的页 */
    scrollToIndex(index: number): void;
}
```

---

## 依赖关系

```
PalettePanel
  ├── 读取 BrushState.currentIndex（显示当前选中）
  ├── 写入 BrushState.currentIndex（用户点击时）
  ├── 读取 BoardData（计算每色总数/已填充数）
  └── 读取 BrushLayer.pixels（判断格子是否已填充）

PalettePanel 不直接操作纹理或触发涂色。
```
