import { _decorator, Component, Node } from 'cc';
import { on, off, emit } from '../../baseSystem/util';
import {
    GameEvt,
    type WaveClearEvent,
    type WaveClearReason,
    type UpgradeOfferShowEvent,
    type UpgradeChosenEvent,
    type RevivePlayerEvent,
    type RestartGameEvent,
} from '../events/GameEvents';
import { EnemyBase } from '../enemy/base/EnemyBase';
import { CoinFactory } from '../gold/CoinFactory';
import { loadAllWaves } from '../config/waveConfig';
import type { WaveConfig } from '../config/waveConfig';
import { PlayerControl } from '../player/PlayerControl';
import { GameSession } from '../core/GameSession';
import { LevelRun } from './LevelRun';
import { LevelPhase } from './LevelPhase';
import { WaveDirector } from './WaveDirector';
import { nextPhase } from './LevelPhaseTransition';
import { UpgradeOfferSystem } from './upgrade/UpgradeOfferSystem';
import type { VictoryPanel } from '../ui/VictoryPanel';
import type { GameOverPanel } from '../ui/GameOverPanel';

const { ccclass } = _decorator;

/** 每波开始时的刷新次数初值（Step 2.2 约定）*/
const REROLL_QUOTA_PER_WAVE = 1;

/**
 * LevelManager —— 关卡状态机与胶水层
 *
 * 职责：
 *   - 持有 LevelRun / WaveDirector / UpgradeOfferSystem
 *   - 每帧调 LevelPhaseTransition.nextPhase 判定是否切阶段
 *   - Upgrading 阶段触发 UI：rollOffer → emit UpgradeOfferShow → UI 监听自动弹
 *   - 监听 UpgradeChosen / UpgradeReroll 处理玩家选择 / 刷新
 *   - 监听 Player 死亡（TODO）→ GameOver
 *   - 波次全清 → Victory
 *
 * 外部节点引用（GameManager 注入）：
 *   gameRoot / enemiesParent / playerNode / victoryPanel / gameOverPanel
 */
export interface ILevelBindings {
    readonly gameRoot: Node;
    readonly enemiesParent: Node;
    readonly playerNode: Node;
    readonly victoryPanel: VictoryPanel | null;
    readonly gameOverPanel: GameOverPanel | null;
}

@ccclass('LevelManager')
export class LevelManager extends Component {

    private _bindings: ILevelBindings | null = null;
    private _run: LevelRun | null = null;
    private _director: WaveDirector | null = null;
    private _offer: UpgradeOfferSystem | null = null;
    private _waves: readonly WaveConfig[] = [];

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
        this._run = LevelRun.startNew(REROLL_QUOTA_PER_WAVE);

        const upgradeMgr = PlayerControl.instance?.upgradeMgr;
        if (!upgradeMgr) {
            console.error('[LevelManager] PlayerControl.upgradeMgr 未就绪，升级系统不可用');
            return;
        }
        const classId = PlayerControl.instance?.currentClassId ?? null;
        this._offer = new UpgradeOfferSystem(upgradeMgr, undefined, classId);

        on(GameEvt.UpgradeChosen, this._onUpgradeChosen);
        on(GameEvt.UpgradeReroll, this._onUpgradeReroll);
        on(GameEvt.RevivePlayer,  this._onRevive);
        on(GameEvt.RestartGame,   this._onRestart);

        // GameSession 死亡流转：
        //   - canRevive=true → onReviveRequest（仍可救一次，本面板支持复活按钮）
        //   - canRevive=false → onGameOver（终局，本面板复活按钮禁用）
        // 两条路径都进入 _enterGameOver（弹同一个 GameOverPanel）；
        // GameOverPanel 内部根据 GameSession.canRevive 决定按钮可用性。
        GameSession.inst.onReviveRequest = () => this._enterGameOver();
        GameSession.inst.onGameOver = (_survived) => this._enterGameOver();

