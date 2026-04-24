import { LevelPhase } from './LevelPhase';
import type { WaveClearReason } from '../events/GameEvents';

/**
 * 战斗阶段判定 —— 纯函数
 *
 * "战斗中" = Spawning（刷怪期）或 Clearing（等敌人清完期）
 * 这两个阶段：敌人 AI 跑、玩家输入响应、时间累计
 * 其他阶段（Idle / Collecting / Upgrading / Victory / GameOver）：
 *   - 金币吸附 / UI 动画继续跑（升级 UI 期间金币还在飞向玩家）
 *   - 敌人 AI / 玩家攻击输入冻结
 *
 * Linus 式"单点决策"：GameLoop 和 MinionControl.update 都读这个函数，
 * 将来改规则（比如 Collecting 也算战斗）只动这一个地方
 */
export function isCombatActive(phase: LevelPhase | null | undefined): boolean {
    return phase === LevelPhase.Spawning || phase === LevelPhase.Clearing;
}

/**
 * 关卡阶段转换 —— 纯函数
 *
 * 输入：当前 phase + 本帧观察到的信号
 * 输出：下一 phase（null 表示保持不变）+ 副作用指令（交给 LevelManager 执行）
 *
 * Linus 式"好品味"：
 *   - 不碰 Cocos、不读单例、不 emit 事件 —— 全部用参数/返回值沟通
 *   - 一个 switch-case 映射"phase → 判定规则"，消灭散落的 if
 *   - 可单测到 100% 分支覆盖
 */

/** 每帧的观察信号（由 LevelManager 收集并传入）*/
export interface PhaseSignals {
    /** LevelRun.waveElapsed —— 本波已过秒数 */
    readonly waveElapsed: number;
    /** 本波 duration（来自 WaveConfig）*/
    readonly waveDuration: number;
    /** 场上存活敌人数 */
    readonly aliveCount: number;
    /** WaveScheduler 已派完全部 SpawnerRule */
    readonly schedulerDone: boolean;
    /** 场上金币数（CoinFactory.active.length）*/
    readonly coinOnField: number;
}

/** 可能的副作用 —— 由 LevelManager 负责执行 */
export interface PhaseAction {
    /** 触发 WaveClear 事件时的 reason */
    readonly emitWaveClear?: WaveClearReason;
    /** 是否需要静默清场（超时路径：直接 destroy 残怪，不 emit EnemyDeath）*/
    readonly despawnStragglers?: boolean;
    /** 进 Upgrading 时 LevelManager 用此准备升级 UI */
    readonly enterUpgrading?: boolean;
}

/** 一次转换的结果 */
export interface PhaseTransition {
    /** 下一阶段；null 表示保持当前 */
    readonly next: LevelPhase | null;
    /** 伴随的副作用（可能为空）*/
    readonly action: PhaseAction;
}

const STAY: PhaseTransition = { next: null, action: {} };

/**
 * 核心判定函数
 *
 * 规则表：
 *   Spawning   + (调度完 && 无敌人)           → Clearing  (killall)
 *   Spawning   + (waveElapsed >= duration)   → Clearing  (timeout, 需静默清场)
 *   Clearing   + (无敌人)                     → Collecting
 *   Collecting + (无金币)                     → Upgrading  (enterUpgrading=true)
 *   其他                                      → 保持
 */
export function nextPhase(
    current: LevelPhase,
    signals: PhaseSignals,
): PhaseTransition {
    switch (current) {
        case LevelPhase.Spawning:
            // 先检查超时 —— 优先级高于全灭判定
            // 即使刚好最后一只死在 duration 到点那一帧，仍按 timeout 静默清场
            if (signals.waveElapsed >= signals.waveDuration) {
                return {
                    next: LevelPhase.Clearing,
                    action: {
                        emitWaveClear: 'timeout',
                        despawnStragglers: true,
                    },
                };
            }
            // 全灭：调度器派完 + 场上无敌人
            // 必须两者都满足 —— 调度器还在派（over-time 中段）时场上可能瞬时为 0
            if (signals.schedulerDone && signals.aliveCount === 0) {
                return {
                    next: LevelPhase.Clearing,
                    action: { emitWaveClear: 'killall' },
                };
            }
            return STAY;

        case LevelPhase.Clearing:
            // 敌人清完进 Collecting；否则继续等
            if (signals.aliveCount === 0) {
                return { next: LevelPhase.Collecting, action: {} };
            }
            return STAY;

        case LevelPhase.Collecting:
            // 金币收完进 Upgrading
            if (signals.coinOnField === 0) {
                return { next: LevelPhase.Upgrading, action: { enterUpgrading: true } };
            }
            return STAY;

        // Idle / Upgrading / Victory / GameOver 不由信号自动转换，
        // 由 LevelManager 的显式指令（startWave / onUpgradeChosen / 玩家死亡）驱动
        default:
            return STAY;
    }
}
