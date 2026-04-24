/**
 * 关卡阶段枚举 —— 一局游戏内的状态机
 *
 * 由 LevelManager 驱动转换，多个系统读它决定是否 tick：
 *   Spawning / Clearing 期间：战斗系统 tick，敌人 AI 跑
 *   Collecting / Upgrading 期间：仅 UI / 金币吸附 tick
 *   Victory / GameOver：整体停止
 *
 * 枚举放独立文件，避免循环依赖（LevelRun / LevelManager / GameLoop 都需要它）
 */
export enum LevelPhase {
    /** 未开始（场景刚起，未 startNew） */
    Idle,
    /** 刷怪窗口内：WaveDirector 正在生成敌人，玩家可战斗 */
    Spawning,
    /** 刷怪结束，等场上敌人全被清空（或超时强制清场） */
    Clearing,
    /** 敌人已清，等金币飞完进入玩家账户 */
    Collecting,
    /** 升级 UI 开启：战斗系统冻结，等玩家选升级或刷新 */
    Upgrading,
    /** 最后一波清完 */
    Victory,
    /** 玩家死亡 */
    GameOver,
}
