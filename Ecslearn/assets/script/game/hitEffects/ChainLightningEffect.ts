import { Vec3 } from 'cc';
import { HitEffectBase } from '../../baseSystem/hitEffect';
import { hitEffect } from '../../baseSystem/hitEffect';
import { EnemyControl } from '../enemy/EnemyControl';
import { findNearestEnemy } from '../enemy/EnemyQuery';
import type { GameHitContext } from './types';

/**
 * 概率触发闪电链 AOE
 *
 * 命中时按 chance 概率触发，从目标开始跳到最多 jumps 个附近敌人，
 * 每跳造成 finalDamage × chainRatio 的纯伤害，chainRatio 逐跳衰减。
 *
 * 配置项：chance(触发概率)、jumps(跳数)、chainRatio(首跳伤害比例)、
 *         chainDecay(每跳衰减)、chainRange(跳跃搜索半径)。
 */
@hitEffect
export class ChainLightningEffect extends HitEffectBase {
    onHit(ctx: GameHitContext): void {
        if (ctx.finalDamage <= 0) return;

        const chance     = this.data.chance ?? 0.3;
        if (Math.random() >= chance) return;

        const jumps      = this.data.jumps ?? 3;
        const range      = this.data.chainRange ?? 300;
        const decay      = this.data.chainDecay ?? 0.7;
        let   ratio      = this.data.chainRatio ?? 0.5;

        const visited    = new Set<EnemyControl>();
        let   origin     = ctx.targetNode?.worldPosition ?? Vec3.ZERO;

        for (const e of EnemyControl.allEnemies) {
            if (e.combat === ctx.targetCombat) { visited.add(e); break; }
        }

        for (let i = 0; i < jumps; i++) {
            const next = findNearestEnemy(origin, range, visited);
            if (!next) break;

            visited.add(next);
            const dmg = Math.max(1, Math.round(ctx.finalDamage * ratio));
            next.combat.takePureDamage(dmg);
            origin = next.node.worldPosition;
            ratio *= decay;
        }
    }
}
