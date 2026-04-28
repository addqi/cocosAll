import { Color, Node, Sprite, UITransform, Vec3 } from 'cc';
import { HitEffectBase } from '../../baseSystem/hitEffect';
import { hitEffect } from '../../baseSystem/hitEffect';
import { EnemyControl } from '../enemy/EnemyControl';
import { findNearestEnemy } from '../enemy/EnemyQuery';
import { getWhiteSF } from '../ui/UiAtlas';
import type { GameHitContext } from './types';

const FLASH_SIZE = 60;
const FLASH_COLOR = new Color(200, 230, 255, 255);
const FLASH_DURATION_MS = 120;

/**
 * 概率触发闪电链 AOE
 *
 * 命中时按 chance 概率触发，从目标开始跳到最多 jumps 个附近敌人，
 * 每跳造成 finalDamage × chainRatio 的纯伤害，chainRatio 逐跳衰减。
 *
 * 配置项：chance(触发概率)、jumps(跳数)、chainRatio(首跳伤害比例)、
 *         chainDecay(每跳衰减)、chainRange(跳跃搜索半径)。
 */
@hitEffect('ChainLightningEffect')
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
            this._spawnFlash(next);
            origin = next.node.worldPosition;
            ratio *= decay;
        }
    }

    /**
     * 临时闪电命中 VFX —— 受击敌人头顶一个青白色方块，120ms 后自毁。
     *
     * 故意保持最简单：
     *   - 没有对象池（每次命中 new 一个节点）—— 闪电频率不高，GC 压力可忽略
     *   - 没有帧动画 —— 只是"闪一下"，后续可以升级为 Animation 或粒子
     *   - 挂到受击敌人的 parent（enemies 层），避免敌人死亡导致 VFX 连带销毁
     */
    private _spawnFlash(target: EnemyControl): void {
        const parent = target.node.parent;
        if (!parent) return;

        const n = new Node('LightningFlash');
        parent.addChild(n);
        n.setWorldPosition(target.node.worldPosition);

        const ut = n.addComponent(UITransform);
        ut.setContentSize(FLASH_SIZE, FLASH_SIZE);

        const sp = n.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.spriteFrame = getWhiteSF();
        sp.color = FLASH_COLOR;

        setTimeout(() => {
            if (n.isValid) n.destroy();
        }, FLASH_DURATION_MS);
    }
}