        this._enterWave(0);
    }

    onDestroy(): void {
        off(GameEvt.UpgradeChosen, this._onUpgradeChosen);
        off(GameEvt.UpgradeReroll, this._onUpgradeReroll);
        off(GameEvt.RevivePlayer,  this._onRevive);
        off(GameEvt.RestartGame,   this._onRestart);
        GameSession.inst.onGameOver = null;
        GameSession.inst.onReviveRequest = null;
    }

    update(dt: number): void {
        if (!this._run || !this._director) return;

        this._run.tick(dt);
        this._director.tick(dt);

        this._tickPhaseTransition();
    }

    /** 升级完成后调（或最后一波直接 Victory 场景）*/
    advanceToNextWave(): void {
        if (!this._run) return;
        const next = this._run.waveIndex + 1;
        if (next >= this._waves.length) {
            this._enterVictory();
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

        const aliveCount = EnemyBase.allEnemies.length;
        const { next, action } = nextPhase(run.phase, {
            waveElapsed:   run.waveElapsed,
            waveDuration:  cfg.duration,
            aliveCount,
            schedulerDone: director.isDone(),
            coinOnField:   CoinFactory.active.length,
        });

        if (action.emitWaveClear) this._emitWaveClear(run.waveIndex, action.emitWaveClear);
        if (action.despawnStragglers) this._despawnStragglers();
        if (next !== null) run.setPhase(next);
        if (action.enterUpgrading) this._enterUpgrading();
    }

    private _enterWave(index: number): void {
        const run = this._run!;
        const cfg = this._waves[index];
        if (!cfg) {
            console.error(`[LevelManager] 波次越界 index=${index}`);
            return;
        }

        run.setWaveIndex(index);
        run.resetRerollQuota(REROLL_QUOTA_PER_WAVE);
        run.setPhase(LevelPhase.Spawning);

        const playerPos = this._bindings!.playerNode.worldPosition;
        this._director!.startWave(cfg, playerPos);

        console.log(`[LevelManager] ▶ wave ${index + 1}/${this._waves.length} start (duration=${cfg.duration}s)`);
    }

    /** 波次清完 → 抽卡 → 弹 UI 等玩家选 */
    private _enterUpgrading(): void {
        console.log(`[LevelManager] _enterUpgrading 触发，_offer=${this._offer ? 'OK' : 'NULL'}, _run=${this._run ? 'OK' : 'NULL'}`);
        if (!this._offer || !this._run) {
            console.warn('[LevelManager] _offer 或 _run 缺失，0.5s 后强制进下一波');
            this.scheduleOnce(() => this.advanceToNextWave(), 0.5);
            return;
        }
        this._showOffers();
    }

    /** 滚一次牌 + 广播（UpgradeOfferPanel 监听） */
    private _showOffers(): void {
        const run = this._run!;
        const offer = this._offer!;
        try {
            const cards = offer.rollOffer(3);
            console.log(`[LevelManager] 💳 升级候选 ${cards.length} 张: ${cards.map(c => c.id).join(', ')} (reroll=${run.upgradeRerollQuota})`);

            const payload: UpgradeOfferShowEvent = {
                offers: cards,
                rerollQuota: run.upgradeRerollQuota,
            };
            emit(GameEvt.UpgradeOfferShow, payload);
        } catch (err) {
            console.error('[LevelManager] _showOffers 抛异常：', err);
            this.scheduleOnce(() => this.advanceToNextWave(), 0.5);
        }
    }

    private _enterVictory(): void {
        this._run?.setPhase(LevelPhase.Victory);
        console.log('[LevelManager] 🏆 Victory - 全部 5 波清完');
        this._bindings?.victoryPanel?.show();
    }

    private _enterGameOver(): void {
        this._run?.setPhase(LevelPhase.GameOver);
        console.log('[LevelManager] 💀 GameOver - 玩家死亡');
        this._bindings?.gameOverPanel?.show();
    }

    private _emitWaveClear(waveIndex: number, reason: WaveClearReason): void {
        const payload: WaveClearEvent = { waveIndex, reason };
        emit(GameEvt.WaveClear, payload);
        console.log(`[LevelManager] ⚔ wave ${waveIndex + 1} clear (${reason})`);
    }

    /** 超时路径：直接销毁残怪，不 emit EnemyDeath */
    private _despawnStragglers(): void {
        const all = EnemyBase.allEnemies.slice();
        for (const e of all) {
            if (e.node?.isValid) e.node.destroy();
        }
    }

    // ─── 事件监听 ────────────────────────────────────────

    private _onUpgradeChosen = (e: UpgradeChosenEvent): void => {
        if (!this._offer || !this._run) return;
        if (this._run.phase !== LevelPhase.Upgrading) {
            console.warn(`[LevelManager] 收到 UpgradeChosen 但 phase=${LevelPhase[this._run.phase]}，忽略`);
            return;
        }
        const ok = this._offer.applyChoice(e.id);
        if (!ok) return;
        console.log(`[LevelManager] ✅ 选中升级 "${e.id}" → 进下一波`);
        this.advanceToNextWave();
    };

    private _onUpgradeReroll = (): void => {
        if (!this._offer || !this._run) return;
        if (this._run.phase !== LevelPhase.Upgrading) return;
        if (!this._run.consumeReroll()) return;
        console.log(`[LevelManager] 🔄 刷新升级候选 (剩余 ${this._run.upgradeRerollQuota})`);
        this._showOffers();
    };

    /**
     * 玩家点 GameOverPanel "复活" → 满血复活 + 切回 Spawning 让敌人解冻。
     */
    private _onRevive = (e: RevivePlayerEvent): void => {
        const player = PlayerControl.instance;
        if (!player) {
            console.error('[LevelManager] _onRevive: PlayerControl.instance 缺失');
            return;
        }
        const ratio = e.hpRatio ?? 1.0;
        // 1. 玩家恢复（内部会调 GameSession.confirmRevive + 切 FSM 回 Idle + 清 dissolve material）
        player.revive(ratio);
        // 2. 关弹窗
        this._bindings?.gameOverPanel?.hide();
        // 3. phase 切回 Spawning，敌人解冻、AI 恢复
        this._run?.setPhase(LevelPhase.Spawning);
        console.log('[LevelManager] ❤ Revive: phase → Spawning, hpRatio=' + ratio);
    };

    /**
     * 玩家点 GameOverPanel "再来一局" → 刷新页面（最简最稳的状态重置）。
     */
    private _onRestart = (_e: RestartGameEvent): void => {
        console.log('[LevelManager] 🔄 Restart game: location.reload()');
        window.location.reload();
    };

    get bindings(): Readonly<ILevelBindings> {
        if (!this._bindings) throw new Error('[LevelManager] bindings 未注入');
        return this._bindings;
    }
}
