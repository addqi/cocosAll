/**
 * 全局数值 — 视口/缩放/平移与 G15_FBase_GameConfig 对齐（keyboardZoomSpeed、keyboardPanSpeed、viewportPadding、correctCellExpandPx 等）
 */
export const GameConfig = {
    /** 单格在屏幕上的显示边长（像素） */
    defaultCellDisplaySize: 20,

    viewportWidth: 960,
    viewportHeight: 1320,

    gridCols: 120,
    gridRows: 120,

    maxScale: 1,
    viewportPadding: 200,

    /** WASD/HJKL 平移视口（像素/秒）— 对齐 G15 keyboardPanSpeed */
    viewportArrowPanSpeed: 600,

    /** 错误格上四方向「正确格」吸附时每边放大量（屏幕 px），对齐 G15 correctCellExpandPx */
    correctCellExpandPx: 25,

    paintSnapRadiusPx: 40,
    /** 单指平移/判定 moved：对齐 G15 TouchMoveLogic */
    moveThreshold: 5,

    boardGrayMinColor: 0x868686,
    /** 放大时盘面灰度渐变目标色（G15 boardFadeColor） */
    boardFadeColor: 0xffffff,
    /** 当前画笔匹配格基础色（G15 selectedCellColor） */
    selectedCellColor: 0x858585,
    /** 当前画笔匹配格放大后目标色（G15 selectedCellFadeColor） */
    selectedCellFadeColor: 0xb9b9b9,

    /** 视口缩放 — 与 G15 键盘缩放同量级 */
    viewportZoomStep: 0.1,
    /** 整盘适配屏幕时，相对「刚好塞进视口」的缩放比例（略小于 1 留边） */
    viewportAutoFitScreenRatio: 0.9,
    /** 最大放大：较短边约可见此数量的格子（再放大则被钳制） */
    viewportMaxZoomVisibleCells: 8,
    /** 对齐 G15 keyboardZoomSpeed：scale *= (1 ± 此值×dt) */
    viewportZoomSpeedPerSecond: 2,
    /** 启动时自动适配整盘可见 */
    viewportAutoFit: true,

    /**
     * ZoomFade：在 (minScale→maxScale) 归一化进度 t∈[0,1] 上做 smoothstep。
     * pxielArt 的 content.scale 量纲随盘面变化，不可用 G15 固定 0.7；改用 t 区间。
     */
    viewportDetailSmoothLowT: 0,
    /** t 达到此值时细节 alpha≈1（建议 <1，留余量到 maxScale） */
    viewportDetailSmoothHighT: 0.5,
    /** G15：纹理上传前 alpha 量化档位数，减少 Board 重刷 */
    viewportZoomFadeAlphaSteps: 20,
} as const;
