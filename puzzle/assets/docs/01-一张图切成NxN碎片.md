# 01 · 一张图切成 N×N 碎片

> **目标**：把 00 节那张完整图切成 3×3 = 9 个独立 Node，每块按"正确位置"摆好。屏幕看起来跟整张图一样，但**每块都能单独操作**。
>
> 完成后你的核心数据结构 `slots: number[]` 也成型——后续所有节都基于这一个数组玩。

---

## 起点回顾

00 节末态：

- 场景层级：`Canvas → PuzzleRoot[PuzzleBoard] → ImageLayer → FullImage[Sprite]`
- `PuzzleBoard` 类只有一个 `renderFullImage()` 方法，渲染整图。
- 拖了一张 SpriteFrame 进 Inspector。

本节要做的：

- 删掉"整图直接渲染"逻辑（保留代码注释，作为对比）。
- 加 `PieceLayer` 子节点，9 块 Sprite 挂在它下面。
- 引入数据结构 `slots: number[]` 长度 9。
- 每块按 `(row, col)` 算位置。

---

## 1. 关键概念：SpriteFrame.rect

Cocos 的 `SpriteFrame` 描述的是 "某张 Texture 上的一块矩形区域"。它有这些字段：

```typescript
spriteFrame.texture   // 底层 Texture2D
spriteFrame.rect      // Rect: { x, y, width, height }，单位像素
```

如果我们克隆出 9 个 SpriteFrame，每个 `rect` 不同（指向源图的不同九分之一），就能在 9 个 Sprite 上分别渲染源图的 9 个区域——**不需要切图工具**。

```typescript
const cloned = SpriteFrame.createWithImage(sourceFrame.texture);
cloned.rect = new Rect(x, y, w, h); // 想切哪一块写哪一块
```

**注意**：Cocos 3.8 里 SpriteFrame 不能直接 new，要用 `SpriteFrame.createWithImage(texture)` 这种工厂方法。后面代码会用。

---

## 2. 数据结构 slots：拼图玩法的"真相源"

我们用一个长度 9 的数组：

```typescript
slots: number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8];
```

读法：**`slots[槽位号] = 那个槽位现在放着哪一块的 ID`**。

- `slots[0] = 0` → 0 号槽（左上）放着 0 号块。
- `slots[4] = 7` → 4 号槽（中央）放着 7 号块（被人挪过去了）。

**slots 是整个拼图的真相源**：

- 哪一块在哪一个槽 → 看 slots
- 哪一个槽里是哪一块 → 看 slots
- 拼图是否完成 → `slots[i] === i for all i`

**约定**：

- "槽位 (slot)" = 屏幕上的一个固定位置（左上、中上、右上...），永远不动。
- "块 (piece)" = 一个图片碎片，会从一个槽搬到另一个槽。
- "槽位号" = 0..8，`row = floor(idx / 3)`、`col = idx % 3`。
- "块 ID (pieceId)" = 0..8，每块的"出生时所在的槽位号" = "正确位置"。所以 0 号块的"正确槽" = 0 号槽。

这个映射很重要，后面所有节都靠它。**记住：slots 数组的下标是槽位、值是 pieceId**。

---

## 3. 单块的 PuzzlePiece 组件

新建 `assets/scripts/puzzle/PuzzlePiece.ts`：

```typescript
import { _decorator, Component, Sprite, UITransform } from 'cc';
const { ccclass } = _decorator;

/**
 * 拼图碎片（01 节）
 *
 * 每块是一个独立 Node，挂这个组件 + Sprite + UITransform。
 * 字段都是简单数字，方便 03 节起拖拽时直接读写。
 */
@ccclass('PuzzlePiece')
export class PuzzlePiece extends Component {
    /** 这块的"出生槽位号"（0..8）= 正确位置。永不改。 */
    pieceId: number = -1;

    /** 正确行：Math.floor(pieceId / pieceGrid) */
    row: number = -1;

    /** 正确列：pieceId % pieceGrid */
    col: number = -1;

    /**
     * 所在组 ID。01 节 = pieceId（每块自成一组）；
     * 05 节并查集会改写它，相邻拼对的会合到同一组。
     */
    groupId: number = -1;
}
```

**没写任何方法，只有 4 个字段**。原因：

- **Cocos 的 Component 模式 ≠ ECS**：但拼图玩法**适合**用类 ECS 的方式管数据——把 piece 当成"数据袋"。
- 后续节的逻辑大都写在 `PuzzleBoard`（统一控制器）里，PuzzlePiece 只承载状态。这样**全局逻辑集中在一处**，对教学友好。

**生产版** 也许会把 drag 逻辑放到 PuzzlePiece.onTouchStart 里。但教学版优先"少跳文件"。

