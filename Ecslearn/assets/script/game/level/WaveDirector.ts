import { Node, Vec3 } from 'cc';
import { MinionControl } from '../enemy/minion/MinionControl';
import { EMinionType } from '../enemy/minion/behaviors';
import { WaveScheduler, type SpawnEvent } from './WaveScheduler';
import type { WaveConfig } from '../config/waveConfig';

/**
 * 波次执行层（Cocos 节点绑定）
 *
 * 职责：
 *   - 持有敌人父节点引用
 *   - startWave / tick 委托 WaveScheduler 计算"什么时候生成什么"
 *   - 把 SpawnEvent 翻译成 Cocos 节点：new Node + addComponent(MinionControl)
 *
 * 非职责：
 *   - 判定清场（LevelManager 读 EnemyBase.allEnemies）
 *   - 订阅事件（保持 WaveDirector 纯粹）
 *   - 管理波次序号（LevelRun.waveIndex 的事）
 *
 * 时序合约：
 *   - startWave(cfg, center) 必须在 ResourceState.ready 之后调用（否则
 *     MinionControl.onLoad 里 _behavior.config.anims 会读到未加载的资源）
 */
export class WaveDirector {

    private readonly _scheduler = new WaveScheduler();
    private readonly _parent: Node;

    constructor(enemiesParent: Node) {
        this._parent = enemiesParent;
    }

    /** 开始一波 —— center 通常是玩家当前世界坐标 */
    startWave(cfg: WaveConfig, center: Readonly<Vec3>): void {
        this._scheduler.startWave(cfg, center);
    }

    /**
     * 每帧推进：把本帧到期的刷怪事件落地成节点
     * 由 LevelManager 在 Spawning/Clearing 阶段调用
     */
    tick(dt: number): void {
        const events = this._scheduler.tick(dt);
        for (const ev of events) {
            this._spawnEnemy(ev);
        }
    }

    /** 本波 SpawnerRule 都派完了（不代表场上怪死完，死完看 EnemyBase.allEnemies）*/
    isDone(): boolean {
        return this._scheduler.isDone();
    }

    /** 中止本波（玩家死亡/切关卡）*/
    abort(): void {
        this._scheduler.abort();
    }

    // ─── 内部：节点生成 ──────────────────────────────────

    private _spawnEnemy(ev: SpawnEvent): void {
        const behaviorId = this._resolveBehaviorId(ev.enemyId);
        if (!behaviorId) {
            console.error(`[WaveDirector] 未知 enemyId "${ev.enemyId}"（应由 WaveConfigLoader 拦截，此处仅兜底）`);
            return;
        }

        // 走和 GameManager._spawnDebugEnemy 一致的模式：
        //   active=false → addComponent（此时 onLoad 不触发）→ 配 behaviorId → active=true
        const n = new Node(`Minion_${ev.enemyId}_${ev.ruleIndex}_${ev.indexInRule}`);
        n.active = false;
        this._parent.addChild(n);
        n.setWorldPosition(ev.worldPos.x, ev.worldPos.y, ev.worldPos.z);
        const mc = n.addComponent(MinionControl);
        mc.behaviorId = behaviorId;
        n.active = true;
    }

    /** 字符串 enemyId → EMinionType 枚举；未知返回 null（由 WaveConfigLoader 校验应已拦截）*/
    private _resolveBehaviorId(enemyId: string): EMinionType | null {
        const values = Object.values(EMinionType) as string[];
        return values.includes(enemyId) ? (enemyId as EMinionType) : null;
    }
}
