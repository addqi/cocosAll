import { _decorator, Component, Graphics, Vec3, Color, UITransform } from 'cc';
import { EnemyBase } from '../../../enemy/base/EnemyBase';
import type { AttackHitFn } from '../handlers/AttackHitTypes';

const { ccclass } = _decorator;

/**
 * projectile handler 用的纯 Graphics 投射物。
 *
 * 不依赖 prefab / 物理引擎 —— 每帧自己移动、自己做距离检测、自己销毁。
 * 命中判定采用 "距离阈值 <= hitRadius"，对 2D 俯视射击足够用。
 *
 * 支持两种模式：
 * - target 非空 → 直线追踪目标
 * - target 为空 → 向 dir 方向直线飞行，飞 maxRange 距离后销毁
 *
 * homingStrength > 0 时，每帧把速度方向往 target 方向微调（权重插值）。
 */
@ccclass('GraphicsProjectile')
export class GraphicsProjectile extends Component {

    private static readonly _tmpDir = new Vec3();
    private static readonly _tmpPos = new Vec3();

    private _vel = new Vec3();
    private _speed = 600;
    private _homing = 0;
    private _target: EnemyBase | null = null;
    private _maxRange = 1200;
    private _traveled = 0;
    private _hitRadius = 18;
    private _color = new Color(255, 128, 32, 255);
    private _onHit: AttackHitFn | null = null;
    private _damageRatio = 1;
    private _hit = new Set<EnemyBase>();
    private _done = false;

    init(
        origin: Vec3,
        dir: Vec3,
        speed: number,
        target: EnemyBase | null,
        homingStrength: number,
        maxRange: number,
        hitRadius: number,
        color: Color,
        damageRatio: number,
        onHit: AttackHitFn,
    ): void {
        this.node.setWorldPosition(origin);

        const n = Vec3.normalize(GraphicsProjectile._tmpDir, dir);
        this._vel.set(n.x * speed, n.y * speed, 0);

        this._speed = speed;
        this._homing = homingStrength;
        this._target = target;
        this._maxRange = maxRange;
        this._traveled = 0;
        this._hitRadius = hitRadius;
        this._color = color;
        this._damageRatio = damageRatio;
        this._onHit = onHit;
        this._hit.clear();
        this._done = false;

        this._ensureGraphics();
    }

    private _ensureGraphics(): void {
        if (!this.node.getComponent(UITransform)) {
            this.node.addComponent(UITransform);
        }
        let g = this.node.getComponent(Graphics);
        if (!g) g = this.node.addComponent(Graphics);
        g.clear();
        g.fillColor = this._color;
        g.strokeColor = new Color(255, 255, 255, 200);
        g.lineWidth = 2;
        g.circle(0, 0, this._hitRadius);
        g.fill();
        g.stroke();
    }

    update(dt: number): void {
        if (this._done) return;

        if (this._homing > 0) {
            if (!this._target || !this._target.node.isValid || this._target.combat.isDead) {
                this._target = this._pickHomingTarget();
            }
            if (this._target?.node.isValid && !this._target.combat.isDead) {
                const targetPos = this._target.node.worldPosition;
                const myPos = this.node.worldPosition;
                const desired = GraphicsProjectile._tmpDir;
                Vec3.subtract(desired, targetPos, myPos);
                const len = Vec3.len(desired);
                if (len > 0.001) {
                    Vec3.multiplyScalar(desired, desired, 1 / len);
                    const mix = Math.min(1, this._homing * dt * 8);
                    this._vel.x = this._vel.x * (1 - mix) + desired.x * this._speed * mix;
                    this._vel.y = this._vel.y * (1 - mix) + desired.y * this._speed * mix;
                    const nv = Math.hypot(this._vel.x, this._vel.y);
                    if (nv > 0.001) {
                        this._vel.x = (this._vel.x / nv) * this._speed;
                        this._vel.y = (this._vel.y / nv) * this._speed;
                    }
                }
            }
        }

        const pos = GraphicsProjectile._tmpPos;
        Vec3.copy(pos, this.node.worldPosition);
        pos.x += this._vel.x * dt;
        pos.y += this._vel.y * dt;
        this.node.setWorldPosition(pos);

        this._traveled += this._speed * dt;
        if (this._traveled >= this._maxRange) {
            this._release();
            return;
        }

        this._checkHit();
    }

    private _pickHomingTarget(): EnemyBase | null {
        const myPos = this.node.worldPosition;
        let best: EnemyBase | null = null;
        let bestD2 = Infinity;
        const cone = this._vel.x !== 0 || this._vel.y !== 0;
        const vx = this._vel.x;
        const vy = this._vel.y;
        for (const e of EnemyBase.allEnemies) {
            if (!e.node.isValid || e.combat.isDead) continue;
            if (this._hit.has(e)) continue;
            const dx = e.node.worldPosition.x - myPos.x;
            const dy = e.node.worldPosition.y - myPos.y;
            if (cone && (dx * vx + dy * vy) < 0) continue;
            const d2 = dx * dx + dy * dy;
            if (d2 < bestD2) { bestD2 = d2; best = e; }
        }
        return best;
    }

    private _checkHit(): void {
        const myPos = this.node.worldPosition;
        const r2 = this._hitRadius * this._hitRadius + 32 * 32;
        for (const e of EnemyBase.allEnemies) {
            if (!e.node.isValid || e.combat.isDead) continue;
            if (this._hit.has(e)) continue;
            const dx = e.node.worldPosition.x - myPos.x;
            const dy = e.node.worldPosition.y - myPos.y;
            if (dx * dx + dy * dy <= r2) {
                this._hit.add(e);
                this._onHit?.(e, this._damageRatio);
                this._release();
                return;
            }
        }
    }

    private _release(): void {
        if (this._done) return;
        this._done = true;
        this._onHit = null;
        this._target = null;
        this._hit.clear();
        if (this.node.isValid) {
            this.node.destroy();
        }
    }
}
