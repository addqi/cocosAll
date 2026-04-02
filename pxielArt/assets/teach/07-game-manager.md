# 07 — 主控组装（GameManager）

## 概述

GameManager 是唯一挂在场景根节点上的"组装者"。它不包含业务逻辑，只负责：创建各模块实例、注入依赖、连接事件。类似原项目中 `BoardInitLogic` + 信号路由系统的角色。

## 需要创建的文件

```
src/
├── config/
│   └── GameConfig.ts       # 全局配置
└── GameManager.ts          # 主控组装
```

---

## 1. GameConfig.ts — 全局配置

**原项目参考**: `features/G15/G15_FBase/src/core/config/G15_FBase_GameConfig.ts`

```typescript
export const GameConfig = {
    // ===== 视口 =====
    viewportWidth: 960,
    viewportHeight: 1320,

    // ===== 网格 =====
    gridCols: 120,          // 最大列数
    gridRows: 120,          // 最大行数
    cellWidth: 120,         // 格子宽度（像素）
    cellHeight: 120,        // 格子高度（像素）

    // ===== 缩放 =====
    maxScale: 1.0,
    viewportPadding: 200,   // 放大时的额外留白

    // ===== 输入 =====
    paintSnapRadiusPx: 40,  // 涂色吸附半径（屏幕像素）
    moveThreshold: 5,       // 移动阈值（像素）
    singleTouchDelay: 0.05, // 单指确认延迟（秒）

    // ===== 底图 =====
    boardGrayMinColor: 0x868686,  // 灰度映射下限
};
```

---

## 2. GameManager.ts — 主控组装

### 场景节点结构

```
Canvas
└── GameManager (挂 GameManager.ts)
    ├── Viewport (挂 UITransform, 960×1320)
    │   └── Content (动态创建, 缩放/偏移容器)
    │       ├── Board (动态创建, 灰度底图)
    │       ├── Digit (动态创建, 数字层)
    │       └── Brush (动态创建, 涂色层)
    └── PalettePanel (调色板 UI)
```

### 初始化流程

对应原项目 `G15_FBase_BoardInitLogic.onExecute`（第72-131行）：

```typescript
@ccclass('GameManager')
export class GameManager extends Component {
    // ===== 场景引用 =====
    @property(Node) viewport!: Node;         // 视口节点
    @property(PalettePanel) palette!: PalettePanel; // 调色板

    // ===== 核心模块（纯 TS 对象） =====
    private _boardData!: BoardData;
    private _brushState!: BrushState;
    private _cellConverter!: CellConverter;
    private _cellHitTest!: CellHitTest;
    private _paintExecutor!: PaintExecutor;
    private _lineFill!: LineFill;
    private _viewportCtrl!: ViewportController;
    private _gestureDetector!: GestureDetector;

    // ===== 渲染层（Component） =====
    private _contentNode!: Node;
    private _boardLayer!: BoardLayer;
    private _brushLayer!: BrushLayer;
    private _digitLayer!: DigitLayer;

    start() {
        // 1. 加载谜题数据
        const puzzleData = this.loadPuzzle();

        // 2. 初始化数据层
        this._boardData = new BoardData(puzzleData);
        this._brushState = new BrushState();
        this._brushState.palette = puzzleData.palette;

        // 3. 创建节点层级 + 渲染层
        this.createLayers(puzzleData.gridSize);

        // 4. 初始化视口
        this._viewportCtrl = new ViewportController(
            puzzleData.gridSize, puzzleData.gridSize,
            GameConfig.cellWidth, GameConfig.cellHeight,
            GameConfig.viewportWidth, GameConfig.viewportHeight,
            GameConfig.maxScale, GameConfig.viewportPadding,
        );

        // 5. 初始化涂色系统
        this._cellConverter = new CellConverter(
            puzzleData.gridSize, puzzleData.gridSize,
            GameConfig.cellWidth, GameConfig.cellHeight,
        );
        this._cellHitTest = new CellHitTest(
            this._cellConverter, this._boardData, this._brushState,
            this._brushLayer.pixelBuffer, GameConfig.paintSnapRadiusPx,
        );
        this._paintExecutor = new PaintExecutor(
            this._brushLayer.pixelBuffer,
            this._boardLayer.pixelBuffer,
            this._digitLayer.pixelBuffer,
            this._boardData, this._brushState,
        );
        this._lineFill = new LineFill(this._boardData, this._brushLayer.pixelBuffer);

        // 6. 初始化输入系统（连接手势→涂色/视口）
        this.setupInput();

        // 7. 初始化调色板
        this.palette.init(puzzleData.palette, (index) => {
            this._brushState.currentIndex = index;
        });
    }
}
```

### 事件连接（核心接线）

