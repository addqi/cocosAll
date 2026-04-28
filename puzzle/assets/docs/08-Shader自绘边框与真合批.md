# 08 · Shader 自绘边框与真合批

> 07 节后玩法已经闭合：洗牌 → 拖动 → 交换 → 自动合并 → 整组搬运 → 胜利。**业务层不再动一行**。
>
> 本节是一次**纯渲染层重构**——把 01 节当时跳过的"选项 B：1 张共享纹理 + UV 偏移"用 shader 拿下来，并顺手把"边框 / 圆角 / 合并接缝消失"这三个视觉效果一次做完。
>
> **关键结论先抛**：
>
> - 3×3 时旧方案没问题，扩到 10×10 = 100 块时**必爆**（不是 DC，是 cc.Mask 圆角和子节点边框那条路线必爆）。
> - 一段 SDF 公式干掉 4 个分支：图片层 / 白边 / 黑边 / 外透明，全靠 `smoothstep` + 圆角矩形距离场。
> - 合并视觉新做法：合并完成后**在 shader 里让相邻边消失**，比"transform 偏移 gap/2"直观得多。
> - **业务层（slots / pieceId / row / col / groupId / swap / 合并 / 胜利）一行不改。**

---

## 本项目落地差异（先看这里再读后文）

教学文档的实施路线和本项目落地有几处实操差异，**业务结论不变**——只是工程接缝换了形状。读后续章节时把下表带在脑子里：

| 教程版假设 | 本项目实际 | 原因 |
| --- | --- | --- |
| effect 放 `assets/resources/effects/` | 放 `assets/game-bundle/effects/` | 项目走 bundle 不走 resources |
| `pieceMaterial` 是 `@property(Material)` Inspector 拖入 | `pieceMaterial: Material \| null = null` 普通字段，由 GamePage 动态注入 | PuzzleBoard 是 `addComponent` 创建，没场景实体，@property 不出现在 Inspector |
| 一旦上 08 就再无 01 节切片路径 | **双路径并存**：material 非 null → 08 路径；null → 01 路径 fallback | 用户没在编辑器创建 .mtl 时游戏不能死——Linus 的 "Never break userspace" |
| frag 用 `globalUV.y = (pieceRow + v_uv0.y) / gridY` | 改成 `(gridY - 1.0 - pieceRow + v_uv0.y) / gridY` | 项目 01 节确定的 row=0 在顶约定，要把 y 翻一下保持视觉一致 |
| frag `topQ = p.y < 0.0` | `topQ = p.y > 0.0` | 同上，v_uv0.y=1 在 piece 顶部 |

**双路径架构（最重要）**：
- **08 路径**：`pieceMaterial` 非 null。所有块共享 `sourceImage` + 共享 `sharedMat`，`sprite.color = (borderMask, pieceId, 0, 255)` 顶点色编码差异，shader 自绘圆角黑白边。10×10 = 1~2 DC。
- **01 路径**：`pieceMaterial` 为 null。每块克隆 SpriteFrame 改 rect，默认 sprite material（同 texture）下也走合批。视觉简陋（无边框无圆角），但功能完整。
- 切换信号：用户在 Cocos 编辑器右键 `assets/game-bundle/effects/puzzle-piece.effect → Create / Material`，命名为 `puzzle-piece.mtl` 放进同目录，重启游戏即生效。**不需要改任何代码**。

**material 注入数据流**：
```
GamePage.startLevel(entry)
  ├── BundleManager.loadImageSF(entry.imagePath)       → SpriteFrame
  └── GamePage._ensurePieceMaterial()                  → Material | null
       └── (首次)BundleManager.loadMaterial('effects/puzzle-piece')
       └── (后续)模块级 Promise 缓存复用，不重复加载
  →
  GamePage._mountBoard()
    board.sourceImage   = sf
    board.pieceMaterial = mat       // ← 关键：null 也合法，board 会 fallback
    board.render()
```

`_ensurePieceMaterial` 只在首次 startLevel 警告一次"没找到 .mtl"——后面所有关卡复用这个 Promise，零成本，控制台不刷屏。

剩下章节按教程读，遇到上表里的差异点替换即可。

---

## 起点回顾

打开 01 节写好的 `PuzzleBoard.createPieces()`：

```typescript
for (let pid = 0; pid < this.pieceCount; pid++) {
    const r = Math.floor(pid / this.pieceGrid);
    const c = pid % this.pieceGrid;

    // ...
    // 关键：克隆 SpriteFrame，改 rect 指向源图的 1/N 区域
    const frame = SpriteFrame.createWithImage(sourceTex);
    frame.rect = new Rect(/* 那 1/N 区域的像素 rect */);

    const sprite = node.addComponent(Sprite);
    sprite.spriteFrame = frame;
    // ...
}
```

每块拿到一个独立 SpriteFrame——**`rect` 字段不同，但底层 `texture` 是同一张**。这意味着：

- ✅ Cocos 已经识别"同一张 texture" → 默认 sprite material 下**也能合批**。3×3 时打开 Profiler 看 DC 应该就是 1~3。
- ❌ 但**没法加圆角**（叠 cc.Mask 即破合批）；
- ❌ **没法加边框**（叠子节点 Sprite 4 条边即增 4×N 节点）；
- ❌ **没法做"合并接缝消失"**（要按 groupId 同步多块的边框 active 状态）。

3×3 时这一切毫无问题——业务玩起来挺好。本节解释为什么扩到 10×10 必死，以及怎么换。

---

## 1. 数量级压力测试

把 `pieceGrid` 改成不同值，**外加一项视觉需求**（圆角 + 黑白双边框 + 合并接缝消失）后的开销走势：

