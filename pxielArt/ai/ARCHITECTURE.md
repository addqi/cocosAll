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
│   └── PaletteInstaller.ts           # HudLayer 下 PaletteBar + PalettePanel.setup
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

## 6. UI 层级设计

**4 层架构**，全部在 `GameManager.start()` 中代码创建（场景只有一个 `main` 节点）：

| 层 | 节点名 | 内容 | 触摸行为 |
|---|---|---|---|
| Game | `GameLayer` | 棋盘(BoardContent) + Viewport 缩放 | BoardTouchInput(Brush 上) + BoardRootPanInput(留白) |
| HUD | `HudLayer` | 调色板、进度条、撤销按钮 | 子元素自然拦截，空白穿透到 Game |
| Popup | `PopupLayer` | 暂停/完成/设置弹窗 | 打开时加全屏 BlockInput 阻断下层 |
| Top | `TopLayer` | Toast、新手引导 | 穿透，不阻断 |

**为什么 4 层不是 5 层**：涂色游戏没有平级功能页（背包/商店），砍掉 Normal 层。引导合入 Top（需遮罩时在 Top 内部加 GuideRoot 子节点）。

**GameManager 最终形态**（已落地）：

```text
start() {
  // 1. 创建 4 层
  const gameLayer  = this._createLayer('GameLayer');
  const hudLayer   = this._createLayer('HudLayer');
  this._createLayer('PopupLayer');
  this._createLayer('TopLayer');

  // 2. 棋盘 → GameLayer
  const ctx = BoardBootstrap.run({ boardRoot: gameLayer, ... });

  // 3. 调色板 → HudLayer
  PaletteInstaller.install(hudLayer, ...);

  // 4. 输入绑定
  ctx.brushLayer.node.addComponent(BoardTouchInput).init(ctx);
  gameLayer.addComponent(BoardViewportInput).init(ctx);
  gameLayer.addComponent(BoardRootPanInput).init(ctx);
}
```

## 7. 与 teach / `assets/teach` 的关系

- teach 中的 Phase 5–7 与 G15 `render/*` + `BoardInitLogic` **一一对应**；本文件是 **工程目录级**落实方案。
- 接线 **Digit → PaintExecutor**（涂对清数字）应在 `PaintExecutor` 持有 digit buffer 后，由 `BoardBootstrap` 注入，仍不回到胖 GM。

## 8. 不建议做的事

- 为对齐 G15 引入完整 **signal 总线**（除非后续多玩法强需求）。
- 把 `PalettePanel` 拖进 `render/`（它是 UI，留在 `ui/palette`）。

---

## 9. 已落地（代码）

- **UI 层级**：`GameManager._createLayer` 动态创建 `GameLayer` / `HudLayer` / `PopupLayer` / `TopLayer`
- **棋盘**：`BoardBootstrap` → `GameLayer` 下建 `BoardContent`（缩放根）→ Board → Digit → Brush
- **HUD**：`PaletteInstaller` → `HudLayer` 下建 `PaletteBar`（底部横向 ScrollView）
- **渲染**：`BoardLayer`（灰度+ZoomFade） + `DigitLayer`（digit.effect） + `BrushLayer`（全透明初始）
- **输入**：`BoardTouchInput`(Brush 节点) + `BoardRootPanInput`(GameLayer) + `BoardViewportInput`(GameLayer, 键盘)
- **视口**：`ViewportController` 缩放/平移/钳制 + `ZoomFadeMath` 细节渐显
- **配置**：`GameConfig.ts` 集中管理所有数值常量

*后续：双指缩放、PopupLayer/TopLayer 内容实装。*

---

*后续迭代：实现时按上表顺序提交 PR，每步保持可运行。*
