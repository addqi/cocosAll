import type { Vec3 } from 'cc';

/**
 * 全局事件名集中定义。所有 EventBus.emit / on 一律引用本常量，消灭魔法字符串。
 *
 * 命名约定：小写 + 冒号分段（domain:action）。
 * 新增事件：在本文件定义常量 + 同步声明 Payload 接口。
 */
export const GameEvt = {
    EnemyDeath:      'enemy:death',

    GoldDrop:        'gold:drop',
    GoldPickupBegin: 'gold:pickup_begin',
    GoldPickupEnd:   'gold:pickup_end',
    GoldGained:      'gold:gained',
    GoldSpent:       'gold:spent',

    // ─── 关卡 / 波次 ────────────────────
    WaveClear:       'wave:clear',
} as const;

/** 敌人死亡事件 — 唯一广播源：`MinionDeadState.enter` */
export interface EnemyDeathEvent {
    /** 对接敌人配置表 id，缺省为空串（当前单种敌人可不填）*/
    enemyId: string;
    /** 经验奖励（由 PlayerExperience 监听处理）*/
    xpReward: number;
    /** 金币基础掉落（进入 GoldModifier 链前的 baseAmount）*/
    goldDrop: number;
    /** 死亡时的世界坐标（克隆副本，监听器可安全读取）*/
    worldPos: Readonly<Vec3>;
    /** 谁杀的，首版默认 'player' */
    killerId?: string;
}

/** 场上已生成金币物件（由 GoldSystem 广播给 VFX/音效）*/
export interface GoldDropEvent {
    worldPos: Readonly<Vec3>;
    /** 该枚物件的面值（单枚 = N 金）*/
    amount: number;
}

/** 金币开始飞向玩家 */
export interface GoldPickupBeginEvent {
    amount: number;
}

/** 金币到达玩家，即将入账 */
export interface GoldPickupEndEvent {
    amount: number;
    worldPos: Readonly<Vec3>;
}

/** 金币最终入账（RunSession.gold 已加）*/
export interface GoldGainedEvent {
    /** 最终到手金额（已过 Modifier 链）*/
    final: number;
    /** 来源标识，用于 UI 区分跳字颜色 */
    source: string;
    worldPos?: Readonly<Vec3>;
}

/** 金币花费 */
export interface GoldSpentEvent {
    amount: number;
    reason: string;
}

/** 波次清场触发原因 */
export type WaveClearReason = 'killall' | 'timeout';

/** 本波"进入 Clearing"时广播（killall 全灭 / timeout 超时）*/
export interface WaveClearEvent {
    /** 本波序号（LevelRun.waveIndex，从 0 开始）*/
    waveIndex: number;
    /** 触发原因 */
    reason: WaveClearReason;
}
