import type { AnimEntry } from '../../player/config/playerConfig';

export interface EnemyConfigData {
    /** 精灵图切帧尺寸（正方形边长，px） */
    frameSize: number;
    /** 渲染宽度（px） */
    displayWidth: number;
    /** 渲染高度（px） */
    displayHeight: number;
    /** 动画片段表，key 为动画名（idle / run / attack …） */
    anims: Record<string, AnimEntry>;
    /** 发现玩家的探测半径（px） */
    detectionRange: number;
    /** 进入攻击判定的距离（px） */
    attackRange: number;
    /** 攻击扇形角度（度，360 = 全圆） */
    attackAngle: number;
    /** 攻击前摇时长（秒，0 = 无前摇） */
    attackWindUp: number;
    /** 攻击冷却时长（秒） */
    attackCooldown: number;
    /** 命中判定触发的动画帧索引 */
    attackHitFrame: number;
    /** 待机最短时间（秒） */
    idleTimeMin: number;
    /** 待机最长时间（秒） */
    idleTimeMax: number;
    /** 游荡最短时间（秒） */
    wanderTimeMin: number;
    /** 游荡最长时间（秒） */
    wanderTimeMax: number;
    /** 游荡速度 = MoveSpeed × 此比例 */
    wanderSpeedRatio: number;
    /** 击杀奖励经验值 */
    xpReward: number;
}

export const enemyConfig: EnemyConfigData = {
    frameSize: 192,
    displayWidth: 150,
    displayHeight: 150,
    anims: {
        idle:   { frameDir: 'Warrior/idle',    fps: 8,  loop: true },
        run:    { frameDir: 'Warrior/run',     fps: 10, loop: true },
        attack: { frameDir: 'Warrior/attack',  fps: 12, loop: false },
    },
    detectionRange: 200,
    attackRange: 50,
    attackAngle: 100,
    attackWindUp: 0.6,
    attackCooldown: 1.5,
    attackHitFrame: 2,
    idleTimeMin: 1,
    idleTimeMax: 3,
    wanderTimeMin: 1,
    wanderTimeMax: 2,
    wanderSpeedRatio: 0.4,
    xpReward: 10,
};
