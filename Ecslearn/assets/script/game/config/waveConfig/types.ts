/**
 * 波次配置数据结构
 *
 * 本文件是波次系统的"契约"：只定义类型，不含任何运行时逻辑。
 * 修改数值 → 改 waves.json；修改结构 → 改本文件 + 同步修改 WaveConfigLoader 校验。
 */

/** 刷怪时机 */
export type SpawnTiming = 'burst' | 'over-time';

/** 刷怪位置规则 */
export type SpawnPattern = 'ring' | 'random';

/** 单条刷怪规则 */
export interface SpawnerRule {
    /** 敌人 id，必须能通过 EMinionType 反查（warrior / ranger / bomber 等）*/
    readonly enemyId: string;
    /** 本条规则生成的怪总数 */
    readonly count: number;
    /** burst: 一帧全出；over-time: 在本波 duration 内均匀分布 */
    readonly timing: SpawnTiming;
    /** ring: 以玩家为圆心等角度环形；random: 地图内均匀随机 */
    readonly pattern: SpawnPattern;
    /** pattern === 'ring' 时必填，单位像素 */
    readonly ringRadius?: number;
}

/** 给本波所有敌人挂载的 Buff，本阶段仅占位，不消费 */
export interface EnemyBuffEntry {
    readonly buffId: number;
    readonly stack?: number;
}

/** 单波配置 */
export interface WaveConfig {
    /** 波次序号，从 1 开始，连续且升序 */
    readonly index: number;
    /** 本波超时时长（秒），到点强制清场（静默销毁残怪）*/
    readonly duration: number;
    /** 本波所有刷怪规则，至少 1 条 */
    readonly spawners: readonly SpawnerRule[];
    /** 本波给所有怪挂的难度 buff；本阶段仅占字段，不消费 */
    readonly enemyBuffs?: readonly EnemyBuffEntry[];
}