| `pieceGrid` | 块数 | **旧路线**（cc.Mask + 4 边子节点）| **新路线**（共享 effect + shader 自绘） |
| ----------: | --: | --------------------------------: | --------------------------------------: |
|         3×3 |   9 | 9 个 Mask + 36 边子节点 ≈ 45 DC + 45 节点 | **1~2 DC, 9 节点**                |
|         4×4 |  16 | 16 + 64 ≈ 80 DC + 80 节点         | **1~2 DC, 16 节点**                     |
|         6×6 |  36 | 36 + 144 ≈ 180 DC + 180 节点      | **1~2 DC, 36 节点**                     |
|       10×10 | 100 | 100 + 400 ≈ 500 DC + 500 节点     | **1~2 DC, 100 节点**                    |

> 实际数字会比理论 DC 略高（Canvas / UI 装饰），但走势稳定**线性 vs 常数**。

**Linus 一句话**：3×3 时这一节是过度设计；10×10 时这一节是必修。教学版做完整方案，只为让玩家改一行 `pieceGrid = 10` 就能跑。

---

## 2. 三选一（Linus 砍掉两个）

### A. 给每块加 `cc.Mask` 圆角 + 子 Sprite 边框

社区主流路线。3×3 还能撑，但：

- **`cc.Mask` 不参与合批**——每个 Mask 一个 DC 起步。
- 边框 = 给每块再叠 4 个子 `Sprite`，再 +N DC + N 节点。
- ❌ 否决——10×10 时上千 DC，手机直接卡。

### B. 给每块叠 4 条 9-slice 边 + 共享材质

- 边框确实能合批（共享纹理 + 默认材质）——但**每块 4 个子节点**，节点数 ×5。
- 100 块 = 500 节点。事件层、ChildOf、命中检测都得跟着改。
- 视觉合并（边框消失）要逐边 `setActive(false)`。
- ❌ 否决——节点开销线性增长，复杂度全砸到层级树上。

### C. 自定义 effect + 共享材质 + shader 自绘 4 层

- 节点数 = 块数（不增）。
- 共享材质 + 共享纹理 = **真合批**（理论 1 DC）。
- 边框 / 圆角 / 合并视觉全部在 frag 里算，CPU 零成本。
- 复杂度集中在 1 个 `.effect` 文件。
- ✅ 选这个。

> **好品味**：A 和 B 都是"用更多对象处理特殊情况"。C 是"重新选数据结构（共享纹理 + 顶点色编码）让特殊情况消失"。

---

## 3. 三个升级合在一起（一次想清）

> 这三件事**必须一次做完**，单独做任何一件都得不到合批。

### 升级 A：所有 piece 用**同一个 SpriteFrame**

旧：每块克隆出一个 SpriteFrame，`rect` 不同 → 图集思路。
新：**所有 piece 都把 `sprite.spriteFrame` 设成同一个 `sourceImage`**，让每块 sprite 整张大图都参与渲染。"显示自己那 1/N"是 **shader 的活儿**，不是 sprite 切矩形的活儿。

### 升级 B：每块通过 **`sprite.color` 编码身份**

`Color(R, G, B, A)` 共 32 bit，被 Cocos 的渲染管线写入顶点 `a_color`。我们用前 24 bit：

```
sprite.color = new Color(rByte, pieceId, 0, 255)
                          └─R 字节: 低 4 位 = borderMask, 高 4 位备用
                                   └─G 字节: pieceId（10×10=100，单字节够；16×16=256 正好满）
                                            └─B 字节: 备用
                                                     └─A: 255 不动（透明度走另一套，Sprite 节点 opacity）
```

**改 `sprite.color` 不打断合批**——它只是顶点属性，不创建新 material 实例。这就是免费午餐。

### 升级 C：自定义 effect 在 shader 里完成

frag 主流程：

```
1. 解 v_color → pieceIdx + borderMask
2. pieceIdx → (row, col) → UV 偏移采样大图，得到 baseColor
3. 当前像素到 piece 边的距离 SDF（按 borderMask 把"已合并的边"压成不存在）
4. SDF 距离 → 4 层混合：图片 ← 白边 ← 黑边 ← α 衰减
```

整段 frag 没有显式 `if`，全靠 `smoothstep` 软过渡。

---

## 4. 给 PuzzlePiece 加一个字段

打开 `assets/scripts/puzzle/PuzzlePiece.ts`，加 `borderMask`：

```typescript
import { _decorator, Component } from 'cc';
const { ccclass } = _decorator;

@ccclass('PuzzlePiece')
export class PuzzlePiece extends Component {
    pieceId: number = -1;
    row: number = -1;
    col: number = -1;
    groupId: number = -1;

    /**
     * [08 节] 边框可见位掩码：bit0=上, bit1=右, bit2=下, bit3=左。
     * 1 = 显示边框，0 = 不显示（已与同组邻块贴合）。
     * 派生量：mergeScan 完成后由 PuzzleBoard.recalcBorderMasks() 全量重算。
     */
    borderMask: number = 0xf;
}
```

**原则提醒**：`borderMask` 跟 `node.position` 一样**不储存真相**。每次 `mergeScan` 末尾全量重算 N 个值，O(N) 成本忽略不计。

---

## 5. 写 `.effect` 文件

> **项目落地版已经写好**：`assets/game-bundle/effects/puzzle-piece.effect`。和下面教程版的差异：
> - frag 里 `globalUV.y = (gridY - 1.0 - pieceRow + v_uv0.y) / gridY`（教程版没翻）。
> - 4 条边距离公式 `dTop = p.y - 0.5`、`dBottom = -p.y - 0.5`（教程版相反）。
> - `topQ = p.y > 0.0`（教程版 < 0）。
>
> 三处都是同一根因：项目约定 piece.row=0 在顶 + v_uv0.y=1 在 piece 顶部。
> 直接读项目里那个文件，注释里有完整推导。

新建 `assets/resources/effects/puzzle-piece.effect`（**教学版路径，本项目放 `assets/game-bundle/effects/`**）：