---

## 4. 改写 PuzzleBoard：切图 + 摆位

打开 `PuzzleBoard.ts`，**整个文件改成这样**：

```typescript
import { _decorator, Component, Node, Sprite, SpriteFrame, UITransform, Rect } from 'cc';
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

    /** 拼图块的总数（派生：pieceGrid²） */
    get pieceCount(): number {
        return this.pieceGrid * this.pieceGrid;
    }

    /** 单块上屏边长（派生：boardSize / pieceGrid） */
    get pieceDisplay(): number {
        return this.boardSize / this.pieceGrid;
    }

    /**
     * 槽位数组。slots[j] = pieceId，表示 j 号槽现在放的是哪一块。
     * 长度固定 = pieceCount。本节初始 = [0..pieceCount-1]（每块在正确位置）。
     */
    private slots: number[] = [];

    /** pieceId → Node 静态索引。建好后再不变，方便后续按 ID 找 Node。 */
    private pieceNodes: Node[] = [];

    onLoad() {
        if (!this.sourceImage) {
            console.error('[PuzzleBoard] 源图未设置');
            return;
        }
        this.initSlots();
        this.createPieces();
        this.layoutAllPieces();
    }

    /** 初始化 slots 为 [0, 1, 2, ..., pieceCount-1] */
    private initSlots(): void {
        this.slots = [];
        for (let i = 0; i < this.pieceCount; i++) {
            this.slots.push(i);
        }
    }

    /** 创建 pieceCount 个 Node，每块切一个独立 SpriteFrame */
    private createPieces(): void {
        const pieceLayer = this.node.getChildByName('PieceLayer')!;
        const sourceFrame = this.sourceImage!;
        const sourceTex = sourceFrame.texture;

        // 源图按短边裁正方形，避免长方形被拉伸
        const sourceMin = Math.min(sourceFrame.rect.width, sourceFrame.rect.height);
        const cellSize = Math.floor(sourceMin / this.pieceGrid);
        const offsetX = sourceFrame.rect.x + (sourceFrame.rect.width - cellSize * this.pieceGrid) / 2;
        const offsetY = sourceFrame.rect.y + (sourceFrame.rect.height - cellSize * this.pieceGrid) / 2;

        this.pieceNodes = [];
        for (let pid = 0; pid < this.pieceCount; pid++) {
            const r = Math.floor(pid / this.pieceGrid);
            const c = pid % this.pieceGrid;

            const node = new Node(`Piece_${pid}`);
            node.parent = pieceLayer;

            const transform = node.addComponent(UITransform);

            // 关键：新建 SpriteFrame，texture 指向源图，rect 指向 1/9 区域。
            // Creator 3.x 的 SpriteFrame.createWithImage 接受 ImageAsset，
            // 这里我们已经有 Texture2D（sourceFrame.texture），用 new SpriteFrame() 更直接。
            const frame = new SpriteFrame();
            frame.texture = sourceTex;
            frame.rect = new Rect(
                offsetX + c * cellSize,
                offsetY + r * cellSize, // Cocos 3.8.x 实测：rect 走"像素坐标 y 向下"，r 直接用
                cellSize,
                cellSize,
            );

            // ⚠️ 顺序极其讲究——下面三行不能换：
            //   1. addComponent(Sprite) 后默认 sizeMode = TRIMMED
            //   2. 一旦赋 spriteFrame，TRIMMED 会立刻把节点 contentSize 改写成 frame.rect 的尺寸（cellSize）
            //   3. 之后再设 CUSTOM 已经晚了——contentSize 已被污染
            // 必须先把 sizeMode 切到 CUSTOM，再赋 spriteFrame。
            const sprite = node.addComponent(Sprite);
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.type = Sprite.Type.SIMPLE;
            sprite.spriteFrame = frame;
            // 末尾再兜一次 contentSize——任何引擎默认行为都不能污染我们要的尺寸。
            transform.setContentSize(this.pieceDisplay, this.pieceDisplay);

            const piece = node.addComponent(PuzzlePiece);
            piece.pieceId = pid;
            piece.row = r;
            piece.col = c;
            piece.groupId = pid;

            this.pieceNodes.push(node);
        }
    }

    /** 按当前 slots 重新摆所有块的位置 */
    private layoutAllPieces(): void {
        for (let pid = 0; pid < this.pieceCount; pid++) {
            const slotIdx = this.slots.indexOf(pid);
            const { x, y } = this.slotToPosition(slotIdx);
            this.pieceNodes[pid].setPosition(x, y, 0);
        }
    }

    /** 槽位下标 → Board-local (x, y)。槽 4 = 中心 = (0, 0)。 */
    private slotToPosition(slotIdx: number): { x: number; y: number } {
        const sr = Math.floor(slotIdx / this.pieceGrid);
        const sc = slotIdx % this.pieceGrid;
        const center = (this.pieceGrid - 1) / 2;
        return {
            x: (sc - center) * this.pieceDisplay,
            y: (center - sr) * this.pieceDisplay,
        };
    }
}
```

