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
    path: string;
    fps: number;
    loop: boolean;
}

/** 玩家配置结构 */
export interface PlayerConfigData {
    /** 动画帧尺寸（源图每帧的像素宽高） */
    frameSize: number;
    /** 显示尺寸（节点实际渲染宽高） */
    displayWidth: number;
    displayHeight: number;
    /** 动画定义表，key 与 EPlayerAnim 枚举值一致 */
    anims: Record<string, AnimEntry>;
}

export const playerConfig: PlayerConfigData = {
    frameSize: 192,
    displayWidth: 200,
    displayHeight: 200,
    anims: {
        idle:  { path: 'Archer/Archer_Idle',  fps: 10, loop: true },
        run:   { path: 'Archer/Archer_Run',   fps: 12, loop: true },
        shoot: { path: 'Archer/Archer_Shoot', fps: 15, loop: false },
    },
};
