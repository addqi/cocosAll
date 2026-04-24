import { Vec3 } from 'cc';
import type { SpawnerRule, SpawnPattern, WaveConfig } from '../config/waveConfig';

/**
 * 单个刷怪事件 —— 由 Scheduler 计算出来，交给 Director 去实际造节点
 */
export interface SpawnEvent {
    /** 对应 SpawnerRule.enemyId（warrior / ranger / ... ）*/
    readonly enemyId: string;
    /** 世界坐标，已按 pattern 计算好 */
    readonly worldPos: Readonly<Vec3>;
    /** 用于调试：哪条 rule 生成的、第几只 */
    readonly ruleIndex: number;
    readonly indexInRule: number;
}

/**
 * 位置策略：把"第 i 只 / 共 total 只 / rule / 中心点"算成世界坐标
 *
 * Linus 式好品味：用一张"pattern → 函数"的表代替 switch，
 * 新增 pattern 只在表里加一行，不改任何判定代码。
 */
export type PatternFn = (
    rule: SpawnerRule,
    indexInRule: number,
    totalInRule: number,
    center: Readonly<Vec3>,
) => Vec3;

const TAU = Math.PI * 2;

/** 以 center 为圆心均分角度，半径由 rule.ringRadius 决定 */
const ringFn: PatternFn = (rule, i, total, center) => {
    const r = rule.ringRadius ?? 300;
    // 从 12 点钟方向开始，顺时针等分
    const angle = -Math.PI / 2 + (i / total) * TAU;
    return new Vec3(
        center.x + Math.cos(angle) * r,
        center.y + Math.sin(angle) * r,
        center.z,
    );
};

/**
 * 随机落点：以 center 为圆心，半径 RANDOM_RADIUS 内均匀分布
 * （真实项目里 random 应该是地图内随机，但当前 MVP 没接地图 AABB，先用半径占位）
 */
const RANDOM_RADIUS = 500;
const randomFn: PatternFn = (_rule, _i, _total, center) => {
    // 均匀圆盘采样：sqrt(rand) 避免中心聚集
    const angle = Math.random() * TAU;
    const r = Math.sqrt(Math.random()) * RANDOM_RADIUS;
    return new Vec3(
        center.x + Math.cos(angle) * r,
        center.y + Math.sin(angle) * r,
        center.z,
    );
};

const PATTERN_FNS: Readonly<Record<SpawnPattern, PatternFn>> = {
    ring:   ringFn,
    random: randomFn,
};

/**
 * 波次调度器（纯逻辑，无 Cocos 节点依赖）
 *
 * 职责：
 *   - startWave(cfg, center) —— 开始一波，清零内部队列，按 timing 生成事件计划
 *   - tick(dt) —— 返回"本帧应该生成的 SpawnEvent 列表"
 *
 * 工作模型：
 *   每条 SpawnerRule 有自己的 "剩余待生成列表"：
 *     - burst：timing 数组全部是 0（第一次 tick 就全吐）
 *     - over-time：timing 数组是 [0, duration/(count), 2*duration/(count), ...]
 *   tick 累计时间，把所有 `timing <= elapsed` 的事件吐出来
 *
 * 不处理：
 *   - 节点生成（Director 做）
 *   - 清场判定（LevelManager 做）
 *   - 事件总线（不订阅、不发射）
 */
export class WaveScheduler {

    private _pendings: PendingSpawn[] = [];
    private _center = new Vec3();
    private _elapsed = 0;
    private _started = false;

    get isStarted(): boolean { return this._started; }
    get pendingCount(): number { return this._pendings.length; }

    /** 开始一波：清队列，按 cfg 生成所有 SpawnEvent 的时间计划 */
    startWave(cfg: WaveConfig, center: Readonly<Vec3>): void {
        this._pendings = [];
        this._center.set(center.x, center.y, center.z);
        this._elapsed = 0;
        this._started = true;

        cfg.spawners.forEach((rule, ruleIndex) => {
            const times = this._computeTimings(rule, cfg.duration);
            for (let i = 0; i < rule.count; i++) {
                this._pendings.push({
                    rule,
                    ruleIndex,
                    indexInRule: i,
                    totalInRule: rule.count,
                    triggerAt: times[i],
                });
            }
        });
        // 按 triggerAt 升序排列，tick 时可用二分或从头扫
        this._pendings.sort((a, b) => a.triggerAt - b.triggerAt);
    }

    /** 外部单元测试可以直接丢事件，不用模拟 tick —— startWave 后立即调用 */
    drainAll(): SpawnEvent[] {
        const all: SpawnEvent[] = [];
        for (const p of this._pendings) {
            all.push(this._toEvent(p));
        }
        this._pendings = [];
        return all;
    }

    /**
     * 推进 dt 秒，返回本帧到期的 SpawnEvent 列表
     * 调用方：Director 在 Spawning 阶段每帧调 tick，把返回值喂给 spawnEnemy
     */
    tick(dt: number): SpawnEvent[] {
        if (!this._started || this._pendings.length === 0) return EMPTY;
        this._elapsed += dt;

        const ready: SpawnEvent[] = [];
        let cut = 0;
        while (cut < this._pendings.length && this._pendings[cut].triggerAt <= this._elapsed) {
            ready.push(this._toEvent(this._pendings[cut]));
            cut++;
        }
        if (cut > 0) this._pendings.splice(0, cut);
        return ready;
    }

    /** 是否本波所有规则的刷怪都已派完（不代表场上怪都死了）*/
    isDone(): boolean {
        return this._started && this._pendings.length === 0;
    }

    /** 强制清空队列（比如玩家中途死亡 / 切关卡）*/
    abort(): void {
        this._pendings = [];
        this._started = false;
        this._elapsed = 0;
    }

    // ─── 内部 ────────────────────────────────────────────

    private _computeTimings(rule: SpawnerRule, duration: number): number[] {
        const times: number[] = [];
        if (rule.timing === 'burst') {
            for (let i = 0; i < rule.count; i++) times.push(0);
            return times;
        }
        // over-time：0, duration/count, 2*duration/count, ...
        // i=0 立刻出，i=count-1 在 duration*(count-1)/count 出（不是 duration 整点）
        // 这样 count 只怪在 (0, duration) 区间均匀分布，最后一只有余量给玩家清场
        if (rule.count <= 1) {
            times.push(0);
            return times;
        }
        const step = duration / rule.count;
        for (let i = 0; i < rule.count; i++) times.push(i * step);
        return times;
    }

    private _toEvent(p: PendingSpawn): SpawnEvent {
        const fn = PATTERN_FNS[p.rule.pattern];
        const pos = fn(p.rule, p.indexInRule, p.totalInRule, this._center);
        return {
            enemyId: p.rule.enemyId,
            worldPos: pos,
            ruleIndex: p.ruleIndex,
            indexInRule: p.indexInRule,
        };
    }
}

interface PendingSpawn {
    readonly rule: SpawnerRule;
    readonly ruleIndex: number;
    readonly indexInRule: number;
    readonly totalInRule: number;
    readonly triggerAt: number;
}

const EMPTY: readonly SpawnEvent[] = [];
