# pxielArt — AI 快速上下文

面向新对话：先读本文档，详细设计见仓库内 `assets/teach/`（`00-overview.md` 起）。

## 项目是什么

- **引擎**：Cocos Creator **3.8.8**（`package.json` 的 `creator.version`）。
- **类型**：像素**按编号涂色**游戏（网格 + 调色板 + 谜题 JSON）。
- **目标**：在 teach 文档中规划的三层纹理架构（Board / Digit / Brush）下复刻玩法；当前已实现**完整涂色主路径 + 道具系统 + 存档 + 完成弹窗 + 作品画廊**。

## 谜题数据

- 示例：`assets/resources/puzzles/apple.json`。
- 结构：`PuzzleData`（`assets/src/types/types.ts`）— `gridSize`、`palette`（`#rrggbb`）、`pixels`（RLE 字符串）。
- `BoardData`（`assets/src/core/data/BoardData.ts`）负责 RLE 解码与 `getBrushIndex` / `isEmpty`。
- 关卡清单：`LevelManifest`（`assets/src/config/LevelManifest.ts`）— 硬编码 `LevelEntry[]`。

### Y 轴约定（重要）

**全链路统一：row 0 = 画面底部（Y-up）。**

| 环节 | 约定 |
|------|------|
| JSON `pixels` RLE | row 0 = 画面底部，逐行向上扫描 |
| `BoardData.cellData` | `cellData[0..cols-1]` = 最底行 |
| `PixelBuffer._data` | `_index(0, c)` = 最底行像素 |
| `CellConverter` | sprite 底部触摸 → row 0 |
| `getFlippedData()` | 行翻转供 Cocos uploadData（首行 = 纹理顶部） |
| `img2puzzle.py` | PIL 读取后自动翻转行序再 RLE 编码 |

## 架构：单场景多页面

场景唯一入口：`main` 节点挂 `AppRoot`，管理 3 个页面节点（show/hide 切换，不用 loadScene）。

```
Canvas
└── main (AppRoot)
    ├── HomePage          选关页面（首屏）
    │   ├── TopBar        标题 + "我的作品"按钮
    │   └── LevelScroll   纵向 ScrollView + Grid Layout
    │       └── LevelCard_N  (动态创建，预览缩略图 + 关卡名)
    │
    ├── GamePage          游戏页面
    │   ├── GameLayer     BoardContent(棋盘渲染)
    │   ├── HudLayer      ProgressBar(顶部进度条) + PaletteBar(调色板页+道具页) + BackBtn
    │   ├── PopupLayer    完成弹窗
    │   └── TopLayer      Toast 飘字提示
    │
    └── MyWorksPage       已完成作品画廊
        ├── TopBar        标题 + 返回按钮
        ├── WorksScroll   纵向 ScrollView + Grid Layout
        │   └── WorkCard_N  (动态创建，彩色完成预览 + 关卡名 + 点击查看大图)
        ├── EmptyHint     无作品时的空状态提示
        └── PopupLayer    全屏预览弹窗
```

### 页面切换流程

```
启动 → AppRoot.showHome()
  点击关卡 → AppRoot.showGame(entry)
    → GamePage.startLevel(entry)  [resources.load JSON → BoardBootstrap]
  点击返回 → AppRoot.showHome()
    → GamePage.cleanup()  [销毁所有游戏子节点]
  点击"我的作品" → AppRoot.showMyWorks()
    → MyWorksPage.refreshList()
```

**触摸穿透规则**：层节点本身只有 `UITransform`（不监听触摸），空白区域自然穿透到下层。只有 UI 子元素（Button / ScrollView）才拦截触摸。PopupLayer 弹窗打开时应在最底部加全屏 BlockInput 节点。

## 道具系统

三种道具，由 `ToolConfig.ts` 定义，`ToolState` 全局持久化次数：

| 道具 | 触发方式 | 效果 |
|------|----------|------|
| 魔术棒 | 点道具 → 点格子 | FloodFill 同色连通区一键涂完 |
| 炸弹 | 点道具 → 点格子 | 以点击点为圆心直径 11 格范围全部涂色 |
| 放大镜 | 点道具即生效 | 自动定位当前笔色第一块未涂区域 → 缩放聚焦 + 闪烁预览 |