---

## 5. 场景调整

00 节里挂的 `ImageLayer` 不再用了。回 Cocos Creator：

1. 在 `PuzzleRoot` 下**新建空节点 `PieceLayer`**。
2. 删除 `ImageLayer` 节点（或留着，本节不引用就行）。
3. PuzzleRoot 上的 `PuzzleBoard` 组件 Inspector 里多了两个字段：
   - `Board Size`：改成 600（小一点，给 03 节的拖动留余地）。
   - `Piece Grid`：保持 3。

层级树：

```
Scene
└── Canvas
    └── PuzzleRoot      [PuzzleBoard]
        └── PieceLayer
```

保存。

---

## 6. 跑起来

▶ 预览。

**预期**：屏幕中央显示一个 3×3 网格，每格是源图的 1/9，**拼起来跟整图一样**（因为 slots 还是 `[0..8]`，每块都在正确位置）。

**控制台预期**：无输出（脚本无 console.log）。

**不正常的信号**：

- **9 块全是同一张图（整图缩小）**：`SpriteFrame.rect` 没改成功。检查 `frame.rect = new Rect(...)` 那一行有没有跑通。**Creator 3.8.4 之前**有时候 SpriteFrame 共享 Texture 但忽略 rect — 解决：用 `frame.reset({ atlasUuid: '', texture: sourceTex, rect: new Rect(...) })` 这种全字段 reset 法。
- **9 块互相重叠、每块比应有的大**（血泪教训）：你大概率把 `sprite.spriteFrame = frame` 写在 `sprite.sizeMode = CUSTOM` **之前**了。Cocos 的 `Sprite.addComponent` 默认 `sizeMode = TRIMMED`——赋 spriteFrame 那一刻它会**立即把节点 contentSize 改写成 frame.rect 的尺寸**（cellSize，而不是你想要的 pieceDisplay）。当 cellSize > pieceDisplay 时（源图 > boardSize），每块就比间距大，互相挤进相邻块的位置 → 视觉上重叠。**修法**：先 `sizeMode = CUSTOM` 再 `spriteFrame = frame`，并在最后 `transform.setContentSize(pieceDisplay, pieceDisplay)` 兜底一次。
- **9 块顺序错乱（左上变右上、上下倒置）**：`r * cellSize` 那段。Cocos 3.8.x 通过 BundleManager 动态加载 sprite-frame 时，`rect` 实测走"像素坐标 / 左上原点 / y 向下"——r 直接乘 cellSize 即可。**但**如果你换了引擎版本/导入设置，引擎给的 rect 变成了"UV 左下原点 / y 向上"，r=0 取小 rect.y 就反了——这时改成 `(pieceGrid - 1 - r) * cellSize` 把行号倒过来。**判定方法**：先按 `r * cellSize` 跑，开局看屏幕——视觉上行 = 源图上行就对了；如果上下镜像，加翻转。
- **9 块之间有缝**：`pieceDisplay` 算出来不是整数（比如 boardSize=601, pieceGrid=3 → 200.33）。建议 boardSize 选 pieceGrid 的整数倍（600/300/900 都行）。
- **图片被拉伸成长方形**：`UITransform.setContentSize` 设的不是方。检查那行是不是 `pieceDisplay, pieceDisplay`。
- **看不到拼图块（白屏）**：`PieceLayer` 不存在（getChildByName 拿到 null，下一行 `!` 会让 TS 不报错但 runtime 崩）。建场景时新建 PieceLayer。
- **`SpriteFrame.createWithImage is not a function`**：你的 Cocos 版本太老（< 3.8）。教程要求 3.8+。

---

## 7. 复盘：这节教了什么

**1. SpriteFrame 是"切图视图"**

最大的认知突破：**一张 Texture，无数个 SpriteFrame**。Cocos 3.x 的 SpriteFrame 通过 `rect / texture` 两个字段，把"一张大图切成多块"变成纯运行时操作。**不需要 Photoshop**——只要数学算对每块的 rect。

这个能力对所有切图类游戏（拼图、消除、卡牌） 都是基础。

**2. slots 是真相源**

整个游戏的位置真相全在 `slots: number[]` 这一个数组里：

