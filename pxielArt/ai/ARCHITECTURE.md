# 架构整理：对照 G15_FBase `core`，拆分 GameManager

参考路径：`/Users/admin/cocos/work/g15/core/features/G15/G15_FBase/src/core`  
目标项目：`pxielArt/assets/src`

## 1. 原则

- **不照搬 ae 原子框架**：G15 的 `LogicAtom` / `RenderAtom` / `Domain` / `Router` 用 **普通 TS 类 + Cocos `Component`** 等价实现。
- **GameManager 只做装配**：检查器引用、找 Canvas、调用一次「开局构建」；不写纹理细节、不写调色板 UI 树。
- **数据与渲染分离**：与 teach 一致——`PixelBuffer` 写数据，`render/*` 或专用类负责 `Texture2D.uploadData`。

## 2. G15 目录 → pxielArt 映射

| G15 文件夹 | 作用 | pxielArt 落点 |
|------------|------|----------------|
| `config/` | 常量、资源 URL、数值策划 | `assets/src/config/GameConfig.ts`（及可选 `PuzzleAssetRefs` 仅类型） |
| `function/` | 无状态小函数（指针→格、RLE、写格等） | 保留在 `core/paint/`、`core/data/`；若膨胀可增 `core/function/` |
| `logic/` | 流程编排（初始化、缩放淡出、涂色链） | `assets/src/game/` 下 `*Bootstrap`、`*Controller`、`*Coordinator` |
| `render/` | 纹理定义与 GPU 侧契约 | `assets/src/render/` 每层一个「控制器/组件」 |
| `domain/` | 实体状态、组件数据 | 合并为 **`BoardRuntimeContext`**（单例式上下文，非 ECS） |
| `component/` | 引擎组件绑定 | Cocos 的 `Node` + `Sprite` + 薄 `Component`；或收编进 `render/*` |
| `signal/` + `*Router` | 事件分发 | `core/input/` 里键盘/触摸入口 + 对 `ViewportController` / `PaintExecutor` 的调用；必要时 `EventTarget` |

## 3. 当前 GameManager 职责与归属

| 现状（GameManager 内） | 建议归属 |
|----------------------|----------|
| 读 `puzzleJson`、建 `BoardData` / `BrushState` | `BoardBootstrap` 或 `PuzzleLoader` |
| 创建 Brush `PixelBuffer` + `Texture2D` + 根节点 `Sprite` | `BrushLayerView` / `render/BrushLayer.ts` |
| 创建 Digit 节点、材质 `gridSize`、填 `_digitPixels` | `DigitLayerView` / `render/DigitLayer.ts` |
| `CellConverter` + `PaintExecutor` + `TOUCH_END` | `BoardPaintInput`（挂棋盘节点）或 `game/BoardInteraction.ts` |
| `uploadData`、dirty 重置 | `LayerFlushCoordinator` 或各 Layer 的 `flush()` |
| `_setupPalette`、Widget、`PalettePanel.setup` | `PaletteInstaller` |
| 检查器：`digitMaterial`、`palette*`、`cellDisplaySize` | 保留在 **薄** `GameManager`，或抽到 `GameSceneConfig` 组件只存引用 |

## 4. 目标目录树（新增与调整）

```
assets/src/
├── config/
│   └── GameConfig.ts                 # 视口、网格、吸附、缩放步进、灰度/显隐阈值等（对齐 teach + 后续键盘缩放）
├── types/
│   └── types.ts
├── core/
│   ├── PixelBuffer.ts
│   ├── data/
│   │   ├── BoardData.ts
│   │   └── BrushState.ts
│   ├── paint/
│   │   ├── CellConverter.ts
│   │   ├── PaintExecutor.ts
│   │   └── …（后续 LineFill、CellHitTest）
│   ├── viewport/
│   │   └── ViewportController.ts     # 新增：缩放/平移/钳制
│   └── input/
│       ├── BoardTouchInput.ts        # 新增：触摸 → 格 → 涂色（从 GM 拆出）
│       └── BoardKeyboardZoom.ts      # 新增：W/S、上下键 → 改 scale（可选挂同节点或 Viewport）
├── game/
│   ├── BoardRuntimeContext.ts        # 新增：聚合 boardData、brushState、各 PixelBuffer、Texture 引用
│   ├── BoardBootstrap.ts             # 新增：createLayers、bind puzzle、调各 Layer 初始化
│   └── PaletteInstaller.ts           # 新增：Canvas 下 PaletteBar + PalettePanel.setup
├── render/
│   ├── BrushLayer.ts                 # 新增：Brush 纹理 + Sprite + flush
│   ├── DigitLayer.ts                 # 新增：Digit 纹理 + shader 材质 + 填数 + flush
│   └── BoardLayer.ts                 # 新增：灰度底图（与 teach 一致后再接）
├── ui/
│   └── palette/
│       └── PalettePanel.ts
└── GameManager.ts                    # 瘦身：start → new BoardBootstrap(...).run(this)
```