```glsl
// 教学拼图自绘 effect（08 节）
//   作用：替换默认 sprite 材质，每块 piece 通过 v_color (rgb) 解出
//        pieceIdx + borderMask，自己负责采样和画边框。
//   合批前提：所有 piece 共享同一个 .mtl + 同一个 SpriteFrame。
//   每块的差异通过 sprite.color 传，不破坏合批。

CCEffect %{
  techniques:
  - passes:
    - vert: vs
      frag: fs
      blendState:
        targets:
        - blend: true
      rasterizerState:
        cullMode: none
      properties:
        # gridDim 默认值仅占位，运行时由 PuzzleBoard 按 pieceGrid 覆盖。
        gridDim:        { value: [3.0, 3.0] }
        cornerRadius:   { value: 0.06 }            # 圆角半径（占 piece 边长比例，0~0.5）
        whiteWidth:     { value: 0.012 }           # 白边相对宽
        blackWidth:     { value: 0.018 }           # 黑边相对宽
        whiteColor:     { value: [1.0, 1.0, 1.0, 1.0] }
        blackColor:     { value: [0.05, 0.05, 0.05, 1.0] }
}%

CCProgram vs %{
  precision highp float;
  #include <cc-global>
  #include <cc-local>

  in vec3 a_position;
  in vec4 a_color;
  in vec2 a_uv0;

  out vec4 v_color;
  out vec2 v_uv0;

  void main () {
    vec4 pos = vec4(a_position, 1);
    #if CC_USE_MODEL
      pos = cc_matViewProj * cc_matWorld * pos;
    #else
      pos = cc_matViewProj * pos;
    #endif
    v_color = a_color;  // sprite.color 在这里被写入 a_color，原样传到 frag
    v_uv0 = a_uv0;      // sprite 默认 uv0 范围 [0,1]，覆盖整个 piece 矩形
    gl_Position = pos;
  }
}%

CCProgram fs %{
  // ── GLSL ES 1.0 / 3.0 双版本兼容层 ──
  // Cocos 3.x 跑 WebGL2 时 emit ES 3.0；跑 WebGL1 时 emit ES 1.0。
  // 转译器只自动改 in/out varying 关键字——texture2D / gl_FragColor 得手动 shim。
  #if __VERSION__ < 300
    #extension GL_OES_standard_derivatives : enable
  #endif

  #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
  #else
    precision mediump float;
  #endif

  #if __VERSION__ >= 300
    #define texture2D texture
    layout(location = 0) out vec4 cc_FragColor;
    #define gl_FragColor cc_FragColor
  #endif

  in vec4 v_color;
  in vec2 v_uv0;

  // 必须叫 cc_spriteTexture——Cocos sprite 组件用这个特定名字自动绑 SpriteFrame.texture。
  // 而且 `texture` 在 GLSL ES 1.0 是保留字，编辑器会直接报 EFX2402 拒编。
  uniform sampler2D cc_spriteTexture;

  // std140 UBO 布局：vec4 16 对齐，vec2 8 对齐，float 4 对齐。
  // 大头（vec4）放前面，小头（vec2/float）殿后，避免编译器在中间塞隐式 padding。
  uniform UBO_FS {
    vec4 whiteColor;
    vec4 blackColor;
    vec2 gridDim;
    float cornerRadius;
    float whiteWidth;
    float blackWidth;
  };

  void main () {
    // ============ 1. 解 v_color ============
    // a_color 在 GPU 已被归一化为 [0,1]。乘 255 还原成 [0,255] 浮点字节。
    // 注意：用 floor + mod 模拟位运算——`&` `|` 在 GLSL ES 1.0 不支持。
    float rByte    = floor(v_color.r * 255.0 + 0.5);
    float pieceIdx = floor(v_color.g * 255.0 + 0.5);

    // borderMask = rByte 低 4 位 = rByte mod 16
    float borderMask = mod(rByte, 16.0);

    // 4 个方向位拆解：bit i = mod(floor(borderMask / 2^i), 2)
    bool topB    = mod(floor(borderMask / 1.0), 2.0) >= 0.5;
    bool rightB  = mod(floor(borderMask / 2.0), 2.0) >= 0.5;
    bool bottomB = mod(floor(borderMask / 4.0), 2.0) >= 0.5;
    bool leftB   = mod(floor(borderMask / 8.0), 2.0) >= 0.5;

    // ============ 2. 算 UV 偏移采样大图 ============
    // 注意：变量名不要叫 `row` / `col`——后面"最终颜色"还要用 `col`，撞名会触发
    //       'col' redefinition + 整片 mix/.a/gl_FragColor 连锁报错。
    float gridX = gridDim.x;
    float gridY = gridDim.y;
    float pieceRow = floor(pieceIdx / gridX);
    float pieceCol = mod(pieceIdx, gridX);

    // 当前像素 v_uv0 是本 piece 的局部 [0,1]，要映射到大图全局 uv。
    vec2 globalUV = vec2(
      (pieceCol + v_uv0.x) / gridX,
      (pieceRow + v_uv0.y) / gridY
    );
    vec4 baseColor = texture2D(cc_spriteTexture, globalUV);

    // ============ 3. 方向感知 SDF —— 让"消失的边"既不衰减 alpha 也不画边框 ============
    vec2 p = v_uv0 - vec2(0.5);

    // —— 4 条边的有符号距离 ——
    // 标准式：dTop = -p.y - 0.5（< 0 = 内部，0 = 边界，> 0 = 外部）
    // 当 mask=0（已与同组邻块合并），把该边距离压成 -2.0，相当于"该侧边界不存在"，
    // 后续 max(...) 不会取它 → 该侧像素 dRect 由其它 3 边决定 → α 不衰减、不画边框。
    const float NO_EDGE = -2.0;
    float dTop    = topB    ? (-p.y - 0.5) : NO_EDGE;
    float dRight  = rightB  ? ( p.x - 0.5) : NO_EDGE;
    float dBottom = bottomB ? ( p.y - 0.5) : NO_EDGE;
    float dLeft   = leftB   ? (-p.x - 0.5) : NO_EDGE;

    // 矩形 SDF（无圆角版）= 4 条有符号距离的最大值
    float dRect = max(max(dTop, dRight), max(dBottom, dLeft));

    // —— 4 个角的圆角处理 ——
    // 每个角是否走"圆角"取决于"该角对应的两条相邻边是否都可见"。
    // 合并方向上的角不能再圆角，否则会和邻块的方角对接出空隙。
    float r = cornerRadius;
    vec2 cornerInner = abs(p) - vec2(0.5 - r);
    float dRoundCorner = length(max(cornerInner, 0.0)) - r;

    bool topQ   = p.y < 0.0;
    bool rightQ = p.x > 0.0;
    bool roundHere =
        ( topQ &&  rightQ && topB    && rightB ) ||
        ( topQ && !rightQ && topB    && leftB  ) ||
        (!topQ &&  rightQ && bottomB && rightB ) ||
        (!topQ && !rightQ && bottomB && leftB  );

    bool inCornerArea = cornerInner.x > 0.0 && cornerInner.y > 0.0;
    float dOuter = (inCornerArea && roundHere) ? dRoundCorner : dRect;

    // —— 抗锯齿宽度 ——
    float aa = fwidth(dOuter);

    // —— inside α —— 圆角外 fade，方向被遮蔽侧 dOuter ≪ 0 → insideMask=1（满显）
    float insideMask = 1.0 - smoothstep(-aa, aa, dOuter);
    if (insideMask < 0.001) {
      discard;
    }

    // ============ 4. 边框双层带 ============
    //   带 = "距外缘 < blackWidth" 的细环。SDF 的 dOuter 已经隐含"哪些边参与"，
    //   所以这里不再需要 visMask：被遮蔽边的 dOuter ≈ NO_EDGE 远小于阈值，
    //   两个 smoothstep 都吐 0 → 那一侧自然不画边框。
    float blackBand = smoothstep(-blackWidth - aa, -blackWidth + aa, dOuter)
                    * (1.0 - smoothstep(-aa, aa, dOuter));
    float whiteBand = smoothstep(-blackWidth - whiteWidth - aa, -blackWidth - whiteWidth + aa, dOuter)
                    * (1.0 - smoothstep(-blackWidth - aa, -blackWidth + aa, dOuter));

    // ============ 5. 合成：图片 ← 白边 ← 黑边 ← α ============
    vec4 col = baseColor;
    col = mix(col, whiteColor, whiteBand);
    col = mix(col, blackColor, blackBand);
    col.a *= insideMask;

    gl_FragColor = col;
  }
}%
```

