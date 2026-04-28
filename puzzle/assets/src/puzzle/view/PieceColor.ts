import { Color, Sprite } from 'cc';

/**
 * Piece sprite.color 编码——把 (borderMask, pieceId) 顶点色旁路传给 shader。
 *
 *   R 字节 = borderMask 低 4 位（高 4 位备用）
 *   G 字节 = pieceId（0~255，pieceGrid <= 16 时够用）
 *   B 字节 = 备用
 *   A     = 255 不动（透明度走 node opacity / Sprite UIOpacity）
 *
 * **顶点属性，不破坏合批**——这条免费旁路就是为了让 shared material 路径
 * 仍然能给每块传 per-piece 数据。
 *
 * 仅 08 路径（pieceMaterial != null）调——01 路径下 sprite 用默认 material，
 * 写 color 等于"整块染色"，反而把图染歪。调用方守卫一行 `if (!pieceMaterial) return`。
 */
export function applyPieceColors(
    sprites: readonly Sprite[],
    borderMasks: readonly number[],
): void {
    for (let pid = 0; pid < sprites.length; pid++) {
        const rByte = borderMasks[pid] & 0xf;
        sprites[pid].color = new Color(rByte, pid & 0xff, 0, 255);
    }
}