说明：

- **`game/`**：对标 G15 `BoardInitLogic` + 部分 UI 安装，**无**第三方 DI，构造函数注入 `Node` / 资源引用即可。
- **`render/`**：对标 G15 `*Render`，但以 **Cocos 组件或纯类 + Node** 实现，便于编辑器挂材质。
- **`core/input/`**：对标 `KeyboardRouter`、`ViewportTouchRouter` 的**简化合并**。

## 5. 新增文件清单（按实现顺序）

| 顺序 | 文件 | 职责 |
|------|------|------|
| 1 | `config/GameConfig.ts` | 从 GM 魔法数迁出；预留 `zoomStep`、`minScale`、`detailZoomThreshold` 等 |
| 2 | `game/BoardRuntimeContext.ts` | 只读/可写引用聚合，避免各层互相 new 时传 8 个参数 |
| 3 | `render/BrushLayer.ts` | `PixelBuffer` + `Texture2D` + `Sprite` + `flush()` |
| 4 | `render/DigitLayer.ts` | Digit 缓冲、材质 `gridSize`、初始化循环、`flush()` |
| 5 | `game/BoardBootstrap.ts` | 接收 `JsonAsset` puzzle、`Material`、`cellDisplaySize`、父节点；创建子节点顺序 Board→Digit→Brush（与 teach 一致时再补 Board） |
| 6 | `game/PaletteInstaller.ts` | 从 GM 剪切 `_setupPalette` |
| 7 | `core/input/BoardTouchInput.ts` | `TOUCH_END` / 后续 move；依赖 `CellConverter`、`PaintExecutor`、flush |
| 8 | `core/viewport/ViewportController.ts` | 缩放与 Content `setScale`/`setPosition`（与 teach 对齐） |
| 9 | `core/input/BoardKeyboardZoom.ts` | 键盘改 `ViewportController`（可与 8 同时） |
| 10 | `render/BoardLayer.ts` | 灰度底图（当前可 stub 或延后） |

**可选**（`core` 再细分时）：

- `core/function/RleDecode.ts` — 若 `BoardData` 仅调用静态方法，可保持不动。

## 6. GameManager 瘦身后的形态（目标）

```text
@property puzzleJson, digitMaterial, cellDisplaySize, paletteItemSprite, palette* …

start() {
  const bootstrap = new BoardBootstrap({ node: this.node, puzzleJson, … });
  const ctx = bootstrap.run();
  new PaletteInstaller(canvas).install(ctx, this.paletteItemSprite, paletteOptions);
  this.node.addComponent(BoardTouchInput).bind(ctx);
  // 视口节点就绪后：KeyboardZoom.bind(viewportNode, ctx.viewport);
}
```

具体 API 在落地 `BoardBootstrap.run()` 时再定；关键是 **GM 不出现 for 循环填 digit、不出现 new Texture2D**。

## 7. 与 teach / `assets/teach` 的关系

- teach 中的 Phase 5–7 与 G15 `render/*` + `BoardInitLogic` **一一对应**；本文件是 **工程目录级**落实方案。
- 接线 **Digit → PaintExecutor**（涂对清数字）应在 `PaintExecutor` 持有 digit buffer 后，由 `BoardBootstrap` 注入，仍不回到胖 GM。

## 8. 不建议做的事

- 为对齐 G15 引入完整 **signal 总线**（除非后续多玩法强需求）。
- 把 `PalettePanel` 拖进 `render/`（它是 UI，留在 `ui/palette`）。

---

## 9. 已落地（代码）

- `config/GameConfig.ts`、`render/BrushLayer.ts`、`render/DigitLayer.ts`、`render/BoardLayer.ts`
- `game/BoardRuntimeContext.ts`、`BoardBootstrap.ts`、`PaletteInstaller.ts`
- `core/input/BoardTouchInput.ts`、`core/input/BoardViewportInput.ts`
- `core/viewport/ViewportController.ts`
- 节点层级：`BoardContent`（缩放）→ Board（灰底）→ Digit → Brush（初始全透明）；`PaintExecutor` 接 digit，涂对清数字；`flushPaintLayers` 上传 Brush + Digit。
- `digit.effect`：`detailParams.x` 控制网格/数字显隐；缩放 ≥ `viewportDetailShowScale` 后为 1。
- 键盘 **W/↑** 放大、**S/↓** 缩小；`GameManager` 检查器「视口」分组可调阈值与步长。

*后续：双指缩放、平移钳制、Board 层随缩放渐变等。*

---

*后续迭代：实现时按上表顺序提交 PR，每步保持可运行。*
