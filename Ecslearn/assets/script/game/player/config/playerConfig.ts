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

/** 玩家配置结构 */
export interface PlayerConfigData {
    /** 动画帧尺寸（源图每帧的像素宽高） */
    frameSize: number;
    /** 显示尺寸（节点实际渲染宽高） */
    displayWidth: number;
    displayHeight: number;
    /** 动画定义表，key 与 EPlayerAnim 枚举值一致 */
    anims: Record<string, AnimEntry>;
    /** 攻击范围半径（像素） */
    attackRange: number;
    /** 箭矢飞行速度（像素/秒），用于计算飞行时长 duration = distance / speed */
    arrowSpeed: number;
    /** 箭矢纹理路径（resources 相对路径，不带后缀） */
    arrowTexture: string;
    /** 箭矢显示宽度（像素） */
    arrowWidth: number;
    /** 箭矢显示高度（像素） */
    arrowHeight: number;
    /** 弧线拱高 = 距离 × arcRatio（有目标时） */
    arrowArcRatio: number;
    /** 无目标时箭矢水平射程（像素），arcHeight = range × 0.5 → 45° 出射 */
    arrowNoTargetRange: number;
    /** 攻击范围指示圈纹理路径 */
    rangeTexture: string;
    /** 升级基础经验值：requiredXP(lv) = xpBase + lv × xpGrowth */
    xpBase: number;
    /** 每级经验增长量 */
    xpGrowth: number;
    /** 技能栏位上限 */
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
    arrowSpeed: 300,
    arrowTexture: 'Archer/Arrow',
    arrowWidth: 64,
    arrowHeight: 64,
    arrowArcRatio: 0.3,
    arrowNoTargetRange: 600,
    rangeTexture: 'ui/round',
    xpBase: 50,
    xpGrowth: 30,
    maxSkillSlots: 3,
};
