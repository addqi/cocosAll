/**
 * 纯数据类型 — 配置层专用
 *
 * 配置层只允许依赖此文件的类型，不允许反向 import game/* 实现类型。
 */

export interface PropertyBaseConfig {
    [attrId: string]: number;
}

export interface EnemyOverrides {
    frameSize?: number;
    displayWidth?: number;
    displayHeight?: number;
    anims?: Record<string, { path?: string; frameDir?: string; fps: number; loop: boolean }>;
    attackRange?: number;
    xpReward?: number;
}
