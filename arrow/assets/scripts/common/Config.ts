/**
 * 全局数值配置。所有"魔数"都进这里，绝对不在业务代码里写 50 / 100 这种。
 * 对应 G3_FBase 里的多个 ConfigAtom（PointConfig / ArrowConfig / ...）。
 */
export const Config = {
    /** 格子之间的距离（像素） */
    gap: 100,
    /** 点的大小（像素） */
    pointSize: 12,
    /** 箭头线宽（像素） */
    arrowLineWidth: 10,
    /** 箭头头部大小（像素） */
    arrowHeadSize: 24,
} as const;