/**
 * 多 key 计数器 —— "按某维度连击"的基础设施。
 *
 * 典型场景：
 *   - rapid-resonance: 按"敌人"连击，count(enemy) ≥ 5 → 下一击暴击
 *   - 玩家被敌人攻击次数：key=攻击者 enemyId，用于"同一怪连击玩家"相关的未来升级
 *   - 全局命中总次数：用 `total()` 聚合所有 key
 *
 * 设计要点（Linus 式）：
 *   - **泛型 K** 让调用方决定 key 是什么（EnemyControl / string / number 都行）
 *   - **时间戳**随每次 add 更新，方便做"过期清理"（expire）但不强制
 *   - **total()** 纯聚合查询，不额外存"全局计数" —— 避免增减不同步
 *   - key 相等用 `===`；对象型 key 不会被同值不同实例命中
 */
interface Entry {
    count: number;
    /** 最后一次 add 的时间（秒，由调用方传）*/
    lastTime: number;
}

export class ComboCounter<K> {
    private _map = new Map<K, Entry>();

    /**
     * 递增某 key 的计数。
     * @param key   身份标识
     * @param now   当前时刻（秒），调用方传入；用于后续 expire
     * @returns 递增后的计数值
     */
    add(key: K, now: number): number {
        let e = this._map.get(key);
        if (!e) {
            e = { count: 0, lastTime: now };
            this._map.set(key, e);
        }
        e.count += 1;
        e.lastTime = now;
        return e.count;
    }

    /** 读取某 key 的计数（不存在 = 0）*/
    get(key: K): number {
        return this._map.get(key)?.count ?? 0;
    }

    /** 清除某 key（不传 = 全部清）*/
    clear(key?: K): void {
        if (key === undefined) this._map.clear();
        else this._map.delete(key);
    }

    /** 所有 key 计数合计 —— 用于"全局命中总次数"查询 */
    total(): number {
        let s = 0;
        for (const e of this._map.values()) s += e.count;
        return s;
    }

    /** 当前活跃 key 数 */
    get size(): number { return this._map.size; }

    /**
     * 过期清理：所有 `now - lastTime > olderThanSec` 的 key 被移除。
     * 可选调用；不调用就永不过期。
     */
    expire(now: number, olderThanSec: number): number {
        let removed = 0;
        for (const [k, e] of this._map) {
            if (now - e.lastTime > olderThanSec) {
                this._map.delete(k);
                removed++;
            }
        }
        return removed;
    }
}