```typescript
private setupInput() {
    this._gestureDetector = new GestureDetector({
        // 点击涂色
        onTapPaint: (localX, localY) => {
            const { offsetX, offsetY, scale } = this._viewportCtrl;
            const pos = this._cellHitTest.snapPaintCell(localX, localY, offsetX, offsetY, scale);
            if (!pos) return;

            const cells = [{ row: pos.row, col: pos.col, brushIndex: this._brushState.currentIndex }];
            this._paintExecutor.paintCells(cells);
            this.flushDirtyLayers();
        },

        // 拖动涂色
        onDragPaint: (localX, localY) => {
            const { offsetX, offsetY, scale } = this._viewportCtrl;
            const pos = this._cellHitTest.snapPaintCell(localX, localY, offsetX, offsetY, scale);
            if (!pos) return;

            const cells = this._lineFill.collect(
                this._gestureState.hasLastPaintPos,
                this._gestureState.lastPaintRow,
                this._gestureState.lastPaintCol,
                pos.row, pos.col,
                this._brushState.currentIndex,
                this._gestureState.paintStarted,
            );
            if (cells.length > 0) {
                this._paintExecutor.paintCells(cells);
                this.flushDirtyLayers();
            }
            // 更新补线起点
            this._gestureState.lastPaintRow = pos.row;
            this._gestureState.lastPaintCol = pos.col;
            this._gestureState.hasLastPaintPos = true;
            this._gestureState.paintStarted = true;
        },

        // 拖动平移
        onDragPan: (dx, dy) => {
            this._viewportCtrl.applyDrag(dx, dy);
            this.applyContentTransform();
        },

        // 双指缩放
        onPinchZoom: (distSq, lastDistSq) => {
            this._viewportCtrl.applyPinchZoom(distSq, lastDistSq);
            this.applyContentTransform();
        },

        onTouchEnd: () => {
            // 更新调色板进度
        },
    }, (localX, localY) => {
        const { offsetX, offsetY, scale } = this._viewportCtrl;
        return this._cellHitTest.hitTest(localX, localY, offsetX, offsetY, scale);
    });

    // 接入 Cocos 触摸事件
    new TouchHandler(this.viewport, this._gestureDetector);
}
```

### 统一刷新

```typescript
private flushDirtyLayers() {
    if (this._paintExecutor.brushDirty) {
        this._brushLayer.flush();
    }
    if (this._paintExecutor.boardDirty) {
        this._boardLayer.flush();
    }
    if (this._paintExecutor.digitDirty) {
        this._digitLayer.flush();
    }
    this._paintExecutor.resetDirty();
}

private applyContentTransform() {
    this._contentNode.setPosition(this._viewportCtrl.offsetX, this._viewportCtrl.offsetY, 0);
    this._contentNode.setScale(this._viewportCtrl.scale, this._viewportCtrl.scale, 1);
}
```

---

## 完整依赖图

```
GameManager (组装者)
  ├── GameConfig (配置, 全局单例)
  ├── BoardData ← PuzzleData
  ├── BrushState
  ├── ViewportController
  ├── CellConverter
  ├── CellHitTest ← CellConverter + BoardData + BrushState
  ├── PaintExecutor ← PixelBuffer×3 + BoardData + BrushState
  ├── LineFill ← BoardData + PixelBuffer
  ├── GestureDetector ← hitTest callback
  ├── TouchHandler ← GestureDetector + Node
  ├── BoardLayer (Component)
  ├── BrushLayer (Component)
  ├── DigitLayer (Component)
  └── PalettePanel (Component) ← BrushState
```

---

## 增量开发计划

### Phase 1: 最简可运行版

只实现**白图点击变黑**:
- `PixelBuffer` + `BrushLayer`（单层）
- `CellConverter`（坐标转换）
- 直接在 GameManager 里写 touchEnd 处理
- 不需要 BoardData、Digit、ViewportController

### Phase 2: 加数据层

- 加 `BoardData` + `BrushState` + `types.ts`
- 加 RLE 解码, 从 JSON 加载谜题
- 加颜色选择（硬编码几个按钮）

### Phase 3: 加多层渲染

- 加 `BoardLayer` + `DigitLayer`
- 加 `PaintExecutor`（匹配判断 + 三层联动）

### Phase 4: 加手势

- 加 `GestureDetector` + `TouchHandler`
- 加拖动涂色 + `LineFill`
- 加 `CellHitTest` 吸附

### Phase 5: 加视口

- 加 `ViewportController`
- 加 Content 节点变换
- 加双指缩放 + 单指拖动

### Phase 6: 加 UI

- 加 `PalettePanel`
- 加进度条
- 加完成检测

每个 Phase 都能独立运行, 不依赖后续 Phase 的代码。