**这段 frag 的"好品味"在哪？**

第一版（v1）的做法是"**整圈圆角矩形 + 用 visMask 把不可见边的边框带乘掉**"——看着挺聪明，但跑起来有两个症状：

1. **合并后白边**——`insideMask = 1 - smoothstep(...)` 对 4 边一视同仁衰减 α。已合并那侧的像素 α 仍在 0~1 衰减，**透出背景成白线**。
2. **合并后还能看到圆角空隙**——4 个角永远是圆角，不管 borderMask 怎么写。两块拼起来 = 两个圆角对两个圆角 = 中间漏背景。

v1 的根因：**把"边是否可见"当成"边框带是否被乘掉"的特例处理，但 SDF 形状本身不变。**——经典的"加 if 修补症状不动数据"。

v2（本版）的修法：**把"边是否可见"直接编码进 SDF 形状本身**：

- 4 条边各算 `dEdge = ±p.x/y - 0.5`，**mask=0 的边距离强制压成 NO_EDGE = -2.0**。
- `dRect = max(dT, dR, dB, dL)`——`max` 永远不会取那个 -2.0，等价于"那条线被擦掉"。
- 4 个角分别判 `roundHere`：**只有两条相邻边都 mask=1 才画圆角，否则沿用方角的 dRect**。

**边框带、α 衰减、圆角，三个视觉问题用同一个 SDF 形状统一解决**——没有 visMask，没有 if 链。这就是 Linus 说的"**消除特殊情况**"。

---

## 6. 在 Cocos Creator 里创建 .mtl

> ⚠️ Cocos 的 `.mtl` 是引擎序列化文件，**不能手写**——必须由编辑器生成。

**本项目实操**：

1. 编辑器资源管理器进 `assets/game-bundle/effects/` → 选中 `puzzle-piece.effect` → 右键 → "Create / Material"。
2. 生成的 `puzzle-piece.mtl` **保留在同目录**（`assets/game-bundle/effects/puzzle-piece.mtl`）——`GamePage._ensurePieceMaterial` 写死按 `'effects/puzzle-piece'` 路径加载。
3. 双击 `.mtl` 看 Inspector，确认 "Effect" 字段已经指向 `puzzle-piece.effect`。

**保存场景** Ctrl/Cmd+S。

做完这步**重启游戏**：控制台不再出现 `[GamePage] piece material 未找到` 警告 = 切到了 08 路径，应该能看见圆角黑白边。还出现 = 路径错了或 .mtl 没在 bundle 里。

---

## 7. 改写 PuzzleBoard：所有 piece 共享 effect + 顶点色传差异

> **项目落地版已经写好**：`assets/src/puzzle/PuzzleBoard.ts`。**双路径架构**：
> - `_createPieces(layer)` 内分流——`pieceMaterial` 非 null 走 `_createPiecesShared`，null 走 `_createPiecesSliced`（01 节原版）。
> - `_recalcBorderMasks` + `_applyAllPieceColors` 已加，挂在 `_mergeScan` 末尾。
> - 派生纪律：`borderMask` 跟 `position` 同性质——是 `groupId + slots + row + col` 的投影，每次 mergeScan 全量重算，不存真相。
>
> 下面教程版只展示 08 路径——读完去看项目里两个路径并存的实现。

整段 `createPieces` + 加 `recalcBorderMasks` + 写 `applyPieceColor`。打开 `PuzzleBoard.ts`：

