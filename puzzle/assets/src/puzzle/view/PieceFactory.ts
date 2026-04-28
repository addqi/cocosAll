import {
    Material, Node, Rect, Sprite, SpriteFrame, UITransform, Vec2,
} from 'cc';
import { PuzzlePiece } from '../PuzzlePiece';

/**
 * Piece 节点工厂。**两条路径产出的逻辑完全等价**——piece.row/col/groupId 一致，
 * 触摸事件挂法一致。差异只在视觉来源：
 *
 *   **08 路径**（pieceMaterial != null）
 *     所有块共用 sourceImage SpriteFrame + 共用 sharedMat。
 *     "显示哪 1/N" 由 frag 根据 sprite.color.g(=pieceId) 计算 UV 偏移。
 *     共享 → 真合批：100 块仍 1~2 DC。
 *
 *   **01 路径**（pieceMaterial == null）
 *     每块克隆 SpriteFrame、改 rect 指向 1/N 像素区域。
 *     默认 sprite material（同 texture）下也合批，3×3~6×6 完全够用。
 *     用户没在编辑器做 .mtl 时自动走这条——视觉简陋但功能完整。
 */

export interface PieceFactoryConfig {
    sourceImage: SpriteFrame;
    /** null 走 01 路径切片，非 null 走 08 路径共享 + shader */
    pieceMaterial: Material | null;
    pieceCount: number;
    pieceGrid: number;
    pieceDisplay: number;
    onTouchHandlersBind: (node: Node) => void;
}

export interface CreatedPiece {
    node: Node;
    sprite: Sprite;
    piece: PuzzlePiece;
}

/** 主入口：双路径派发 */
export function createPieces(layer: Node, config: PieceFactoryConfig): CreatedPiece[] {
    if (config.pieceMaterial) {
        console.log(
            `[PuzzleBoard] 🟢 走 08 路径——共享 SpriteFrame + customMaterial（shader 自绘）。` +
            ` material=${config.pieceMaterial.name || '(unnamed)'}`,
        );
        return _createShared(layer, config);
    }
    console.log('[PuzzleBoard] 🟡 走 01 路径——每块切 SpriteFrame.rect（无 shader）。');
    return _createSliced(layer, config);
}

/**
 * [08 路径] 共享 SpriteFrame + 共享 Material。
 *
 * 关键纪律——任何一条破了都失批：
 *   1. 所有 sprite 的 spriteFrame === sourceImage（同对象引用，不是 clone）
 *   2. 所有 sprite 的 customMaterial === sharedMat（同实例，不要在循环里 new Material）
 *   3. gridDim uniform 只对 sharedMat setProperty 一次（共享 → 一次写全部生效）
 *
 * sprite.color 写 (borderMask, pieceId, 0, 255)——**顶点属性，不破坏合批**。
 * 边框和 pieceId 都通过这条免费旁路传，shader 在 frag 里 floor(c*255+0.5) 还原。
 */
function _createShared(layer: Node, config: PieceFactoryConfig): CreatedPiece[] {
    const { sourceImage, pieceMaterial, pieceCount, pieceGrid, pieceDisplay } = config;
    const sharedMat = pieceMaterial!;
    // gridDim 是 vec2——必须传 Vec2 实例，传裸数组在 3.8 上会被默默忽略。
    sharedMat.setProperty('gridDim', new Vec2(pieceGrid, pieceGrid));

    const result: CreatedPiece[] = [];
    for (let pid = 0; pid < pieceCount; pid++) {
        const r = Math.floor(pid / pieceGrid);
        const c = pid % pieceGrid;

        const node = new Node(`Piece_${pid}`);
        layer.addChild(node);

        const ut = node.addComponent(UITransform);
        const sp = node.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.type = Sprite.Type.SIMPLE;
        sp.spriteFrame = sourceImage;          // ← 整张大图，所有块共享
        sp.customMaterial = sharedMat;         // ← 共享自定义 effect material
        ut.setContentSize(pieceDisplay, pieceDisplay);

        const piece = node.addComponent(PuzzlePiece);
        piece.pieceId = pid;
        piece.row = r;
        piece.col = c;
        piece.groupId = pid;
        piece.borderMask = 0xf;

        // 注意：**不**在这里挂 Sorting2D——拖动开始时 DragSorter.setDragLayering
        // 才按需 add，触摸结束 clearDragLayering 摘除。详见 DragSorter.ts 顶部说明。

        config.onTouchHandlersBind(node);
        result.push({ node, sprite: sp, piece });
    }
    return result;
}

/**
 * [01 路径] 每块克隆 SpriteFrame、改 rect。fallback 用。
 *
 * **rect.y 方向血泪坑**：Cocos 3.8.x 通过 BundleManager 动态加载的 SpriteFrame，
 * `rect` 走的是**像素坐标 / 左上原点 / y 向下**——rect.y=0 对应源图**最上一行**。
 *   所以 r * cellSize 直接用，r=0 → rect.y=0 → 源图上半 → piece.row=0 一致。
 *
 * 如果换引擎/导入设置后视觉变成上下颠倒，把下面 `r * cellSize` 改回
 * `(pieceGrid - 1 - r) * cellSize`。
 */
function _createSliced(layer: Node, config: PieceFactoryConfig): CreatedPiece[] {
    const { sourceImage: sf, pieceCount, pieceGrid, pieceDisplay } = config;
    const tex = sf.texture;
    const sourceMin = Math.min(sf.rect.width, sf.rect.height);
    const cellSize = Math.floor(sourceMin / pieceGrid);
    const offsetX = sf.rect.x + (sf.rect.width - cellSize * pieceGrid) / 2;
    const offsetY = sf.rect.y + (sf.rect.height - cellSize * pieceGrid) / 2;

    const result: CreatedPiece[] = [];
    for (let pid = 0; pid < pieceCount; pid++) {
        const r = Math.floor(pid / pieceGrid);
        const c = pid % pieceGrid;

        const node = new Node(`Piece_${pid}`);
        layer.addChild(node);

        const ut = node.addComponent(UITransform);

        const frame = new SpriteFrame();
        frame.texture = tex;
        frame.rect = new Rect(
            offsetX + c * cellSize,
            offsetY + r * cellSize,
            cellSize,
            cellSize,
        );

        // 顺序极其讲究：必须 sizeMode=CUSTOM **先**于赋 spriteFrame，
        // 否则 TRIMMED 默认会在赋值瞬间把节点 contentSize 改成 frame.rect 大小，
        // 后果是块比 pieceDisplay 大 → 互相重叠。末尾再 setContentSize 兜底。
        const sp = node.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.type = Sprite.Type.SIMPLE;
        sp.spriteFrame = frame;
        ut.setContentSize(pieceDisplay, pieceDisplay);

        const piece = node.addComponent(PuzzlePiece);
        piece.pieceId = pid;
        piece.row = r;
        piece.col = c;
        piece.groupId = pid;

        // 01 路径**不需要** Sorting2D——piece 用默认 sprite material，walk-order
        // 已能正确分层。setDragLayering(useShader=false) 会跳过本路径。

        config.onTouchHandlersBind(node);
        result.push({ node, sprite: sp, piece });
    }
    return result;
}