- 想知道"7 号块在哪个槽" → `slots.indexOf(7)`
- 想知道"3 号槽里是哪块" → `slots[3]`
- 想知道"拼图完成没" → `slots[i] === i for all i`

**位置是 slots 的投影**：每块 Node 的 `position` = `slotToPosition(slots.indexOf(pieceId))`。**Position 永远从 slots 推导，不直接编辑**——03 节起拖拽时只在"瞬态偏移"期间直接动 position，松手立刻回归到 slots 的投影。

这种"唯一真相 + 投影显示" 是游戏开发里**最稳的状态管理模式**：bug 只可能在 slots 算错时出现，不会"position 跟 slots 不同步" 这种鬼魅 bug。

**3. pieceId 既是身份也是正确位置**

`pieceId` 这个字段一身两用：

- **身份**：0 号块永远是 0 号块，不会变。
- **正确位置**：0 号块的"正确槽位号"也是 0。`pieceId` 既标识"这是哪块"，又标识"这块该回哪去"。

为什么这么设计？因为"哪个槽是它的正确位置"是**永不改的常量**——既然如此，不必另存一个字段（比如 `correctSlot: number`），直接复用 pieceId 即可。这是 Linus 说的"**好品味是消除特殊情况**"——少一个字段、少一个不变量要维护。

**4. pieceNodes 静态索引**

`pieceNodes: Node[]`，下标是 pieceId。建好后再不变。

为什么需要这个：后面 04 节起的 swap 需要"按 pieceId 找 Node"——`this.pieceNodes[pid]` 直接 O(1) 拿到。**不需要 `node.getChildren().find(...)` 这种 O(N) 遍历**。

这是"好数据结构胜过聪明代码"的小例子。

---

## 8. 常见坑

- **SpriteFrame 共享底层 Texture 但 rect 互不影响**：克隆出来的 9 个 SpriteFrame **共享同一张 Texture2D**，但各自的 `rect` 字段独立。改一个的 rect 不会影响其他——这是 Cocos 设计的。利用这个特性，9 块碎片实际只占用一张 Texture 的 GPU 内存。
- **rect 单位是源图像素，不是上屏像素**：源图 600×600，pieceGrid=3 → rect 是 200×200（源图像素）。**上屏尺寸由 UITransform.setContentSize 决定**——不一致也没事，Sprite 自动缩放。
- **rect.y 方向是引擎/导入设置敏感的**：上面代码用 `r * cellSize`——Cocos 3.8.x + BundleManager 动态加载 sprite-frame 实测 rect 是"像素坐标 y 向下"——r=0 取小 rect.y 对应源图上行，跟 piece.row=0 直觉一致。**如果你的引擎版本不一样**（更老的版本可能默认 UV y 向上、或者贴图开了 flipY），跑出来上下颠倒——把 `r * cellSize` 改成 `(pieceGrid - 1 - r) * cellSize` 即可。**判定信号**：开局没洗牌（slots[i]=i）时屏幕看起来不是原图、是上下镜像 → 翻方向。这个坑曾让一整局拼图视觉拼对但 misplaced=6——切片方向反了，后续 mergeScan 的 Rule B 用 piece.row 判邻接，跟视觉对不上，胜利永远触发不了。
- **pieceGrid 改大就出框**：boardSize=600, pieceGrid=10 → pieceDisplay=60。10×10=100 块，每块 60×60，显示上没问题。但 boardSize=600, pieceGrid=20 → pieceDisplay=30——块太小看不清细节。**建议 pieceGrid 在 3-8 之间**，再大就改 boardSize 一起放大。
- **slots 长度 ≠ pieceCount**：理论不可能，因为我们 `initSlots` 用的就是 pieceCount。但**未来加自定义难度时**忘改 slots 长度，会导致 `slots.indexOf` 偶尔返回 -1，块"消失"。
- **PuzzlePiece 没挂载 = `node.getComponent(PuzzlePiece)` 拿不到**：忘了在 createPieces 里 `node.addComponent(PuzzlePiece)`，后续节的"找同组" 全部失效。本节代码里有这一行，复制时不要漏。

---

## 9. 下一节预告

9 块都在正确位置，看起来跟整图一样——还不是"拼图游戏"。**02 节**：洗牌！

**02 节内容预告**：

- **Fisher-Yates 算法**：等概率打乱 9 个数。10 行 TS。
- **散度阈值**：避免"洗完还像没洗"——要求至少 60% 的块不在原位。
- **`layoutAllPieces` 复用**：洗牌只改 `slots`，layout 自动跟着变（"位置是 slots 的投影"）。

完成后你能看到：开局 9 块**乱七八糟**地摆着，能认出是同一张图、但不再是"拼好"的状态。**这才像拼图游戏的开始**。