```typescript
import {
    _decorator, Component, Node, Sprite, SpriteFrame, UITransform,
    Material, resources, Color, Vec2,
} from 'cc';
import { PuzzlePiece } from './PuzzlePiece';
const { ccclass, property } = _decorator;

@ccclass('PuzzleBoard')
export class PuzzleBoard extends Component {
    @property(SpriteFrame)
    sourceImage: SpriteFrame | null = null;

    @property
    boardSize: number = 600;

    @property({ tooltip: '每边切几块（3 = 3×3 = 9 块）' })
    pieceGrid: number = 3;

    /** 共享 piece 材质（08 节自定义 effect 生成的 .mtl） */
    @property(Material)
    pieceMaterial: Material | null = null;

    get pieceCount(): number { return this.pieceGrid * this.pieceGrid; }
    get pieceDisplay(): number { return this.boardSize / this.pieceGrid; }

    private slots: number[] = [];
    private pieceNodes: Node[] = [];
    /** 每块 sprite 的引用，用于后续修改 color（08 节加） */
    private pieceSprites: Sprite[] = [];

    onLoad() {
        if (!this.sourceImage || !this.pieceMaterial) {
            console.error('[PuzzleBoard] sourceImage / pieceMaterial 未设置');
            return;
        }
        this.initSlots();
        this.createPieces();
        this.layoutAllPieces();
        this.recalcBorderMasks();   // 初始扫一次（每块自成一组，所有边 = 0xf）
        this.applyAllPieceColors(); // 把 borderMask + pieceId 写进 sprite.color
    }

    private initSlots(): void {
        this.slots = [];
        for (let i = 0; i < this.pieceCount; i++) this.slots.push(i);
    }

    private createPieces(): void {
        const pieceLayer = this.node.getChildByName('PieceLayer')!;
        const sourceFrame = this.sourceImage!;

        // === 08 节升级 A：所有 piece 用同一个 SpriteFrame ===
        // 旧（01 节）：每块克隆一个 SpriteFrame、改 rect 指向 1/N 区域。
        // 新：每块都用 sourceFrame 这一个对象，整张大图都送进 sprite。
        //    "显示自己那 1/N" 由 shader 根据 sprite.color.g（pieceId）算 UV。

        // === 08 节升级 C：所有 piece 共享同一个 Material 实例 ===
        // 把 gridDim uniform 写一次，整批共享。改 pieceGrid 时跟着改即可。
        const sharedMat = this.pieceMaterial!;
        sharedMat.setProperty('gridDim', new Vec2(this.pieceGrid, this.pieceGrid));

        this.pieceNodes = [];
        this.pieceSprites = [];
        for (let pid = 0; pid < this.pieceCount; pid++) {
            const r = Math.floor(pid / this.pieceGrid);
            const c = pid % this.pieceGrid;

            const node = new Node(`Piece_${pid}`);
            node.parent = pieceLayer;

            const transform = node.addComponent(UITransform);
            transform.setContentSize(this.pieceDisplay, this.pieceDisplay);

            const sprite = node.addComponent(Sprite);
            sprite.spriteFrame = sourceFrame;     // ← 整张大图，不是切的 1/N
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.customMaterial = sharedMat;    // ← 共享自定义 effect

            const piece = node.addComponent(PuzzlePiece);
            piece.pieceId = pid;
            piece.row = r;
            piece.col = c;
            piece.groupId = pid;
            piece.borderMask = 0xf;

            this.pieceNodes.push(node);
            this.pieceSprites.push(sprite);
        }
    }

    private layoutAllPieces(): void {
        for (let pid = 0; pid < this.pieceCount; pid++) {
            const slotIdx = this.slots.indexOf(pid);
            const { x, y } = this.slotToPosition(slotIdx);
            this.pieceNodes[pid].setPosition(x, y, 0);
        }
    }

    private slotToPosition(slotIdx: number): { x: number; y: number } {
        const sr = Math.floor(slotIdx / this.pieceGrid);
        const sc = slotIdx % this.pieceGrid;
        const center = (this.pieceGrid - 1) / 2;
        return {
            x: (sc - center) * this.pieceDisplay,
            y: (center - sr) * this.pieceDisplay,
        };
    }

    // ============ 08 节新增：派生 borderMask + 写 sprite.color ============

    /**
     * 全量重扫所有 piece 的 borderMask。
     * 调用时机：mergeScan 之后（合并/拆分都可能改 groupId）。
     * 教学版每次跑 N 个块的 4 个邻居判断 = O(4N)，N=100 时 400 次比较，忽略不计。
     */
    private recalcBorderMasks(): void {
        const TOP = 1, RIGHT = 2, BOTTOM = 4, LEFT = 8;
        for (let pid = 0; pid < this.pieceCount; pid++) {
            const piece = this.pieceNodes[pid].getComponent(PuzzlePiece)!;
            const slotIdx = this.slots.indexOf(pid);
            const sr = Math.floor(slotIdx / this.pieceGrid);
            const sc = slotIdx % this.pieceGrid;
            const r = piece.row;
            const c = piece.col;
            const myGroup = piece.groupId;

            let mask = 0xf;

            // 上邻
            if (sr > 0) {
                const nPid = this.slots[(sr - 1) * this.pieceGrid + sc];
                const np = this.pieceNodes[nPid].getComponent(PuzzlePiece)!;
                if (np.groupId === myGroup && np.row === r - 1 && np.col === c) {
                    mask &= ~TOP;
                }
            }
            // 右邻
            if (sc + 1 < this.pieceGrid) {
                const nPid = this.slots[sr * this.pieceGrid + sc + 1];
                const np = this.pieceNodes[nPid].getComponent(PuzzlePiece)!;
                if (np.groupId === myGroup && np.row === r && np.col === c + 1) {
                    mask &= ~RIGHT;
                }
            }
            // 下邻
            if (sr + 1 < this.pieceGrid) {
                const nPid = this.slots[(sr + 1) * this.pieceGrid + sc];
                const np = this.pieceNodes[nPid].getComponent(PuzzlePiece)!;
                if (np.groupId === myGroup && np.row === r + 1 && np.col === c) {
                    mask &= ~BOTTOM;
                }
            }
            // 左邻
            if (sc > 0) {
                const nPid = this.slots[sr * this.pieceGrid + sc - 1];
                const np = this.pieceNodes[nPid].getComponent(PuzzlePiece)!;
                if (np.groupId === myGroup && np.row === r && np.col === c - 1) {
                    mask &= ~LEFT;
                }
            }

            piece.borderMask = mask;
        }
    }

    /**
     * 把 (borderMask, pieceId) 编码到 sprite.color 的 R / G 字节，
     * shader 在 vs 里读 a_color，frag 里乘 255 取整还原。
     * A=255 不动（透明度走 node.opacity / Sprite 节点的 UIOpacity）。
     */
    private applyAllPieceColors(): void {
        for (let pid = 0; pid < this.pieceCount; pid++) {
            this.applyPieceColor(pid);
        }
    }

    private applyPieceColor(pid: number): void {
        const piece = this.pieceNodes[pid].getComponent(PuzzlePiece)!;
        const sprite = this.pieceSprites[pid];
        const rByte = piece.borderMask & 0xf; // 低 4 位
        sprite.color = new Color(rByte, pid & 0xff, 0, 255);
    }
}
```

