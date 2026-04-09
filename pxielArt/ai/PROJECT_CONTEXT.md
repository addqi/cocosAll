# pxielArt — AI 快速上下文

面向新对话：先读本文档，详细设计见仓库内 `assets/teach/`（`00-overview.md` 起）。

## 项目是什么

- **引擎**：Cocos Creator **3.8.8**（`package.json` 的 `creator.version`）。
- **类型**：像素**按编号涂色**游戏（网格 + 调色板 + 谜题 JSON）。
- **目标**：在 teach 文档中规划的三层纹理架构（Board / Digit / Brush）下复刻玩法；当前实现是**裁剪版**，已能跑通「选色 + 点击格子涂色 + 对错透明度」的主路径。

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
    │   ├── TopBar        标题 + "我的作品"按钮(预留)
    │   └── LevelScroll   纵向 ScrollView + Grid Layout
    │       └── LevelCard_N  (动态创建，预览缩略图 + 关卡名)
    │
    ├── GamePage          游戏页面
    │   ├── GameLayer     BoardContent(棋盘渲染)
    │   ├── HudLayer      PaletteBar + BackBtn
    │   ├── PopupLayer
    │   └── TopLayer
    │
    └── MyWorksPage       预留（空节点）
```

### 页面切换流程

```
启动 → AppRoot.showHome()
  点击关卡 → AppRoot.showGame(entry)
    → GamePage.startLevel(entry)  [resources.load JSON → BoardBootstrap]
  点击返回 → AppRoot.showHome()
    → GamePage.cleanup()  [销毁所有游戏子节点]
```

**触摸穿透规则**：层节点本身只有 `UITransform`（不监听触摸），空白区域自然穿透到下层。只有 UI 子元素（Button / ScrollView）才拦截触摸。PopupLayer 弹窗打开时应在最底部加全屏 BlockInput 节点。

## 当前做到哪了

| 区域 | 状态 | 说明 |
|------|------|------|
| types + PixelBuffer + BoardData + BrushState | ✅ | 已落地 |
| CellConverter | ✅ | 支持 offset/scale 参数 |
| PaintExecutor | ✅ | 接 Brush + Digit buffer，涂对清数字 |
| 渲染三层 | ✅ | BoardLayer + DigitLayer + BrushLayer 独立类 |
| 输入 | ✅ | BoardTouchInput(涂色+拖动DDA+双指捏合) + BoardRootPanInput(留白平移) + BoardViewportInput(键盘缩放/HJKL平移) |
| Viewport | ✅ | ViewportController 缩放/平移/钳制/双指捏合 + ZoomFade |
| UI 调色板 | ✅ | PalettePanel 动态创建，挂 HudLayer |
| GameConfig | ✅ | 独立配置文件 |
| AppRoot 总管理器 | ✅ | 单场景入口，管理页面切换 |
| HomePage 选关 | ✅ | ScrollView + Grid + LevelCard + PuzzlePreview 缩略图 |
| GamePage 游戏 | ✅ | 从 GameManager 改造，运行时 resources.load 加载关卡 |
| LevelManifest | ✅ | 关卡清单硬编码 |
| PuzzlePreview | ✅ | PuzzleData → 缩略图 SpriteFrame（RLE 解码 + 行翻转） |
| 存档/恢复 | ✅ | PaintSaveManager + PaintRestore + StorageService + PaintRecordCodec |
| PopupLayer 完成弹窗 | ✅ | BlockInput 遮罩 + 白色面板 + 返回首页按钮 |
| 总背景 | ✅ | AppRoot 创建全屏白色 Sprite（Widget 自适应） |
| MyWorksPage | ⏳ | 预留空节点 |

## 关键源码路径（优先看这些）

```
ai/
├── PROJECT_CONTEXT.md          # 本文件：AI 快速上下文
├── ARCHITECTURE.md             # 架构设计：目录映射、UI 层级
└── img2puzzle.py               # 工具：PNG → PuzzleData JSON（量化+RLE）

assets/src/
├── AppRoot.ts                  # 场景唯一入口：总管理器，页面切换（含全屏白色背景）
├── config/
│   ├── GameConfig.ts           # 视口/网格/吸附/缩放等全局常量
│   └── LevelManifest.ts        # 关卡清单（LevelEntry[]）
├── types/types.ts
├── core/
│   ├── PixelBuffer.ts
│   ├── data/BoardData.ts, BrushState.ts
│   ├── paint/CellConverter.ts, PaintExecutor.ts
│   ├── viewport/ViewportController.ts, ZoomFadeMath.ts
│   └── input/BoardTouchInput.ts(涂色+拖动DDA+双指捏合+平移), BoardViewportInput.ts, BoardRootPanInput.ts
├── game/
│   ├── BoardBootstrap.ts, BoardRuntimeContext.ts
│   └── PaletteInstaller.ts
├── render/
│   ├── BoardLayer.ts, DigitLayer.ts, BrushLayer.ts
├── ui/
│   ├── palette/PalettePanel.ts
│   ├── home/
│   │   ├── HomePage.ts         # 选关页面：TopBar + ScrollView + LevelCard
│   │   └── LevelCard.ts        # 单张关卡卡片（预览图 + 名称 + 点击）
│   └── game/
│       └── GamePage.ts         # 游戏页面（含完成弹窗 PopupLayer）
├── storage/
│   ├── PaintRecord.ts          # 操作记录数据结构
│   ├── PaintRecordCodec.ts     # 记录编解码
│   ├── PaintSaveManager.ts     # 涂色存档管理器（防抖落盘+完成检测）
│   ├── PaintRestore.ts         # 冷启动恢复
│   └── StorageService.ts       # localStorage 读写
└── util/
    └── PuzzlePreview.ts        # PuzzleData → 缩略图 SpriteFrame

assets/resources/puzzles/
├── apple.json                  # 谜题：苹果 30×30 6色
└── mountain.json               # 谜题：山水 100×100 50色
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
| `assets/resources/puzzles/apple.json` | 30×30 | 6 | 苹果（手工数据） |
| `assets/resources/puzzles/mountain.json` | 100×100 | 50 | 山水风景（AI 生图 + img2puzzle 转换） |

**注意**：
- AI 生成的"像素画"通常是 1024×1024 高分辨率，需要缩放+量化，不能直接用
- 无真实透明通道的图片必须用 `--bg 240` 去白底
- 缩放用最近邻插值（NEAREST），保持像素锐利边缘

## 已知缺口 / 易踩坑

1. ~~**PixelBoard.ts / touch.ts**~~：已删除。
2. **TopLayer**：容器已创建，Toast 飘字提示尚未实现。
3. **MyWorksPage**：预留空节点，尚未实现。

## 建议的下一步

1. TopLayer 实装：Toast 飘字提示。
2. MyWorksPage 实装。
3. 暂停面板（PopupLayer 第二个弹窗）。

---

*文档由维护者/AI 生成，用于会话接力；与 `assets/teach/` 不一致时以代码与 teach 为准并更新本文。*
