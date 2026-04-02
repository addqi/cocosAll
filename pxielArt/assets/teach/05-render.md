# 05 — 渲染层（render）

## 概述

渲染层管理三张动态纹理 + 一个变换父节点。职责单一：把 PixelBuffer 的数据上传到 GPU 并显示为 Sprite。**不做任何逻辑判断。**

## 需要创建的文件

```
src/render/
├── BoardLayer.ts    # Board 层（灰度底图）
├── BrushLayer.ts    # Brush 层（涂色结果）
└── DigitLayer.ts    # Digit 层（数字+网格线）
```

---

## 节点层级结构

```
Viewport (触摸区域, 固定尺寸)
  └── Content (缩放+偏移容器)
        ├── Board (灰度底图, Sprite + 动态 Texture2D)
        ├── Digit (数字+网格线, Sprite + 动态 Texture2D)
        └── Brush (涂色层, Sprite + 动态 Texture2D, 最顶层)
```

**原项目参考**: `G15_FBase_BoardInitLogic.ts` 第81-108行创建此层级。

---

## 通用纹理管理模式

三个层的纹理创建方式完全相同，只是像素数据不同。

### 创建流程（Cocos 3.8）

```typescript
// 对应原项目: G15_FBase_BrushRender.ts + G15_FBase_BoardRender.ts
//
// 关键参数:
// - texWidth/texHeight = 网格尺寸（如 100×100）
// - width/height = 显示尺寸（gridCols * cellWidth × gridRows * cellHeight）
// - filterMin/filterMag = Nearest（像素风格，不模糊）
// - format = RGBA8888

function createDynamicTexture(cols: number, rows: number, pixels: Uint8Array): Texture2D {
    const tex = new Texture2D();
    tex.reset({
        width: cols,
        height: rows,
        format: Texture2D.PixelFormat.RGBA8888,
    });
    tex.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
    tex.setWrapMode(Texture2D.WrapMode.CLAMP_TO_EDGE, Texture2D.WrapMode.CLAMP_TO_EDGE);
    tex.uploadData(pixels);
    return tex;
}
```

### 刷新流程

```typescript
// 对应原项目: G15_FBase_BrushFlushFunction.ts
// 只需一行: 把已修改的像素数据重新上传
function flush(texture: Texture2D, pixels: Uint8Array): void {
    texture.uploadData(pixels);
}
```

### 绑定到 Sprite

```typescript
const sf = new SpriteFrame();
sf.texture = texture;
sprite.spriteFrame = sf;
sprite.sizeMode = Sprite.SizeMode.CUSTOM;
// 设置显示尺寸 = 网格数 × 格子像素尺寸
uiTransform.setContentSize(gridCols * cellWidth, gridRows * cellHeight);
```

---

## 1. BoardLayer.ts — 灰度底图

**原项目参考**: `G15_FBase_BoardRender.ts` + `G15_FBase_TexInitFunction.ts`

### 初始化

```typescript
// 原项目: G15_FBase_TexInitFunction.ts 第37-66行
// 将调色板颜色 → 灰度值 → 写入像素
//
// 灰度范围: baseGray(0x86=134) 到 254
// 空格: 灰度 = 255 (与白色背景融合, 不可见)
// 格式: 每像素 R=G=B=gray, A=255
//
// 涂色正确后: A→0 (变透明, 露出下面的 Brush 层颜色)

for (let i = 0; i < flat.length; i++) {
    const gray = flat[i]; // -1=空→255, 其余为映射灰度
    buf[i * 4]     = gray;
    buf[i * 4 + 1] = gray;
    buf[i * 4 + 2] = gray;
    buf[i * 4 + 3] = 255; // 初始不透明, 涂色后变 0
}
```

### 涂色后更新

```typescript
// 原项目: G15_FBase_CellPaintRecordFunction.ts 第87-91行
// 正确涂色后, Board 层对应像素 alpha → 0
if (matched) {
    const px = (row * gridCols + col) * 4;
    boardPixels[px + 3] = 0; // alpha = 0, 灰度底图消失
}
```

---

## 2. BrushLayer.ts — 涂色结果层

**原项目参考**: `G15_FBase_BrushRender.ts` + `G15_FBase_BrushEffectRender.ts`

### 初始化

```typescript
// 原项目: G15_FBase_TexInitFunction.ts 第69-76行
// 全透明: new Uint8Array(gridCols * gridRows * 4)
// Uint8Array 默认全 0, 即 RGBA = (0,0,0,0) = 全透明
```

### 涂色后更新

