import { BoardData } from '../data/BoardData';
import { CellBrushEntry } from '../../types/types';

/**
 * BFS FloodFill — 从种子格出发，收集所有四连通、同 brushIndex、未填充的格子。
 *
 * @param seedRow     种子行
 * @param seedCol     种子列
 * @param brushIndex  目标颜色编号
 * @param boardData   盘面数据（取 getBrushIndex）
 * @param isFilled    判定格子是否已填充的回调
 * @returns           待填充的 CellBrushEntry 数组（含种子自身）
 */
export function floodFill(
    seedRow: number,
    seedCol: number,
    brushIndex: number,
    boardData: BoardData,
    isFilled: (row: number, col: number) => boolean,
): CellBrushEntry[] {
    const rows = boardData.gridRows;
    const cols = boardData.gridCols;
    if (seedRow < 0 || seedRow >= rows || seedCol < 0 || seedCol >= cols) return [];
    if (boardData.getBrushIndex(seedRow, seedCol) !== brushIndex) return [];
    if (isFilled(seedRow, seedCol)) return [];

    const visited = new Uint8Array(rows * cols);
    const result: CellBrushEntry[] = [];
    const queue: number[] = [seedRow * cols + seedCol];
    visited[queue[0]] = 1;

    const DR = [-1, 1, 0, 0];
    const DC = [0, 0, -1, 1];

    while (queue.length > 0) {
        const idx = queue.shift()!;
        const r = (idx / cols) | 0;
        const c = idx % cols;
        result.push({ row: r, col: c, brushIndex });

        for (let d = 0; d < 4; d++) {
            const nr = r + DR[d];
            const nc = c + DC[d];
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
            const ni = nr * cols + nc;
            if (visited[ni]) continue;
            if (boardData.getBrushIndex(nr, nc) !== brushIndex) continue;
            if (isFilled(nr, nc)) continue;
            visited[ni] = 1;
            queue.push(ni);
        }
    }
    return result;
}