**关键细节**：

1. **`sprite.spriteFrame = sourceFrame`**——所有 N 个 sprite 都设同一个 SpriteFrame 对象。Cocos 的合批检查器看"同一个 SpriteFrame 引用 = 同一个纹理"立即合批通过。
2. **`sprite.customMaterial = sharedMat`**——所有 N 个 sprite 共享同一个 Material 实例。**绝对不要在循环里 `Material.createWithDefaults()`**——那是给每块克隆一个新 material，立即失批。
3. **`sharedMat.setProperty('gridDim', ...)` 只调一次**，因为 material 是共享的，调一次整批生效。
4. **`sprite.color = new Color(rByte, pid, 0, 255)`** 不破合批——它写顶点色，不是材质属性。

---

## 8. 在 mergeScan / swap 后调 recalcBorderMasks + applyAllPieceColors

回 `PuzzleBoard.ts`，找到 05 节写的 `mergeScan()`。**在它的 `return` 之前**插入：

```typescript
private mergeScan(): { mergedAny: boolean; allInOneGroup: boolean } {
    // ... 05 节 union-find 那一段保持不动 ...

    // === 08 节：派生 borderMask + 同步 sprite.color ===
    // 必须放在 mergeScan 末尾——groupId 此时已是最终值。
    // 放在拖动 onTouchEnd 那一层调也对，但放这里更不容易漏：
    // 任何"可能改 groupId"的入口最终都会走 mergeScan。
    this.recalcBorderMasks();
    this.applyAllPieceColors();

    return { mergedAny, allInOneGroup };
}
```

**为什么 swap 后不直接调？** 因为 swap 完还要跑 mergeScan、`groupId` 才到位。"派生 borderMask"必须在 groupId 稳定后做。把它和 mergeScan 绑死是最稳的位置——**只要 mergeScan 跑了，就一定是最新的**。

> 提醒：07 节加的 `inputLocked` 锁住的是"用户输入"，不是渲染——`recalcBorderMasks` 跑的速度对 100 块也是 < 1ms，不需要锁。

---

## 9. 场景调整

**本项目实操**：**不需要拖 .mtl 进 Inspector**——`PuzzleBoard` 是 `GamePage._mountBoard()` 动态 `addComponent` 创建的，没有静态场景实体。material 通过 `GamePage._ensurePieceMaterial()` 异步加载，再赋给 `board.pieceMaterial`，就是这条路。

需要做的只有 §6 那一步——在编辑器创建 `puzzle-piece.mtl` 放进 `assets/game-bundle/effects/`，剩下的代码都跑通了。`boardSize` / `pieceGrid` 在 GamePage 里按屏宽和当前难度算，也不在 Inspector 配。

（**教学版假设**：场景里有静态 PuzzleRoot 节点，Inspector 能拖 Material——本项目走全代码动态构建，所以这一步省了。）

---

## 10. 跑起来

▶ 预览。

**预期**：

- 屏幕中央 N×N 拼图，每块都有圆角 + 黑边 + 白边（白细黑粗）。
- 拖动正常、swap 正常、合并正常——业务行为跟 07 节一模一样。
- 拼对相邻两块时，**接缝处的边框直接消失**——比 05 节的 transform 偏移直观得多。
- 把 `pieceGrid` 改 10，开 Profiler 看 DC，依然 1~2。

**控制台预期**：无新错误。

**不正常的信号**：

