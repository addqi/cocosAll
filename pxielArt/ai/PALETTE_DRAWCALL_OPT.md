# 调色板 DrawCall 优化需求

> 核心问题：山水关等大色板关卡（50+ 色），调色板 DrawCall 极高。  
> 根因：所有页全量创建 + Sprite/Label 交替渲染打断合批。

---

## 0. 现状分析

### 当前架构

```
PaletteBar
├── BarBg (Sprite)                     ← 1 DC
├── MaskView (Mask)                    ← +2 DC (stencil write/clear)
│   └── Content                        ← position.x 驱动翻页
│       ├── ToolPanel                  ← 3 道具 × 5 节点 = 15 可渲染节点
│       ├── ColorPage_0                ← 10 item × 3 节点 = 30 可渲染节点
│       ├── ColorPage_1                ← 30
│       ├── ColorPage_2                ← 30
│       ├── ColorPage_3                ← 30
│       └── ColorPage_4                ← 30
└── PageIndicator                      ← 6 dots
```

**每个 PaletteItem 的子节点渲染顺序：**

```
PaletteItem_N
├── Ring  (Sprite, whitePixel)  ─┐
├── Bg    (Sprite, whitePixel)   │ 同纹理可合批
└── Label (Label, charAtlas)    ─┘ ← 不同纹理，打断 batch！
```

**山水关 (50色) 节点统计：**

| 区域 | 节点数 | 实际可见 |
|------|--------|----------|
| 色块 | 50 × 3 = **150** | 10 × 3 = 30 |
| 道具 | 3 × 5 = **15** | 仅道具页可见时 |
| 指示器 | **6** | 6 |
| 总计 | **171** | ≤ **36** |

**DrawCall 分解（最差情况）：**

- Mask stencil: 2 DC
- BarBg: 1 DC  
- 每个 item 的 Sprite→Label 切换: 每 item 至少 2 次打断
- 50 items × 2 ≈ **100+ DC** 仅调色板区域
- 加上道具、指示器 ≈ **120+ DC**

### 核心病因

1. **全量实例化** — N 页色块全部创建并挂在场景树，active = true，全部参与渲染
2. **Sprite / Label 交替** — 子节点按深度优先遍历，Sprite→Label→Sprite 每次切纹理就断 batch
3. **道具页常驻** — 即使滑到第 5 页色块，道具页的 15 个节点仍然 active

---

## 1. 优化方案总览

| # | 策略 | 预期效果 |
|---|------|----------|
| A | 虚拟列表（对象池） | 可渲染节点从 **165** → **最多 36** |
| B | Sprite / Label 分层 | Sprite 全合一批 + Label 全合一批，DC 从 100+ → **~4** |
| C | 道具面板惰性激活 | 非可见时 0 DC 贡献 |

**优化后理论 DC：**

```
Mask stencil:   2
BarBg:          1
Sprite 层:      1-2 (所有 Ring + Bg 合批)
Label 层:       1-2 (所有数字标签合批)
道具 (仅可见):  2-3
指示器:         1
────────────────
合计:           ~8-10 DC (峰值翻页过渡)
稳态:           ~6 DC
```

---

## 2. 详细需求

### A. 虚拟列表 — 对象池复用

#### A.1 节点池规格

| 参数 | 值 | 说明 |
|------|-----|------|
| 池容量 | **2 × 5 + 2 = 12** | 1 整页 + 2 个过渡缓冲 |
| 每个 slot | Ring + Bg + Label（仅逻辑关联，物理分层） | 见 B 节 |

> **12 的含义**：翻页过渡动画期间，最多 10 个当前页 item + 2 个下一页边缘 item 可见。稳态时只有 10 个 active。

#### A.2 回收/填充逻辑

```
触发时机:
  - navigateToPage(target) 调用时
  - 翻页 tween 每帧 (或关键帧) 更新可见区域

流程:
  1. 根据 content.position.x 计算当前可见页范围 [leftPage, rightPage]
  2. 计算可见 item 索引集合 visibleSet
  3. 回收 visibleSet 之外的 slot → 入池（active = false）
  4. 为 visibleSet 中缺失的 item 从池中取 slot → 绑定数据 + 设位置 + active = true
```

#### A.3 slot 数据绑定

```typescript
interface PaletteSlot {
    ringSprite: Sprite;     // 在 SpriteLayer 下
    bgSprite: Sprite;       // 在 SpriteLayer 下
    label: Label;           // 在 LabelLayer 下
    currentIndex: number;   // 当前绑定的 palette index，-1 = 空闲
}

bind(slot: PaletteSlot, index: number, palette: string[]): void {
    slot.currentIndex = index;
    slot.bgSprite.color = hexToColor(palette[index]);
    slot.label.string = isCompleted(index) ? '✓' : String(index + 1);
    slot.label.color = contrastColor(slot.bgSprite.color);
    slot.ringSprite.node.active = (index === selectedIndex);
    // 设置位置：根据 index 计算页内位置
}
```

---

### B. Sprite / Label 分层渲染

#### B.1 节点结构（优化后）