数据流：`ToolPanel`(UI) → `GamePage._handleToolClick` → `ToolExecutor`(算法) / `MagnifierEffect`(动画) → `PaintExecutor`(涂色) → `PaintSaveManager`(存档)。

底部 HudLayer 的 `PaletteBar` 内含两页（调色板页 / 道具页），通过圆点 Tab 指示器切换，左右滑动动画过渡。

## 当前做到哪了

| 区域 | 状态 | 说明 |
|------|------|------|
| types + PixelBuffer + BoardData + BrushState | ✅ | 已落地 |
| CellConverter | ✅ | 支持 offset/scale 参数 |
| PaintExecutor | ✅ | 接 Brush + Digit buffer，涂对清数字 |
| PaintSnapRules | ✅ | 吸附涂色 + DDA 路径收集 + 路径过滤 |
| 渲染三层 | ✅ | BoardLayer + DigitLayer + BrushLayer 独立类 |
| 输入 | ✅ | BoardTouchInput(涂色+拖动DDA+双指捏合+道具点击) + BoardRootPanInput(留白平移) + BoardViewportInput(键盘缩放/HJKL平移+放大镜tick) |
| Viewport | ✅ | ViewportController 缩放/平移/钳制/双指捏合 + ZoomFade |
| UI 调色板 | ✅ | PalettePanel 动态创建，挂 HudLayer |
| 道具面板 | ✅ | ToolPanel + Tab 切换动画（PaletteInstaller） |
| 道具逻辑 | ✅ | ToolConfig + ToolState(持久化) + ToolExecutor(魔术棒/炸弹/放大镜) + MagnifierEffect(聚焦闪烁) |
| FloodFill 算法 | ✅ | BFS 四连通，供魔术棒 / 放大镜使用 |
| GameConfig | ✅ | 独立配置文件 |
| AppRoot 总管理器 | ✅ | 单场景入口，管理页面切换，创建 ToolState |
| HomePage 选关 | ✅ | ScrollView + Grid + LevelCard + PuzzlePreview 缩略图 |
| GamePage 游戏 | ✅ | resources.load 加载关卡，道具集成 |
| LevelManifest | ✅ | 关卡清单硬编码（3 关） |
| PuzzlePreview | ✅ | PuzzleData → 缩略图 SpriteFrame（RLE 解码 + 行翻转） |
| 存档/恢复 | ✅ | PaintSaveManager + PaintRestore + StorageService + PaintRecordCodec |
| PopupLayer 完成弹窗 | ✅ | 遮罩 + 涂色回放动画(ReplayAnimator) + 再看一次 + 返回首页 |
| 总背景 | ✅ | AppRoot 创建全屏白色 Sprite（Widget 自适应） |
| MyWorksPage | ✅ | 已完成作品画廊：彩色预览 + 全屏查看弹窗 + 空状态 |
| TopLayer Toast | ✅ | 飘字提示：道具不足 / 区域已涂完 / 当前颜色已涂完 |
| 关卡进度条 | ✅ | HudLayer 顶部图形进度条 + 百分比文字 |
| 调色板单色完成 | ✅ | 颜色涂完 → 数字变 ✓ + 禁止点击 + 自动切下一色 |

## 关键源码路径（优先看这些）

