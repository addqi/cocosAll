import { Node, Vec3, Color } from 'cc';
import { AttackExecutor } from '../AttackExecutor';
import type { AttackSpec } from '../AttackPayload';
import type { EnemyBase } from '../../../enemy/base/EnemyBase';
import type { AttackHitFn } from './AttackHitTypes';
import { GraphicsProjectile } from './GraphicsProjectile';
import { GraphicsAreaBurst } from './GraphicsAreaBurst';

type VfxRoot = { parent: Node | null };
const _vfxRoot: VfxRoot = { parent: null };

function _spawnVfxNode(name: string): Node {
    const parent = _vfxRoot.parent;
    if (!parent || !parent.isValid) {
        throw new Error('[AttackHandlers] 未调用 installAttackHandlers 或 parentNode 失效');
    }
    const n = new Node(name);
    parent.addChild(n);
    return n;
}

/**
 * 安装真实的 projectile / area handler。
 *
 * 由 PlayerControl.start 调用一次；替换掉 AttackExecutor 里的 console.log 桩。
 * 再次调用会覆盖 handler，可用于重置 VFX 挂载点。
 *
 * 约定 spec 字段：
 * - projectile: origin(Vec3), target(EnemyBase | null), speed, homingStrength?,
 *               maxRange?, hitRadius?, color?, damageRatio, onHit
 * - area:       center(Vec3), radius, color?, damageRatio, onHit
 */
export function installAttackHandlers(parentNode: Node): void {
    _vfxRoot.parent = parentNode;

    AttackExecutor.register('projectile', (spec) => _handleProjectile(spec));
    AttackExecutor.register('area',       (spec) => _handleArea(spec));
}

function _handleProjectile(spec: AttackSpec): boolean {
    const origin = spec.origin as Vec3 | undefined;
    const onHit  = spec.onHit as AttackHitFn | undefined;
    if (!origin || !onHit) {
        return true;
    }

    const target         = (spec.target as EnemyBase | null | undefined) ?? null;
    const speed          = (spec.speed as number | undefined) ?? 600;
    const homingStrength = (spec.homingStrength as number | undefined) ?? 0;
    const maxRange       = (spec.maxRange as number | undefined) ?? 1200;
    const hitRadius      = (spec.hitRadius as number | undefined) ?? 18;
    const color          = (spec.color as Color | undefined) ?? new Color(255, 140, 40, 255);
    const damageRatio    = (spec.damageRatio as number | undefined) ?? 1;

    const dir = new Vec3();
    if (spec.dir instanceof Vec3) {
        Vec3.copy(dir, spec.dir as Vec3);
    } else if (target?.node.isValid) {
        Vec3.subtract(dir, target.node.worldPosition, origin);
    } else {
        dir.set(1, 0, 0);
    }

    const node = _spawnVfxNode('GfxProjectile');
    const proj = node.addComponent(GraphicsProjectile);
    proj.init(origin, dir, speed, target, homingStrength, maxRange, hitRadius, color, damageRatio, onHit);
    return true;
}

function _handleArea(spec: AttackSpec): boolean {
    const center = spec.center as Vec3 | undefined;
    const onHit  = spec.onHit as AttackHitFn | undefined;
    if (!center || !onHit) {
        return true;
    }

    const radius      = (spec.radius as number | undefined) ?? 200;
    const color       = (spec.color as Color | undefined) ?? new Color(120, 200, 255, 255);
    const damageRatio = (spec.damageRatio as number | undefined) ?? 1;

    const node = _spawnVfxNode('GfxAreaBurst');
    const burst = node.addComponent(GraphicsAreaBurst);
    burst.init(center, radius, color, damageRatio, onHit);
    return true;
}
