import { Vec3 } from 'cc';
import { EnemyBase } from './base/EnemyBase';

export function findNearestEnemy(
    from: Readonly<Vec3>,
    range = Infinity,
    exclude?: ReadonlySet<EnemyBase>,
): EnemyBase | null {
    let best: EnemyBase | null = null;
    let bestDist = range;
    for (const e of EnemyBase.allEnemies) {
        if (!e.node.isValid || e.combat.isDead) continue;
        if (exclude?.has(e)) continue;
        const d = Vec3.distance(from, e.node.worldPosition);
        if (d < bestDist) { bestDist = d; best = e; }
    }
    return best;
}
