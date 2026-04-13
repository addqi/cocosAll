/** 所有敌人共享的资源路径 / 显示常量（不随敌人类型变化） */
export const enemyResConfig = {
    /** 探测圈纹理资源路径 */
    rangeTexture: 'ui/round',
    /** 溶解噪声纹理资源路径 */
    noiseTexture: 'shader/noise',
    /** 死亡溶解动画时长（秒） */
    dissolveTime: 0.8,
    /** 血条宽度（px） */
    hpBarWidth: 80,
    /** 血条高度（px） */
    hpBarHeight: 8,
} as const;