```typescript
// 原项目: G15_FBase_CellBrushWriteFunction.ts 第59-63行
// 写入调色板颜色
const idx = (row * gridCols + col) * 4;
buf[idx]     = r;  // 调色板颜色 R
buf[idx + 1] = g;  // 调色板颜色 G
buf[idx + 2] = b;  // 调色板颜色 B
buf[idx + 3] = matched ? 255 : 100;
// matched=true: alpha=255 全不透明（正确涂色, 覆盖 Board 灰度）
// matched=false: alpha=100 半透明（涂错了, 看得到底图）
```

### 特效渲染（可选扩展）

```typescript
// 原项目: G15_FBase_BrushEffectRender.ts 第35-37行
// 当关卡 starType > 0 时, 用 glitter shader 替代默认渲染
// renderCondition() 返回 true 时由特效渲染器接管
// 初期不需要实现, 留好扩展口即可
```

---

## 3. DigitLayer.ts — 数字+网格线层

**原项目参考**: `G15_FBase_DigitRender.ts` + `G15_FBase_DigitInitFunction.ts`

### 初始化

```typescript
// 原项目: G15_FBase_DigitInitFunction.ts 第32-48行
// R 通道 = 数字编码（1-based, 即 paletteIndex + 1, 最大 99）
// A 通道 = 可见性（255=可见, 涂色后→0）
// G,B 通道 = 未使用

for (let row = 0; row < gridRows; row++) {
    for (let col = 0; col < gridCols; col++) {
        const paletteIdx = board[row][col];
        if (paletteIdx < 0) continue; // 空格不显示数字
        const digit = paletteIdx + 1;  // 1-based
        const i = (row * gridCols + col) * 4;
        buf[i]     = digit <= 99 ? digit : 99; // R = 数字编码
        buf[i + 3] = 255;                       // A = 可见
    }
}
```

### Digit 层的作用

Digit 层承载两个功能:
1. **数字**: 每个格子中显示对应的调色板编号
2. **网格线**: 格子之间的分隔线

在原项目中, 这两个功能由 `batchdigit` shader 在 GPU 端绘制。在 Cocos 3.8 简化版中, 可以先用以下方案:
- **数字**: 初期可用 Label 节点或忽略, 后期用自定义 shader
- **网格线**: 可用半透明叠加或 shader

### 涂色后更新

```typescript
// 原项目: G15_FBase_CellPaintRecordFunction.ts 第93-96行
// 正确涂色后, Digit 层 R→0 (数字消失) + alpha→0 (网格线消失)
if (matched) {
    const px = (row * gridCols + col) * 4;
    digitPixels[px]     = 0; // R = 0, 数字消失
    digitPixels[px + 3] = 0; // A = 0, 完全透明
}
```

### 缩放时的透明度控制

```typescript
// 原项目: G15_FBase_ZoomFadeLogic.ts 第69行
// Digit 层整体透明度随缩放变化
// 缩小(远景) → alpha=0 (数字不可见)
// 放大(近景) → alpha=1 (数字完全可见)
digitComp.alpha = smoothstep(gridShowScale, gridFullScale, currentScale);
```

---

## 接口设计（通用层基类）

三个层结构几乎一样, 可以抽象通用基类:

```typescript
import { Component, Sprite, SpriteFrame, Texture2D, UITransform } from 'cc';
const { ccclass } = _decorator;

@ccclass('DynamicTextureLayer')
export class DynamicTextureLayer extends Component {
    protected _pixels!: Uint8Array;
    protected _texture!: Texture2D;

    /** 初始化纹理 */
    init(cols: number, rows: number, cellWidth: number, cellHeight: number): void {
        this._pixels = new Uint8Array(cols * rows * 4);

        this._texture = new Texture2D();
        this._texture.reset({ width: cols, height: rows, format: Texture2D.PixelFormat.RGBA8888 });
        this._texture.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
        this._texture.uploadData(this._pixels);

        const sf = new SpriteFrame();
        sf.texture = this._texture;
        const sprite = this.node.getComponent(Sprite) || this.node.addComponent(Sprite);
        sprite.spriteFrame = sf;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        this.node.getComponent(UITransform)!.setContentSize(cols * cellWidth, rows * cellHeight);
    }

    /** 获取像素缓冲区（供 PaintExecutor 写入） */
    get pixels(): Uint8Array { return this._pixels; }

    /** 上传修改后的像素数据到 GPU */
    flush(): void {
        this._texture.uploadData(this._pixels);
    }
}
```

然后 `BoardLayer`、`BrushLayer`、`DigitLayer` 继承它, 各自只需添加初始化逻辑。

---

## 渲染刷新时机

```
PaintExecutor.paintCells()    ← 写像素（可能写多次）
  ↓
if (brushDirty) brushLayer.flush()    ← 统一上传一次
if (boardDirty) boardLayer.flush()
if (digitDirty) digitLayer.flush()
```

**先批量写, 后统一 flush** — 对应原项目的 `CellBrushWrite` + `BrushFlush` 分离设计。
