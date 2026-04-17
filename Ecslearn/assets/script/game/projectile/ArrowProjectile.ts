import {
    _decorator, Component, Vec2, Vec3, view,
    RigidBody2D, CircleCollider2D, BoxCollider2D,
    Contact2DType, Collider2D,
} from 'cc';
import { QuadBezier } from '../../baseSystem/math';
import { getMainCamera } from '../core/CameraRef';
import { findNearestEnemy } from '../enemy/EnemyQuery';
import { ProjectilePool } from './ProjectilePool';
import { EnemyControl } from '../enemy/EnemyControl';
import { archerConfig } from '../player/archer/archerConfig';
import { PHY_GROUP } from '../physics/PhysicsGroups';
import type { ProjectileConfig } from '../shoot/types';

const { ccclass } = _decorator;

const _tmpPos = new Vec3();
const _tmpTan = new Vec3();
const _tmpVel = new Vec2();
const RAD2DEG = 180 / Math.PI;

export type ArrowHitFn = (target: EnemyControl, damageRatio: number) => void;

@ccclass('ArrowProjectile')
export class ArrowProjectile extends Component {

    private _curve: QuadBezier | null = null;
    private _duration = 1;
    private _elapsed = 0;
    private _hasTarget = false;
    private _target: EnemyControl | null = null;

    private _piercing = false;
    private _pierceDir = new Vec3();
    private _hitEnemies = new Set<EnemyControl>();

    private _onHit: ArrowHitFn | null = null;
    private _config: ProjectileConfig | null = null;
    private _damageRatio = 1;
    private _inited = false;
    private _done = false;
    private _pendingRelease = false;
    private _pendingAfterHit = false;

    private _rb: RigidBody2D = null!;
    private _col: Collider2D | null = null;

    // ── 生命周期 ──────────────────────────────────

    onLoad() {
        this._setupPhysics();
    }

    init(
        curve: QuadBezier,
        duration: number,
        hasTarget: boolean,
        target: EnemyControl | null,
        config: ProjectileConfig | null,
        onHit?: ArrowHitFn,
    ) {
        this._curve = curve;
        this._duration = duration;
        this._elapsed = 0;
        this._hasTarget = hasTarget;
        this._target = target;
        this._onHit = onHit ?? null;
        this._config = config ? { ...config } : null;
        this._damageRatio = config?.damageRatio ?? 1;
        this._piercing = false;
        this._hitEnemies.clear();
        this._inited = true;
        this._done = false;
        this._pendingRelease = false;
        this._pendingAfterHit = false;

        this._rb.group = PHY_GROUP.PBullet;
        if (this._col) this._col.group = PHY_GROUP.PBullet;

        curve.getPoint(0, _tmpPos);
        this.node.setWorldPosition(_tmpPos);
        curve.getTangent(0, _tmpTan);
        this._applyRotation(_tmpTan);
    }

    onDisable() {
        this._inited = false;
        this._done = true;
        this._pendingRelease = false;
        this._pendingAfterHit = false;
        this._onHit = null;
        this._curve = null;
        this._target = null;
        this._config = null;
        this._piercing = false;
        this._hitEnemies.clear();
        if (this._rb) {
            _tmpVel.set(0, 0);
            this._rb.linearVelocity = _tmpVel;
        }
    }

    // ── 物理（prefab 已配好 RigidBody2D + Collider2D）────

    private _setupPhysics() {
        const rb = this.node.getComponent(RigidBody2D);
        if (!rb) { console.error('[ArrowProjectile] prefab 缺少 RigidBody2D'); return; }
        rb.enabledContactListener = true;
        this._rb = rb;

        const col = this.node.getComponent(CircleCollider2D)
                 || this.node.getComponent(BoxCollider2D);
        if (!col) { console.error('[ArrowProjectile] prefab 缺少 Collider2D'); return; }
        col.on(Contact2DType.BEGIN_CONTACT, this._onContact, this);
        this._col = col;
    }

    // ── 碰撞回调 ─────────────────────────────────

    private _onContact(_self: Collider2D, other: Collider2D) {
        if (!this._inited || this._done) return;

        const enemy = other.node.getComponent(EnemyControl);
        if (!enemy || !enemy.node.isValid || enemy.combat.isDead) return;
        if (this._hitEnemies.has(enemy)) return;

        if (this._piercing) {
            this._hitEnemies.add(enemy);
            this._damageRatio *= 0.7;
            this._onHit?.(enemy, this._damageRatio);
            const cfg = this._config!;
            cfg.pierceCount--;
            if (cfg.pierceCount <= 0) {
                this._piercing = false;
                this._pendingAfterHit = true;
            }
            return;
        }

        if (this._hasTarget && enemy !== this._target) return;

        this._hitEnemies.add(enemy);
        this._onHit?.(enemy, this._damageRatio);
        this._pendingAfterHit = true;
    }

    // ── 每帧更新 ──────────────────────────────────

    update(dt: number) {
        if (!this._inited || this._done) return;

        if (this._pendingAfterHit) {
            this._pendingAfterHit = false;
            this._afterHit();
            return;
        }

        if (this._piercing) {
            this._updatePierce();
            return;
        }

        if (!this._curve) return;

        this._elapsed += dt;
        const t = Math.min(this._elapsed / this._duration, 1);

        this._curve.getPoint(t, _tmpPos);
        this.node.setWorldPosition(_tmpPos);
        this._curve.getTangent(t, _tmpTan);
        this._applyRotation(_tmpTan);

        if (t >= 1) {
            this._onCurveEnd();
            return;
        }

        if (this._elapsed > 0.5 && this._isOutOfScreen()) {
            this._release();
        }
    }