- **整片红色 + "Effect not found"**：`puzzle-piece.effect` 路径不对，必须在 `assets/resources/effects/` 下且文件名一致。
- **纯白方块、看不到图**：`sprite.spriteFrame` 没设；或 effect 编译失败、走了引擎降级到纯色。控制台搜 `Failed to compile`。
- **"图被切错位、很多空白边角"**：`gridDim` 没写进 material。检查 `sharedMat.setProperty('gridDim', new Vec2(pieceGrid, pieceGrid))` 这一行有没有跑、是不是写成了 `[pieceGrid, pieceGrid]` 数组形式（在 Cocos 3.8 里 Vec2 才正确）。
- **"合并后还能看见圆角空隙"**：你照搬了我们最早的 v1 SDF（`roundRectSDF`），那版没修。确认上面 §5 是 v2 方向感知 SDF。
- **"合并处出现白线"**：跟上一条同根因（v1 vs v2）。
- **DC 高于预期**：`material` 在 createPieces 里被复制了，每块拿到独立 material 实例。检查 `customMaterial = sharedMat` 是不是同一个引用。
- **`UBO 'UBO_FS' introduces implicit padding`**：UBO 成员顺序错了。`vec4` 必须排前面，`vec2` 中，`float` 末尾，对照 §5 的顺序复制。
- **`'col' redefinition`**：你在 frag 里把 UV 局部变量也叫 `col`。改成 `pieceCol` / `pieceRow`。
- **`EFX2402: using reserved keyword in glsl1: texture`**：sampler 千万别叫 `texture`——GLSL ES 1.0 把它列为保留字（GLSL 3.0 起是函数名）。改成 `cc_spriteTexture`，Cocos sprite 组件正好按这个名字自动绑 SpriteFrame.texture，一举两得。
- **`'texture2D' : no matching overloaded function found` + `'gl_FragColor' : undeclared identifier`**：你的 effect 编辑器期 `EFX` 检查通过了，但运行期 WebGL2 用 GLSL ES 3.0 编译 → ES3 里 `texture2D` 改名 `texture`、`gl_FragColor` 必须自己声明 `out vec4`。Cocos 3.x 的转译器**只自动改 `in/out` varying 关键字**，剩下要自己 shim。在 frag 顶部加：

  ```glsl
  #if __VERSION__ < 300
    #extension GL_OES_standard_derivatives : enable
  #endif
  // ... precision ...
  #if __VERSION__ >= 300
    #define texture2D texture
    layout(location = 0) out vec4 cc_FragColor;
    #define gl_FragColor cc_FragColor
  #endif
  ```

  顺手把 `GL_OES_standard_derivatives` 也包进 `__VERSION__ < 300`——ES3 的 fwidth 是核心，extension 声明会触发"extension not supported"警告。
- **`EFX2302: fragment output location must be specified`**：上面 shim 里的 `out vec4 cc_FragColor` 没带 `layout(location = N)`——Cocos 3.8 的 effect 编译器为 Vulkan/Metal 后端强制要求 render target 槽位明确。补上 `layout(location = 0)` 即可（单 RT 永远 0）。

---

## 11. 验收清单

### 视觉

1. ✅ 一眼能看出每块都有圆角 + 黑边 + 白边（白比黑细）。
2. ✅ 拖动时块没有"被切角"——圆角是 shader 算的，无 cc.Mask 参与。
3. ✅ 拼对相邻两块（同组 + 正确相邻位置）→ 接缝处的边框**消失**，且无白边、无圆角空隙。
4. ✅ 整组拖动时，组内边框保持消失状态、对外边框保持显示。

### 性能

打开 Profiler 看 DC：

| 测试条件                    | 预期 DC | 备注                                          |
| --------------------------- | -----: | --------------------------------------------- |
| `pieceGrid = 3`，刚开局     | ≈ 1~3  | 1 个 piece DC，加 Canvas 装饰几个            |
| `pieceGrid = 4`，刚开局     | ≈ 1~3  | DC 与 3×3 相同                                |
| `pieceGrid = 10`，刚开局    | ≈ 1~3  | **核心验证点**：100 块依然 1~3                |
| `pieceGrid = 10`，全部拼对  | ≈ 1~3  | borderMask 全 0 不破坏合批                    |

### 共享物理基础检查

**本项目实操**：`PuzzleBoard` 是动态挂的、字段命名前缀 `_`。在浏览器控制台跑：

```javascript
const layer = cc.director.getScene().getChildByPath('Canvas/AppRoot');
const board = layer.getComponentInChildren('PuzzleBoard');
const sprites = board._pieceSprites;
console.log(
    'piece count:', sprites.length,
    '\nAll same SpriteFrame:', sprites.every(s => s.spriteFrame === sprites[0].spriteFrame),
    '\nAll same Material:',    sprites.every(s => s.customMaterial === sprites[0].customMaterial),
    '\nMaterial truthy:',      !!sprites[0].customMaterial,
);
// 走 08 路径：三个都必须 true
// 走 01 路径（fallback）：'All same SpriteFrame' 是 false（每块自己的 frame），
//                        'Material truthy' 是 false（用默认 sprite material），都正常。
```

走 08 路径时三项都 `true` = 合批前提满足。任意一项 `false` 但走 08 路径 → 某处给某块克隆了独立资源。

---

## 12. 复盘：这一节教了什么

### 1. 数量级决定选型——再次印证

01 节为了引入"数据结构"概念暂选了"每块一个独立 SpriteFrame"；08 节为了支持 10×10 + 边框 + 合并视觉把它换掉。**这不是设计失误**——是教学渐进的"先建数据骨架，再升渲染层"。3×3 时旧方案完全够用。

### 2. 工程升级 vs 重构边界

边界划分：

- **业务层**（slots / pieces / groupId / swap / 合并 / 胜利 / inputLocked）= 不动一行。
- **渲染层**（spriteFrame 怎么共享、material 怎么共享、shader 算什么）= 整段重写。

判断标准：升级前后**业务测试**全部能通过。如果业务测试要改，说明你越界了。

### 3. 顶点色是免费午餐

`sprite.color` 在大多数引擎里是给"整块染色"用的——其实 24 bit 是天然的"每实例旁路通道"。任何 per-piece 的差异参数（边框、状态、动画进度）都能编进去，不破坏合批。

> 类似的"被低估的旁路通道"还有 `node.scale`、`node.opacity`——只要引擎层是顶点属性而非材质 uniform，就都不打断合批。

### 4. SDF + smoothstep = 用数学消除特殊情况

旧风格：

```
if (pixel 在圆角外) discard;
else if (pixel 在最外圈) draw 黑;
else if (pixel 在次外圈) draw 白;
else draw 图片;
if (该方向无邻块) draw 边;
else 不画;
```

新风格：

```
distance = 方向感知 SDF
weight   = smoothstep(...)
color    = mix(图片, 白, weight_white)
color    = mix(color, 黑, weight_black)
alpha   *= insideMask
```

**没有 if，每个像素走同一段代码**。GPU 友好，可移植性好。