```
ai/
├── PROJECT_CONTEXT.md          # 本文件：AI 快速上下文
├── ARCHITECTURE.md             # 架构设计：目录映射、UI 层级
└── img2puzzle.py               # 工具：PNG → PuzzleData JSON（量化+RLE）

assets/src/
├── AppRoot.ts                  # 场景唯一入口：总管理器，页面切换，创建 ToolState
├── config/
│   ├── GameConfig.ts           # 视口/网格/吸附/缩放等全局常量
│   ├── LevelManifest.ts        # 关卡清单（LevelEntry[]）
│   └── ToolConfig.ts           # 道具定义：ToolType / ToolDef / ToolParams
├── types/types.ts
├── core/
│   ├── PixelBuffer.ts
│   ├── algorithm/
│   │   └── FloodFill.ts        # BFS 四连通同色填充
│   ├── data/BoardData.ts, BrushState.ts
│   ├── paint/CellConverter.ts, PaintExecutor.ts, PaintSnapRules.ts
│   ├── tool/
│   │   ├── ToolState.ts        # 道具次数持久化 + 激活态（跨关卡复用）
│   │   ├── ToolExecutor.ts     # 魔术棒 FloodFill / 炸弹圆形 / 放大镜定位
│   │   └── MagnifierEffect.ts  # 放大镜缩放聚焦 + 闪烁动画
│   ├── viewport/ViewportController.ts, ZoomFadeMath.ts
│   └── input/BoardTouchInput.ts(涂色+拖动DDA+双指捏合+道具点击), BoardViewportInput.ts, BoardRootPanInput.ts
├── game/
│   ├── BoardBootstrap.ts       # 组装棋盘：三层渲染 + 视口 + 存档恢复
│   ├── BoardRuntimeContext.ts  # 运行时聚合引用 + ZoomFade + MagnifierEffect
│   └── PaletteInstaller.ts     # 底部栏：调色板页 + 道具页 Tab 切换
├── render/
│   ├── BoardLayer.ts, DigitLayer.ts, BrushLayer.ts
├── ui/
│   ├── palette/
│   │   ├── PalettePanel.ts     # 横向滚动调色板
│   │   └── ToolPanel.ts        # 道具格子 + 次数角标 + 激活高亮
│   ├── home/
│   │   ├── HomePage.ts         # 选关页面：TopBar + ScrollView + LevelCard
│   │   └── LevelCard.ts        # 单张关卡卡片（预览图 + 名称 + 点击）
│   ├── game/
│   │   ├── GamePage.ts         # 游戏页面：加载关卡 + 道具集成 + 完成弹窗
│   │   └── ProgressBar.ts      # 顶部进度条（填充矩形 + 百分比文字）
│   ├── popup/
│   │   ├── CompletionPopup.ts  # 完成弹窗（回放画布 + 按钮）
│   │   └── ReplayAnimator.ts   # 涂色回放动画 Component（按玩家顺序逐帧重现）
│   └── myworks/
│       └── MyWorksPage.ts      # 我的作品画廊（彩色预览 + 全屏查看）
├── storage/
│   ├── PaintRecord.ts          # 操作记录数据结构
│   ├── PaintRecordCodec.ts     # 记录编解码（21-bit 打包）
│   ├── PaintSaveManager.ts     # 涂色存档管理器（防抖落盘+每色计数+完成检测）
│   ├── PaintRestore.ts         # 冷启动恢复
│   └── StorageService.ts       # localStorage：涂色记录 + 关卡完成 + 道具次数
└── util/
    ├── PuzzlePreview.ts        # PuzzleData → 缩略图 SpriteFrame
    └── Toast.ts                # showToast 飘字提示（TopLayer 上 Label + tween 淡出）

assets/resources/puzzles/
├── test_simple.json            # 谜题：测试简单图 (小尺寸)
├── apple.json                  # 谜题：苹果 30×30 6色
└── mountain.json               # 谜题：山水 100×100 50色

assets/prefab/
└── shadow.prefab               # 阴影预制体（代码中未引用，待确认用途）

assets/res/effect/
├── digit.effect                # 数字层 shader
└── digit.mtl                   # 数字层材质（编辑器绑定给 DigitLayer）
```

## 设计文档（必读索引）

路径：`assets/teach/`

- `00-overview.md` — 三层纹理、数据流、目录规划、Phase 顺序
- `01-core-data.md` … `07-game-manager.md` — 各阶段职责与伪代码

新功能开发应对照 teach，避免与既定数据结构（`CellBrushEntry`、`PaintEntry` 等）冲突。

## AI 工具链

### `ai/img2puzzle.py` — 图片 → PuzzleData JSON 转换器

将任意像素画 PNG 转换为项目的 `PuzzleData` JSON 格式（与 `assets/resources/puzzles/apple.json` 同结构）。

**依赖**：Pillow（已安装至 `.pylib/`）。

**用法**：
```bash
PYTHONPATH=.pylib python3 ai/img2puzzle.py <input.png> <output.json> [--size N] [--colors N] [--bg N]
```

