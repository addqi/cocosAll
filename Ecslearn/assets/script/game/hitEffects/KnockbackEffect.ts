import { Vec3 } from 'cc';
import { HitEffectBase } from '../../baseSystem/hitEffect';
import { hitEffect } from '../../baseSystem/hitEffect';
import type { GameHitContext } from './types';

const _dir = new Vec3();

/**
 * 命中击退
 *
 * 将目标沿 hitOriginPos → targetNode 方向瞬间推开 knockDist 像素。
 * 配置项：knockDist(击退距离，默认 60)。
 */
@hitEffect
export class KnockbackEffect extends HitEffectBase {
    onHit(ctx: GameHitContext): void {
        const node   = ctx.targetNode;
        const origin = ctx.hitOriginPos;
        if (!node?.isValid || !origin) return;

        Vec3.subtract(_dir, node.worldPosition, origin);
        const len = _dir.length();
        if (len < 0.01) { _dir.set(1, 0, 0); } else { _dir.multiplyScalar(1 / len); }

        const dist = this.data.knockDist ?? 60;
        const pos  = node.worldPosition.clone();
        pos.x += _dir.x * dist;
        pos.y += _dir.y * dist;
        node.setWorldPosition(pos);
    }
}
