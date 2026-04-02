/** 格子位置（行列坐标） */
export interface CellPosition {
    row: number;
    col: number;
}

/** 格子画刷条目：标识某个格子及其对应的画笔索引 */
export interface CellBrushEntry {
    row: number;
    col: number;
    brushIndex: number;
}

/** 单次涂色记录（含匹配结果） */
export interface PaintEntry {
    row: number;
    col: number;
    brushIndex: number;
    /** 涂的颜色是否与正确答案匹配 */
    matched: boolean;
}

/** 谜题原始数据（从 JSON 加载） */
export interface PuzzleData {
    /** 网格边长（正方形） */
    gridSize: number;
    /** 调色板 hex 字符串数组，如 ['#ff0000', '#00ff00', ...] */
    palette: string[];
    /** RLE 编码的像素数据，格式: "3,5:2,7" → [3,5,5,7] */
    pixels: string;
}