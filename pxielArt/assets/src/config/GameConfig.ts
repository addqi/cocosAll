/**
 * 全局数值配置 — 纯数据，零依赖
 */
export const GameConfig = {

    // ==================== 基础尺寸 ====================
    /** 单格在屏幕上的显示边长（像素） */
    defaultCellDisplaySize: 20,
    viewportWidth: 960,
    viewportHeight: 1320,
    gridCols: 120,
    gridRows: 120,

    // ==================== 视口/缩放 ====================
    maxScale: 1,
    viewportPadding: 200,
    /** WASD/HJKL 平移视口（像素/秒） */
    viewportArrowPanSpeed: 600,
    viewportZoomStep: 0.1,
    /** 整盘适配屏幕时，相对「刚好塞进视口」的缩放比例 */
    viewportAutoFitScreenRatio: 0.9,
    /** 最大放大：较短边约可见此数量的格子 */
    viewportMaxZoomVisibleCells: 8,
    /** scale *= (1 ± 此值×dt) */
    viewportZoomSpeedPerSecond: 2,
    viewportAutoFit: true,
    /** 橡皮筋阻力 */
    viewportRubberBandFactor: 0.3,
    /** 松手后弹回合法范围的时长（秒） */
    viewportSnapBackDuration: 0.25,
    viewportDetailSmoothLowT: 0,
    viewportDetailSmoothHighT: 0.5,
    /** 纹理上传前 alpha 量化档位数 */
    viewportZoomFadeAlphaSteps: 20,

    // ==================== 输入/绘制 ====================
    /** 错误格吸附时每边放大量（屏幕 px） */
    correctCellExpandPx: 25,
    paintSnapRadiusPx: 40,
    /** 单指平移判定 moved 的阈值 */
    moveThreshold: 5,

    // ==================== 棋盘颜色（0xRRGGBB） ====================
    boardGrayMinColor: 0x868686,
    boardFadeColor: 0xffffff,
    selectedCellColor: 0x858585,
    selectedCellFadeColor: 0xb9b9b9,

    // ==================== 调色板 ====================
    paletteItemWidth: 100,
    paletteItemHeight: 100,
    paletteItemSpacing: 12,
    palettePadding: 14,
    paletteLabelFontSize: 28,
    /** 选中描边颜色（0xRRGGBB） */
    paletteRingColor: 0x303030,
    paletteRingOutset: 4,
    paletteItemRootOutset: 6,
    paletteUseContrastLabel: true,
    /** 序号固定色（仅当 useContrastLabel=false） */
    paletteLabelFixedColor: 0xffffff,
    /** 每页列数 */
    paletteColumnsPerPage: 5,
    /** 每页行数 */
    paletteRowsPerPage: 2,
    /** 翻页滑动阈值 (px) */
    paletteSwipeThreshold: 50,
    /** 翻页吸附速度 (px/s) */
    paletteSnapSpeed: 3000,
    /** 默认显示页（0=道具, 1=第一页色块） */
    paletteDefaultPage: 1,

    // ==================== 结算界面 ====================
    /** 白色面板渐显时长（秒） */
    settlementFadeInDur: 0.3,
    /** fade-in 完成后到回放开始的延迟（秒） */
    settlementReplayStartDelay: 0.3,
    /** 回放总时长（秒） */
    settlementReplayDur: 1.8,
    /** 回放图占屏幕短边比例 */
    settlementImageScale: 0.85,
    /** 回放完成后按钮淡入延迟（秒） */
    settlementActionFadeInDelay: 0.5,
    /** 回放完成后按钮淡入时长（秒） */
    settlementActionFadeInDur: 0.3,
} as const;
