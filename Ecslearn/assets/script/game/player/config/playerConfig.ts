/**
 * 玩家游玩配置
 *
 * 属性基础值见 player.json（由属性系统消费）
 * 此处存放动画、操控等运行时参数
 *
 * 动画路径相对于 resources 目录，不带后缀
 * 例: 图片实际位置 assets/resources/Archer/Archer_Idle.png → path 填 "Archer/Archer_Idle"
 */

/** 单条动画配置 */
export interface AnimEntry {
    /** sprite sheet 路径（旧模式，与 frameSize 配合切帧） */
    path?: string;
    /** 独立帧图片目录（新模式，目录内每张 PNG 为一帧，按文件名排序） */
    frameDir?: string;
    fps: number;
    loop: boolean;
}

/** 玩家公共配置（所有职业共享） */
export interface PlayerConfigData {
    frameSize: number;
    displayWidth: number;
    displayHeight: number;
    anims: Record<string, AnimEntry>;
    attackRange: number;
    rangeTexture: string;
    xpBase: number;
    xpGrowth: number;
    maxSkillSlots: number;
}

export const playerConfig: PlayerConfigData = {
    frameSize: 192,
    displayWidth: 200,
    displayHeight: 200,
    anims: {
        idle:  { frameDir: 'Archer/idle',  fps: 10, loop: true },
        run:   { frameDir: 'Archer/run',   fps: 12, loop: true },
        shoot: { frameDir: 'Archer/shoot', fps: 15, loop: false },
    },
    attackRange: 400,
    rangeTexture: 'ui/round',
    xpBase: 50,
    xpGrowth: 30,
    maxSkillSlots: 3,
};