```
MaskView (Mask)
└── Content
    ├── SpriteLayer          ← 所有色块 Sprite 集中在此节点下
    │   ├── Ring_0 (Sprite)
    │   ├── Bg_0   (Sprite)
    │   ├── Ring_1 (Sprite)
    │   ├── Bg_1   (Sprite)
    │   └── ...              ← 最多 12×2 = 24 个 Sprite 节点
    │
    ├── LabelLayer           ← 所有数字标签集中在此节点下
    │   ├── Lab_0  (Label)
    │   ├── Lab_1  (Label)
    │   └── ...              ← 最多 12 个 Label 节点
    │
    └── ToolLayer            ← 道具节点（条件激活）
        ├── ToolSpriteLayer
        │   ├── Tool_Ring_0
        │   ├── Tool_Bg_0
        │   └── ...
        └── ToolLabelLayer
            ├── Tool_Lab_0
            └── ...
```

#### B.2 分层规则

- **同纹理节点必须在同一父节点下连续排列**，引擎按兄弟顺序合批
- SpriteLayer 内所有子节点使用同一个 `whitePixel` SpriteFrame → 全部合为 **1 DC**
- LabelLayer 内所有 Label 共享 char atlas → 合为 **1-2 DC**
- 位置同步：slot.bind() 时同时设置 SpriteLayer 和 LabelLayer 中对应节点的 worldPosition

#### B.3 位置同步方案

```
色块 item 逻辑位置:
  pageX = (pageIndex) * viewWidth
  itemX = pageX + colOffset
  itemY = rowOffset

绑定时:
  ringNode.setPosition(itemX, itemY)    // 在 SpriteLayer 下
  bgNode.setPosition(itemX, itemY)      // 在 SpriteLayer 下
  labelNode.setPosition(itemX, itemY)   // 在 LabelLayer 下

翻页时 Content 整体移动:
  SpriteLayer 和 LabelLayer 是 Content 子节点
  → 它们跟随 Content.position.x 自动移动
  → 各 item 节点只需设置页内相对位置，无需每帧更新
```

---

### C. 道具面板惰性激活

#### C.1 激活条件

```
道具页位于 page 0，其右边缘 x = viewWidth / 2

激活条件（active = true）:
  可见区域左边缘 ≤ 道具页右边缘 + extensionPx

即:
  -content.position.x ≤ viewWidth + extensionPx

反之 deactivate 整个 ToolLayer
```

#### C.2 配置

| 配置项 | key | 默认值 | 说明 |
|--------|-----|--------|------|
| 道具激活扩展距离 | `paletteToolActivateExtensionPx` | **20** | 可见边缘到道具页边缘的提前激活距离 |

加入 `GameConfig`：

```typescript
// ==================== 调色板性能 ====================
/** 道具面板提前激活的扩展像素距离 */
paletteToolActivateExtensionPx: 20,
```

#### C.3 检查时机

- `navigateToPage()` 调用时
- 手指拖拽 `TOUCH_MOVE` 中 content 位置变化时
- 翻页动画 tween 的 `onUpdate` 回调中

---

## 3. 实现约束

### 3.1 不可破坏的接口

以下 `PalettePanel` 公开接口必须保持不变（向后兼容）：

```typescript
setup(palette, brushState, itemFrame, options): Node[]
hitTest(colorPageIndex, localX, localY): number
getPageForIndex(index): number
select(index): void
markBrushComplete(brushIndex): void
autoSelectNextUnfinished(completedIndex, isComplete): void
```

### 3.2 不可破坏的行为

- 点击色块选中 + Ring 高亮
- 翻页手势 + 吸附动画
- 自动跳到未完成色
- 道具面板点击、数量 badge 更新
- 页面指示器同步

### 3.3 性能指标

| 指标 | 当前 | 目标 |
|------|------|------|
| 调色板 active 节点 | 171 (50色) | ≤ 36 (稳态) / ≤ 48 (过渡) |
| 调色板 DrawCall | ~120 | ≤ 10 |
| 首次 setup 耗时 | 全量创建 | 仅创建 12 slot |

---

## 4. 文件影响范围

| 文件 | 改动程度 | 说明 |
|------|----------|------|
| `PalettePanel.ts` | **重写** | 核心：虚拟列表 + 分层 |
| `PaletteInstaller.ts` | **较大改动** | Content 结构变更 + 道具惰性激活 |
| `ToolPanel.ts` | **较小改动** | 输出分层节点(SpriteLayer / LabelLayer) |
| `GameConfig.ts` | **小改** | 新增 `paletteToolActivateExtensionPx` |

---

## 5. 任务拆分

| # | 任务 | 依赖 | 状态 |
|---|------|------|------|
| 1 | 新增 `GameConfig.paletteToolActivateExtensionPx = 20` | 无 | ⬜ 待做 |
| 2 | 实现 `PaletteSlotPool` — 对象池（12 slot 创建/回收/绑定） | 无 | ⬜ 待做 |
| 3 | 重写 `PalettePanel.setup()` — 分层节点结构 + 虚拟列表 | #2 | ⬜ 待做 |
| 4 | 重写 `PalettePanel` 翻页时 slot 刷新逻辑 | #3 | ⬜ 待做 |
| 5 | 改造 `ToolPanel.create()` — 输出 ToolSpriteLayer + ToolLabelLayer | 无 | ⬜ 待做 |
| 6 | 改造 `PaletteInstaller` — 新 Content 结构 + 道具惰性激活 | #3 #5 | ⬜ 待做 |
| 7 | hitTest 适配（虚拟列表下命中判定） | #3 | ⬜ 待做 |
| 8 | 验证：50 色关卡 DC ≤ 10 | #6 | ⬜ 待做 |
