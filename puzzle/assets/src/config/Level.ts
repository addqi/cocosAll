/**
 * 关卡 = 一张图。仅此而已。
 *
 * 没有 json，没有 manifest，没有"添加关卡需要改代码"。
 * 只要把图扔进 game-bundle/images/，启动时 BundleManager 扫描即得。
 */
export interface LevelEntry {
    /** 唯一标识，等同图片文件名（不含扩展名） */
    id: string;
    /** 显示名，等同 id（如需中文名可后续在 game-bundle 里建一个 i18n.json） */
    name: string;
    /** game-bundle 内 SpriteFrame 路径，如 'images/liuying1' */
    imagePath: string;
}

/**
 * 难度档位 = 切成 N×N。从易到难循环。
 *
 * 不做枚举，直接用整数数组——拼图算法里 gridSize 就是个 number，没必要包一层。
 */
export const DIFFICULTIES: readonly number[] = [3, 4, 5, 6, 8, 10];

/** 默认难度索引，对应 3×3 */
export const DEFAULT_DIFFICULTY_INDEX = 0;

/**
 * 拼图占屏短边的比例。
 *
 * 0.8 = 两侧各留 10% 边距。**关键作用：曲面屏边缘可能触摸不灵**——
 * 必须用比例边距而不是固定 px，不同分辨率才都能留出可操作区。
 *
 * 公式：boardSize = floor(min(屏宽, 屏高) × BOARD_FILL_RATIO / grid) × grid
 * 向 grid 取整下界是为了避免 1px 缝隙（boardSize 必须能被 grid 整除）。
 */
export const BOARD_FILL_RATIO = 0.8;
