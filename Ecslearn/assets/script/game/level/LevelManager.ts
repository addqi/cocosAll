import { _decorator, Component, Node } from 'cc';
import { on, off, emit } from '../../baseSystem/util';
import {
    GameEvt,
    type EnemyDeathEvent,
    type WaveClearEvent,
    type WaveClearReason,
} from '../events/GameEvents';
import { EnemyBase } from '../enemy/base/EnemyBase';
import { CoinFactory } from '../gold/CoinFactory';
import { loadAllWaves } from '../config/waveConfig';
import type { WaveConfig } from '../config/waveConfig';
import { LevelRun } from './LevelRun';
import { LevelPhase } from './LevelPhase';
import { WaveDirector } from './WaveDirector';
import { nextPhase } from './LevelPhaseTransition';

const { ccclass } = _decorator;

/**
 * LevelManager —— 关卡状态机与胶水层
 *
 * 职责：
 *   - 持有 LevelRun / WaveDirector，按 WaveConfig 驱动一局流程
 *   - 订阅 EnemyDeath 维护 _aliveCount（但 _aliveCount 以 EnemyBase.allEnemies 为准更鲁棒）
 *   - 每帧调 LevelPhaseTransition.nextPhase 判定是否切阶段
 *   - phase 切换时执行副作用：emit WaveClear、静默清场、启动下一波、进 Upgrading...
 *
 * 非职责：
 *   - 节点生成（WaveDirector 管）
 *   - 金币 / 经验计算（GoldSystem / PlayerExperience 管）
 *   - 状态判定逻辑（LevelPhaseTransition 纯函数管）
 *
 * Upgrading 阶段的退出机制（Step 2.7/2.8 接入）：
 *   现在 Upgrading 进了就"卡住"—— 后续 UpgradeOfferSystem 在玩家选完升级后
 *   调 advanceToNextWave() 回到 Spawning 并进入下一波
 */
export interface ILevelBindings {
    readonly gameRoot: Node;
    readonly enemiesParent: Node;
    readonly playerNode: Node;
}

@ccclass('LevelManager')
export class LevelManager extends Component {

    private _bindings: ILevelBindings | null = null;
    private _run: LevelRun | null = null;
    private _director: WaveDirector | null = null;
    private _waves: readonly WaveConfig[] = [];

    /** 由 GameManager 注入一次依赖 */
    bind(bindings: ILevelBindings): void {
        this._bindings = bindings;
    }

    start(): void {
        if (!this._bindings) {
            console.error('[LevelManager] bind() 未调用，关卡不会启动');
            return;
        }

        this._waves = loadAllWaves();
        this._director = new WaveDirector(this._bindings.enemiesParent);
        this._run = LevelRun.startNew();

        on(GameEvt.EnemyDeath, this._onEnemyDeath);

        // 开第 1 波
        this._enterWave(0);
    }

    onDestroy(): void {
        off(GameEvt.EnemyDeath, this._onEnemyDeath);
    }

    update(dt: number): void {
        if (!this._run || !this._director) return;

        this._run.tick(dt);
        this._director.tick(dt);

        this._tickPhaseTransition();
    }

    /** Step 2.7/2.8 之后由 UpgradeOfferSystem 调 —— 玩家选完升级进下一波 */
    advanceToNextWave(): void {
        if (!this._run) return;
        const next = this._run.waveIndex + 1;
        if (next >= this._waves.length) {
            // MVP 阶段暂不实现 Victory UI，先打 log 证明走到了
            this._run.setPhase(LevelPhase.Victory);
            console.log('[LevelManager] 🏆 所有波次清完，Victory');
            return;
        }
        this._enterWave(next);
    }

    // ─── 内部：阶段切换 ──────────────────────────────────

    private _tickPhaseTransition(): void {
        const run = this._run!;
        const director = this._director!;
        const cfg = this._waves[run.waveIndex];
        if (!cfg) return;

        // 场上存活敌人数：直接读 EnemyBase.allEnemies 比维护 _aliveCount 更鲁棒
        // （静默清场 destroy 时 EnemyBase.onDestroy 会自动从 _all 移除）
        const aliveCount = EnemyBase.allEnemies.length;

        const { next, action } = nextPhase(run.phase, {
            waveElapsed:   run.waveElapsed,
            waveDuration:  cfg.duration,
            aliveCount,
            schedulerDone: director.isDone(),
            coinOnField:   CoinFactory.active.length,
        });

        if (action.emitWaveClear) {
            this._emitWaveClear(run.waveIndex, action.emitWaveClear);
        }
        if (action.despawnStragglers) {
            this._despawnStragglers();
        }
        if (next !== null) {
            run.setPhase(next);
        }
        if (action.enterUpgrading) {
            this._enterUpgrading();
        }
    }

    private _enterWave(index: number): void {
        const run = this._run!;
        const cfg = this._waves[index];
        if (!cfg) {
            console.error(`[LevelManager] 波次越界 index=${index}`);
            return;
        }

        run.setWaveIndex(index);
        run.resetRerollQuota(1);       // TODO: Step 2.7 从配置读
        run.setPhase(LevelPhase.Spawning);

        const playerPos = this._bindings!.playerNode.worldPosition;
        this._director!.startWave(cfg, playerPos);

        console.log(`[LevelManager] ▶ wave ${index + 1}/${this._waves.length} start (duration=${cfg.duration}s)`);
    }

    private _enterUpgrading(): void {
        console.log('[LevelManager] ⏸ wave clear → Upgrading (Step 2.7/2.8 UI 待接入；目前自动进下一波)');
        // TODO: Step 2.7/2.8 改为弹升级 UI，玩家选完调 advanceToNextWave
        // 当前 MVP：直接进下一波，便于手动测试循环
        this.scheduleOnce(() => this.advanceToNextWave(), 1.0);
    }

    private _emitWaveClear(waveIndex: number, reason: WaveClearReason): void {
        const payload: WaveClearEvent = { waveIndex, reason };
        emit(GameEvt.WaveClear, payload);
        console.log(`[LevelManager] wave ${waveIndex + 1} clear (${reason})`);
    }

    /** 超时路径：直接销毁残怪，不 emit EnemyDeath，不掉金不给经验 */
    private _despawnStragglers(): void {
        // 用切片避免 onDestroy 里改 allEnemies 数组时的迭代破坏
        const all = EnemyBase.allEnemies.slice();
        for (const e of all) {
            if (e.node?.isValid) e.node.destroy();
        }
    }

    // ─── 事件监听 ────────────────────────────────────────

    private _onEnemyDeath = (_e: EnemyDeathEvent): void => {
        // aliveCount 改为直接读 EnemyBase.allEnemies，此处暂无需维护
        // 保留订阅 —— 未来如果需要"本波击杀数"统计会用
    };

    get bindings(): Readonly<ILevelBindings> {
        if (!this._bindings) throw new Error('[LevelManager] bindings 未注入');
        return this._bindings;
    }
}