    // ── 曲线飞行结束 ─────────────────────────────

    private _onCurveEnd() {
        if (this._done) return;
        if (this._hasTarget && this._target && this._hitEnemies.size === 0
            && this._target.node.isValid && !this._target.combat.isDead) {
            this._hitEnemies.add(this._target);
            this._onHit?.(this._target, this._damageRatio);
        }
        this._afterHit();
    }

    // ── 命中后统一分支 ───────────────────────────

    private _afterHit() {
        if (this._done) return;

        const cfg = this._config;
        if (!cfg) {
            this._release();
            return;
        }

        if (cfg.pierceCount > 0) {
            this._enterPierce();
            return;
        }

        this._postPierceCheck();
    }

    // ── 穿透 ──────────────────────────────────────

    private _enterPierce() {
        if (this._curve) {
            const t = Math.min(this._elapsed / this._duration, 1);
            this._curve.getTangent(t, this._pierceDir);
        } else {
            this._pierceDir.set(1, 0, 0);
        }
        this._pierceDir.normalize();
        this._piercing = true;

        const speed = archerConfig.arrowSpeed;
        _tmpVel.set(this._pierceDir.x * speed, this._pierceDir.y * speed);
        this._rb.linearVelocity = _tmpVel;
    }

    private _updatePierce() {
        if (this._done) return;
        if (this._isOutOfScreen()) {
            this._release();
        }
    }

    // ── 弹射 / 分裂 ──────────────────────────────

    private _postPierceCheck() {
        if (this._done) return;
        const cfg = this._config!;
        const hitPos = this.node.worldPosition.clone();

        if (cfg.bounceCount > 0) {
            cfg.bounceCount--;
            const next = findNearestEnemy(hitPos, Infinity, this._hitEnemies);
            if (next) {
                this._retarget(hitPos, next);
                return;
            }
        }

        if (cfg.splitCount > 0) {
            this._split(hitPos, cfg.splitCount);
        }

        this._release();
    }

    private _retarget(from: Vec3, next: EnemyControl) {
        const end = next.node.worldPosition.clone();
        const dist = Vec3.distance(from, end);
        const facing = end.x > from.x ? 1 : -1;

        this._curve = QuadBezier.createArc(from, end, dist * archerConfig.arrowArcRatio * facing);
        this._duration = dist / archerConfig.arrowSpeed;
        this._elapsed = 0;
        this._hasTarget = true;
        this._target = next;
        this._piercing = false;

        _tmpVel.set(0, 0);
        this._rb.linearVelocity = _tmpVel;
    }

    private _split(from: Vec3, count: number) {
        const { arrowSpeed, arrowArcRatio } = archerConfig;
        const used = new Set(this._hitEnemies);

        for (let i = 0; i < count; i++) {
            const next = findNearestEnemy(from, Infinity, used);
            if (!next) break;
            used.add(next);

            const end = next.node.worldPosition.clone();
            const dist = Vec3.distance(from, end);
            const facing = end.x > from.x ? 1 : -1;
            const curve = QuadBezier.createArc(from, end, dist * arrowArcRatio * facing);

            const arrowNode = ProjectilePool.acquire();
            let arrow = arrowNode.getComponent(ArrowProjectile);
            if (!arrow) arrow = arrowNode.addComponent(ArrowProjectile);

            const splitCfg: ProjectileConfig = {
                pierceCount: 0, bounceCount: 0, splitCount: 0,
                splitDamageRatio: 0, homingStrength: 0,
                damageRatio: this._damageRatio * (this._config?.splitDamageRatio ?? 0.4),
            };

            arrow.init(
                curve, dist / arrowSpeed, true, next,
                splitCfg, this._onHit ?? undefined,
            );
        }
    }

    lateUpdate() {
        if (this._pendingRelease) {
            this._pendingRelease = false;
            ProjectilePool.release(this.node);
        }
    }

    // ── 回收 ──────────────────────────────────────

    private _release() {
        if (this._done) return;
        this._done = true;
        this._inited = false;
        this._pendingRelease = true;
    }

    // ── 工具 ──────────────────────────────────────

    private _applyRotation(tangent: Vec3) {
        if (tangent.x >= 0) {
            const angle = Math.atan2(tangent.y, tangent.x) * RAD2DEG;
            this.node.setRotationFromEuler(0, 0, angle);
            this.node.setScale(1, 1, 1);
        } else {
            const angle = Math.atan2(-tangent.y, -tangent.x) * RAD2DEG;
            this.node.setRotationFromEuler(0, 0, angle);
            this.node.setScale(-1, 1, 1);
        }
    }

    private _isOutOfScreen(): boolean {
        const { width, height } = view.getVisibleSize();
        const margin = 100;
        const hw = width / 2 + margin;
        const hh = height / 2 + margin;

        const cam = getMainCamera();
        const cx = cam ? cam.node.worldPosition.x : 0;
        const cy = cam ? cam.node.worldPosition.y : 0;

        const pos = this.node.worldPosition;
        return pos.x < cx - hw || pos.x > cx + hw || pos.y < cy - hh || pos.y > cy + hh;
    }
}
