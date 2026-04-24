import { LevelPhase } from './LevelPhase';

/**
 * 本局运行时状态容器
 *
 * 职责：
 *   - 持有一局游戏的**所有**运行时变量（phase / waveIndex / reroll quota / 已选升级 ...）
 *   - 通过 setter 方法管控写入路径；所有字段对外 readonly
 *   - 单例语义：`LevelRun.current` 指向当前这一局；`startNew()` 换新实例开新局
 *
 * 非职责：
 *   - 不订阅事件总线；不持有 Node / Component 引用
 *   - 不驱动其他系统 —— 纯数据袋
 *
 * 写入路径约定（代码层 readonly 不足以防误写，靠约定）：
 *   - `phase` / `waveIndex`        只能由 LevelManager 修改
 *   - `appliedUpgradeIds`          只能由 UpgradeOfferSystem.applyChoice 修改
 *   - `upgradeRerollQuota`         UI 点击消耗 / "+quota" 类升级增加
 *   - `waveElapsed`                tick(dt) 内部维护
 *
 * 重置语义：
 *   `startNew()` 创建新实例并替换 `LevelRun.current`；旧实例保留给观察者读，
 *   但不再被系统 tick / 修改。
 */
export class LevelRun {

    /** 当前一局的运行时状态；Idle 阶段下仍可为 null（游戏未开始）*/
    static current: LevelRun | null = null;

    /** 开新局：创建新实例，覆盖 current，所有字段回到初值 */
    static startNew(initialRerollQuota = 1): LevelRun {
        const run = new LevelRun(initialRerollQuota);
        LevelRun.current = run;
        return run;
    }

    // ─── 内部状态 ────────────────────────────────────────

    private _phase = LevelPhase.Idle;
    private _waveIndex = 0;
    private _waveElapsed = 0;
    private _upgradeRerollQuota: number;
    private _appliedUpgradeIds = new Set<string>();

    private constructor(initialRerollQuota: number) {
        this._upgradeRerollQuota = initialRerollQuota;
    }

    // ─── 只读访问 ────────────────────────────────────────

    get phase(): LevelPhase { return this._phase; }
    get waveIndex(): number { return this._waveIndex; }
    get waveElapsed(): number { return this._waveElapsed; }
    get upgradeRerollQuota(): number { return this._upgradeRerollQuota; }
    get appliedUpgradeIds(): ReadonlySet<string> { return this._appliedUpgradeIds; }

    // ─── 受控写入 ────────────────────────────────────────

    /** LevelManager 切换阶段时调用 */
    setPhase(next: LevelPhase): void {
        this._phase = next;
    }

    /** LevelManager 进入新一波时调用，顺带重置 waveElapsed */
    setWaveIndex(i: number): void {
        if (i < 0) {
            console.warn(`[LevelRun] setWaveIndex 收到负数: ${i}，忽略`);
            return;
        }
        this._waveIndex = i;
        this._waveElapsed = 0;
    }

    /**
     * 每帧 tick：只在 Spawning / Clearing / Collecting 阶段累计
     * 其他阶段（Upgrading / Victory / GameOver）waveElapsed 冻结
     */
    tick(dt: number): void {
        if (this._phase !== LevelPhase.Spawning
            && this._phase !== LevelPhase.Clearing
            && this._phase !== LevelPhase.Collecting) {
            return;
        }
        this._waveElapsed += dt;
    }

    /** 每波开始时重置刷新次数（LevelManager 在 _enterWave 调用） */
    resetRerollQuota(n: number): void {
        this._upgradeRerollQuota = Math.max(0, n);
    }

    /** "+quota" 类升级增加刷新次数 */
    addRerollQuota(delta: number): void {
        this._upgradeRerollQuota = Math.max(0, this._upgradeRerollQuota + delta);
    }

    /** UI 刷新按钮消耗一次；quota=0 时返回 false */
    consumeReroll(): boolean {
        if (this._upgradeRerollQuota <= 0) return false;
        this._upgradeRerollQuota--;
        return true;
    }

    /** UpgradeOfferSystem 选中升级时登记，便于抽卡去重 */
    markUpgradeApplied(id: string): void {
        this._appliedUpgradeIds.add(id);
    }
}
