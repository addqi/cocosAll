import { _decorator, Component } from 'cc';

const { ccclass } = _decorator;

/**
 * 拼图碎片（教程 01 节起）。
 *
 * 设计原则：纯数据袋，无方法。所有逻辑都在 PuzzleBoard 这个统一控制器里写。
 *
 * 字段含义（看 docs/01-一张图切成NxN碎片.md 第 3 节）：
 *   - pieceId：身份 + 正确槽位号（双重身份，永不变）
 *   - row / col：正确行列（pid / grid、pid % grid）
 *   - groupId：所在组。01 节 = pieceId（每块一组）；05 节并查集会改写
 */
@ccclass('PuzzlePiece')
export class PuzzlePiece extends Component {
    pieceId: number = -1;
    row: number = -1;
    col: number = -1;
    groupId: number = -1;

    /**
     * [08 节] 边框可见位掩码：bit0=上, bit1=右, bit2=下, bit3=左。
     * 1 = 显示边框，0 = 不显示（已与同组邻块贴合）。
     *
     * 派生量——和 position 同性质：每次 mergeScan 末尾由 PuzzleBoard
     * 全量重算。01~07 节路径不会用它（双路径下 pieceMaterial=null 时只是占位）。
     */
    borderMask: number = 0xf;
}
