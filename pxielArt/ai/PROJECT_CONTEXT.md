# pxielArt — AI 快速上下文

面向新对话：先读本文档，详细设计见仓库内 `assets/teach/`（`00-overview.md` 起）。

## 项目是什么

- **引擎**：Cocos Creator **3.8.8**（`package.json` 的 `creator.version`）。
- **类型**：像素**按编号涂色**游戏（网格 + 调色板 + 谜题 JSON）。
- **目标**：在 teach 文档中规划的三层纹理架构（Board / Digit / Brush）下复刻玩法；当前实现是**裁剪版**，已能跑通「选色 + 点击格子涂色 + 对错透明度」的主路径。

## 谜题数据

- 示例：`assets/res/apple.json`。
- 结构：`PuzzleData`（`assets/src/types/types.ts`）— `gridSize`、`palette`（`#rrggbb`）、`pixels`（RLE 字符串）。
- `BoardData`（`assets/src/core/data/BoardData.ts`）负责 RLE 解码与 `getBrushIndex` / `isEmpty`。

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

## 当前做到哪了（相对 teach 的 Phase 1–7）

| 区域 | 状态 | 说明 |
|------|------|------|
| types + PixelBuffer + BoardData + BrushState | ✅ | 已落地 |
| CellConverter | ✅ | 支持 offset/scale 参数（当前 GameManager 传 0/1） |
| PaintExecutor | ⚠️ 部分 | 只传入 **Brush** 的 `PixelBuffer`；`boardPixels`、`digitPixels` 为 **null**，涂对时**不会**清 Board/Digit 纹理 |
| 渲染 | ⚠️ 部分 | GameManager 内联：底层 Sprite=涂色纹理；子节点 Digit=数字层 + **自定义 digitMaterial**；**无**独立 `BoardLayer` 灰度底图组件 |
| 输入 | ⚠️ 极简 | 仅 `TOUCH_END` 单点；**无** GestureDetector / TouchHandler / 拖动补线 / 双指缩放 |
| Viewport | ❌ | 无 `ViewportController`，无 Content 节点缩放平移 |
| UI 调色板 | ✅ | `PalettePanel` 动态创建底部横向 ScrollView，写入 `BrushState.currentIndex` |
| GameConfig | ❌ | 未抽独立配置文件（ teach 中的常量表未建） |
| GameManager 组装 | ⚠️ | 逻辑集中在 `GameManager.ts`，与 teach 07 的「纯组装 + 分层节点」仍有差距 |

## 关键源码路径（优先看这些）

```
ai/
├── PROJECT_CONTEXT.md      # 本文件：AI 快速上下文
├── ARCHITECTURE.md         # 架构设计：目录映射、GameManager 拆分
└── img2puzzle.py           # 工具：PNG → PuzzleData JSON（量化+RLE）

assets/src/
├── GameManager.ts          # 主流程：加载 JSON、纹理、Digit 子节点、调色板、触摸涂色
├── PixelBoard.ts           # 早期白底点变黑原型；可能与当前主流程重复/遗留
├── touch.ts                # 空壳组件，未使用
├── types/types.ts
├── core/
│   ├── PixelBuffer.ts
│   ├── data/BoardData.ts, BrushState.ts
│   └── paint/CellConverter.ts, PaintExecutor.ts
└── ui/palette/PalettePanel.ts

assets/res/
├── apple.json              # 谜题：苹果 30×30 6色
└── mountain.json           # 谜题：山水 100×100 50色
```

## 设计文档（必读索引）

路径：`assets/teach/`

- `00-overview.md` — 三层纹理、数据流、目录规划、Phase 顺序
- `01-core-data.md` … `07-game-manager.md` — 各阶段职责与伪代码

新功能开发应对照 teach，避免与既定数据结构（`CellBrushEntry`、`PaintEntry` 等）冲突。

## AI 工具链

### `ai/img2puzzle.py` — 图片 → PuzzleData JSON 转换器

将任意像素画 PNG 转换为项目的 `PuzzleData` JSON 格式（与 `assets/res/apple.json` 同结构）。

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
2. 运行 `img2puzzle.py` 量化并导出 JSON 到 `assets/res/`
3. Cocos 编辑器里 `GameManager.puzzleJson` 引用新 JSON 即可

**已生成关卡**：
| 文件 | 尺寸 | 颜色数 | 说明 |
|------|------|--------|------|
| `assets/res/apple.json` | 30×30 | 6 | 苹果（手工数据） |
| `assets/res/mountain.json` | 100×100 | 50 | 山水风景（AI 生图 + img2puzzle 转换） |

**注意**：
- AI 生成的"像素画"通常是 1024×1024 高分辨率，需要缩放+量化，不能直接用
- 无真实透明通道的图片必须用 `--bg 240` 去白底
- 缩放用最近邻插值（NEAREST），保持像素锐利边缘

## 已知缺口 / 易踩坑

1. **Digit 层与 PaintExecutor 未接线**：初始 Digit 从 `BoardData` 写入 `_digitPixels`，但 `PaintExecutor` 未持有该 buffer，涂对后数字不会从纹理上清除（需把 digit `PixelBuffer` 传入构造函数并在 `flush` 里 `uploadData`）。
2. **无灰度 Board 层**：teach 中的轮廓底图尚未实现。
3. **PixelBoard.ts**：若场景不再使用，后续可删除或标注废弃，避免双实现混淆。
4. **BrushState.getRGB**：实现有效，但类内缩进/格式略乱，重构时可顺带整理（非功能问题）。

## 建议的下一步（按 teach 增量）

1. 将 Digit（及未来的 Board）`PixelBuffer` 传入 `PaintExecutor`，涂对后刷新对应纹理。
2. 引入 `GameConfig` 与 teach 中的视口节点层级，再接 `ViewportController`。
3. 补 `GestureDetector` + `LineFill` + `CellHitTest` 实现拖动涂色与吸附。

---

*文档由维护者/AI 生成，用于会话接力；与 `assets/teach/` 不一致时以代码与 teach 为准并更新本文。*