| 参数 | 默认 | 说明 |
|------|------|------|
| `--size` | 100 | 输出网格边长（正方形） |
| `--colors` | 50 | 最大调色板颜色数（median-cut 量化） |
| `--bg` | 0 | 背景去除阈值：RGB 三通道均 ≥ 此值的像素标记为透明(-1)。0=关闭，240=去白底 |

**典型流程**：
1. AI 生图工具（豆包/Midjourney/SD）生成像素风格 PNG
2. 运行 `img2puzzle.py` 量化并导出 JSON 到 `assets/resources/puzzles/`
3. 在 `LevelManifest.ts` 中添加条目即可

**已生成关卡**：
| 文件 | 尺寸 | 颜色数 | 说明 |
|------|------|--------|------|
| `assets/resources/puzzles/test_simple.json` | 小尺寸 | 少量 | 测试用简单图 |
| `assets/resources/puzzles/apple.json` | 30×30 | 6 | 苹果（手工数据） |
| `assets/resources/puzzles/mountain.json` | 100×100 | 50 | 山水风景（AI 生图 + img2puzzle 转换） |

**注意**：
- AI 生成的"像素画"通常是 1024×1024 高分辨率，需要缩放+量化，不能直接用
- 无真实透明通道的图片必须用 `--bg 240` 去白底
- 缩放用最近邻插值（NEAREST），保持像素锐利边缘

## 已知缺口 / 需修复

1. **ReplayAnimator `_getBrushIdxFromRgba`**：始终返回 -1，`play()` 中 `_fillGrayBase(null)` 依赖该方法的分支逻辑不完整。仅在首次 `setup` 有 puzzle 参数时正常工作。
3. **BOARD_TOUCH_DEBUG = true**：`BoardTouchInput.ts` 调试开关未关，生产环境应设 false。
4. **BrushState.ts**：`getRGB` 方法上方有临时注释 `// BrushState.ts 加一个方法`，需清理。
5. **prefab/shadow.prefab**：存在但代码中未引用（CompletionPopup 的遮罩是代码创建 `new Node('Shadow')`），需确认是否冗余。
6. **道具补充弹窗未实现**：道具耗尽后应弹窗让用户获取（预留广告接口），目前无补充途径。

## 未实现功能（按优先级）

### P0 — 核心体验补全

| 功能 | 说明 |
|------|------|
| 道具补充弹窗 | 道具次数=0 时点击弹出弹窗，点按钮直接获取 N 个道具（N 在 `GameConfig` 可配）；按钮预留广告回调接口，当前直接发放 |

### P1 — 内容与体验增强

| 功能 | 说明 |
|------|------|
| 更多关卡 | 目前仅 3 关（test_simple / apple / mountain），需批量产出 |
| 关卡难度分级 | 按网格大小/颜色数分级展示 |
| 调色板 DrawCall 优化 | 虚拟列表 + Sprite/Label 分层 + 道具惰性激活（详见 `PALETTE_DRAWCALL_OPT.md`） |
| 懒加载优化 | 去 preloadDir、缩略图合集、虚拟滚动、关卡清单远程化（详见 `BUNDLE_SPLIT_PLAN.md` Phase 7） |

### P2 — polish

| 功能 | 说明 |
|------|------|
| 引导教程 | 新手首次进入时的操作引导 |

### 明确不做

| 功能 | 原因 |
|------|------|
| 暂停面板 | 本项目无需暂停 |
| 音效系统 | 无音效资源 |
| 涂色反馈动画 | 不做 |
| 多语言 | 不做 |

## 建议的下一步

1. **关掉调试日志**：`BoardTouchInput.ts` 的 `BOARD_TOUCH_DEBUG` 设 false。
2. **道具补充弹窗**：道具耗尽时弹窗获取，预留广告接口。
3. **批量关卡产出**：用 `img2puzzle.py` 配合 AI 生图批量生成 JSON。
4. **调色板 DrawCall 优化**：50 色关卡 DC 从 ~120 降至 ≤10。

---

*文档由维护者/AI 生成，用于会话接力；与 `assets/teach/` 不一致时以代码与 teach 为准并更新本文。*
