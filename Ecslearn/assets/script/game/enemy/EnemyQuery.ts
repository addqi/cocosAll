import { Vec3 } from 'cc';
import { EnemyControl } from './EnemyControl';

/**
 * 在活着的敌人中找到离 from 最近且在 range 内的目标
 *
 * @param from    搜索原点（世界坐标）
 * @param range   最大搜索半径，默认无限
 * @param exclude 需要跳过的敌人集合
 */
export function findNearestEnemy(
    from: Readonly<Vec3>,
    range = Infinity,
    exclude?: ReadonlySet<EnemyControl>,
): EnemyControl | null {
    let best: EnemyControl | null = null;
    let bestDist = range;
    for (const e of EnemyControl.allEnemies) {
        if (!e.node.isValid || e.combat.isDead) continue;
        if (exclude?.has(e)) continue;
        const d = Vec3.distance(from, e.node.worldPosition);
        if (d < bestDist) { bestDist = d; best = e; }
    }
    return best;
}