### 5. 唯一真相延伸到 borderMask

`borderMask` 是从 `slots + groupId + row + col` 派生出来的，**不存真相**——每次 `mergeScan` 末尾全量重算。这维持了 06/07 节确立的纪律：增量更新只用在 swap 这种"必须 O(1)"的地方，状态派生用全量扫。

---

## 13. 常见坑

### 坑 1：合批不生效

最常见原因（按概率排序）：

1. `customMaterial` 写成了 `Material.createWithDefaults({ effectAsset: ... })` 或 `new Material()` 在循环里调用——每块克隆出独立 material 实例。**改回外层一个 `sharedMat` 全部引用**。
2. 某个 piece 的 `spriteFrame` 不一样——可能是哪一节重写时残留了"克隆 SpriteFrame"逻辑。**用 §11 的 `every === sprites[0].spriteFrame` 断言验证**。
3. Profiler 看到的 DC 高于预期，但其实是 Canvas / Label / 装饰节点贡献的。**对照 07 节的 DC 基线**。

### 坑 2：边框抗锯齿"刺眼"

`fwidth` 在某些移动端 GLSL 实现下精度差。可以改成手动估算：

```glsl
// 改用：基于像素 size 的常量近似（pieceDisplay = 200 像素时，1/200 = 0.005）
float aa = 1.5 / 200.0;
```

或者把 `pieceDisplay` 通过 properties 暴露给 shader 作 uniform，更通用。

### 坑 3：圆角处图片"露白"

`baseColor.rgb` 在圆角外按 `insideMask` 衰减 alpha 但**颜色本身没变**。在某些 blend mode 下白色背景会"漏出来"。解决：

```glsl
gl_FragColor = vec4(col.rgb * insideMask, col.a * insideMask);
// 预乘 alpha，混合时不会漏白
```

具体看你的 `blendState`——本 effect 默认 SrcAlpha/OneMinusSrcAlpha，不预乘也行。

### 坑 4：rgb 编码精度丢失

24 bit 在 GPU 端归一化为 `vec3` 后乘 255 取整，**有时会差 1**。原因：浮点采样 + 顶点插值。

- 单顶点四边形不会插值（顶点色 4 个角全相同），无影响。
- 一定要用大于 0~255 范围的值时，**靠 G/B 通道扩展**（每通道 1 字节）。
- 不要把 16 bit 整数拆到一个通道——用两个通道各放 8 bit 再合成。

### 坑 5：`pieceGrid > 16` 时 pieceId 溢出 G 字节

我们把 pieceId 编进 G 字节（8 bit, 0~255）。`pieceGrid = 16 → pieceCount = 256`，刚好占满。**`pieceGrid > 16` 时 pid 会溢出**，shader 解出来错位。

修法：把 pieceId 拆到 G + B 两个字节（高 8 + 低 8），shader 端 `pieceIdx = floor(g * 255 + 0.5) * 256.0 + floor(b * 255 + 0.5)`。

教学版限制 `pieceGrid <= 16`。

### 坑 6：sourceImage 不是正方形

01 节的旧切法按短边裁正方形，所以 `pieceGrid × cellSize ≤ 短边` 即可。但 08 节的 shader UV 偏移**默认源图就是正方形**（`globalUV / gridX vs / gridY`，gridX === gridY）。

如果你的源图是 4:3 长方形，shader 采样会拉伸——把 `gridDim` 设成 `[pieceGrid, pieceGrid]` 不变，但是源图本身要先在 Cocos 编辑器 SpriteFrame 那里**裁成方**（点 SpriteFrame → 'Trim Type' 设 'Custom' 然后调 rect 成方）。

或者在 shader 里再加一个 `imageAspect` uniform 把 `globalUV.y` 缩放回去——本教学版**强制源图正方形**，简单。

### 坑 7：`.effect` 改完 Cocos 不重编

Cocos 3.8 编辑器有时候不会自动重编 effect。改完 `.effect` 文件后：

- 资源管理器里点一下那个 .effect 文件 → "Reimport"（右键菜单）。
- 或者关掉 Creator 重开。

这是引擎的小毛病，不是你的代码问题。

---

## 14. 下一节预告

到这里通用版系列收官的"工程级 + 视觉级"双线都圆满了：

- **工程级**：业务层数据结构与算法（00~07 节）。
- **视觉级**：渲染层合批 + 自绘边框（08 节）。

如果还想进一步玩 shader 把它推到经典拼图的"凹凸卡扣"形状，思路：

- 每块的形状不再是矩形 + 圆角，而是**4 条边各 1 个凸/凹/直**的不规则多边形。
- 每条边的形状用 SDF 复合（圆形布尔减法）描述。
- 凸凹关系存进 `PuzzlePiece.shapeMask`（4 条边各 2 bit，共 8 bit），用 R 字节高 4 位编进 `sprite.color`。

但**那是另一节的事**——看到 10×10 还能 1~2 DC 跑，这一节的钱已经赚到了。

---

## 附：本节修改清单

| 文件 | 改动 |
| ---- | ---- |
| `assets/resources/effects/puzzle-piece.effect` | **新建**（§5） |
| `assets/resources/materials/puzzle-piece.mtl` | **由编辑器生成**（§6） |
| `assets/scripts/puzzle/PuzzlePiece.ts` | 加 `borderMask: 0xf` 字段（§4） |
| `assets/scripts/puzzle/PuzzleBoard.ts` | `createPieces` 改共享 SpriteFrame + 共享 Material；新增 `recalcBorderMasks` + `applyPieceColor`（§7） |
| `assets/scripts/puzzle/PuzzleBoard.ts` | `mergeScan` 末尾追加两行调用（§8） |
| 场景 `puzzle.scene` | `PuzzleBoard` Inspector 新加字段 `Piece Material`，拖入 .mtl（§9） |

业务侧（slots / swap / 合并 / 拖拽 / 胜利 / inputLocked）= **零改动**。
