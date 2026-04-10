import { _decorator, Component, Sprite, SpriteFrame, UITransform, Size, Vec3, Texture2D, view, Camera, director } from 'cc';
import { ResourceMgr } from '../../baseSystem/resource';
import { QuadBezier } from '../../baseSystem/math';
import { ProjectilePool } from './ProjectilePool';
import { EnemyControl } from '../enemy/EnemyControl';
import { playerConfig } from '../player/config/playerConfig';
import type { ProjectileConfig } from '../shoot/types';

const { ccclass } = _decorator;

const _tmpPos = new Vec3();
const _tmpTan = new Vec3();
const RAD2DEG = 180 / Math.PI;
const PIERCE_HIT_RADIUS = 40;

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
    private _pierceSpeed = 0;
    private _hitEnemies = new Set<EnemyControl>();

    private _onHit: ArrowHitFn | null = null;
    private _config: ProjectileConfig | null = null;
    private _damageRatio = 1;
    private _inited = false;

    init(
        curve: QuadBezier,
        duration: number,
        hasTarget: boolean,
        target: EnemyControl | null,
        width: number, height: number,
        texturePath: string,
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

        curve.getPoint(0, _tmpPos);
        this.node.setWorldPosition(_tmpPos);
        curve.getTangent(0, _tmpTan);
        this._applyRotation(_tmpTan);

        const ut = this.node.getComponent(UITransform) || this.node.addComponent(UITransform);
        ut.setContentSize(new Size(width, height));

        const tex = ResourceMgr.inst.get<Texture2D>(`${texturePath}/texture`);
        if (tex) {
            let sprite = this.node.getComponent(Sprite);
            if (!sprite) {
                sprite = this.node.addComponent(Sprite);
                sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            }
            const sf = new SpriteFrame();
            sf.texture = tex;
            sprite.spriteFrame = sf;
        }
    }

    onDisable() {
        this._inited = false;
        this._onHit = null;
        this._curve = null;
        this._target = null;
        this._config = null;
        this._piercing = false;
        this._hitEnemies.clear();
    }

    update(dt: number) {
        if (!this._inited) return;

        if (this._piercing) {
            this._updatePierce(dt);
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
            this._onArrival();
            return;
        }

        if (this._isOutOfScreen()) {
            ProjectilePool.release(this.node);
        }
    }

    // ── 曲线到达终点 ──────────────────────────────────

    private _onArrival() {
        if (this._hasTarget && this._target?.node.isValid) {
            this._onHit?.(this._target, this._damageRatio);
            this._hitEnemies.add(this._target);
        }

        const cfg = this._config;
        if (!cfg) {
            ProjectilePool.release(this.node);
            return;
        }

        if (cfg.pierceCount > 0) {
            this._enterPierce();
            return;
        }

        this._postPierceCheck();
    }

    // ── 穿透：直线飞行 + 逐帧碰撞检测 ─────────────────

    private _enterPierce() {
        if (this._curve) {
            this._curve.getTangent(1, this._pierceDir);
        } else {
            this._pierceDir.set(1, 0, 0);
        }
        this._pierceDir.normalize();
        this._pierceSpeed = playerConfig.arrowSpeed;
        this._piercing = true;
    }

    private _updatePierce(dt: number) {
        const pos = this.node.worldPosition;
        _tmpPos.set(
            pos.x + this._pierceDir.x * this._pierceSpeed * dt,
            pos.y + this._pierceDir.y * this._pierceSpeed * dt,
            0,
        );
        this.node.setWorldPosition(_tmpPos);

        const cfg = this._config!;
        for (const e of EnemyControl.allEnemies) {
            if (cfg.pierceCount <= 0) break;
            if (!e.node.isValid || e.combat.isDead || this._hitEnemies.has(e)) continue;
            if (Vec3.distance(_tmpPos, e.node.worldPosition) < PIERCE_HIT_RADIUS) {
                this._hitEnemies.add(e);
                this._damageRatio *= 0.7;
                cfg.pierceCount--;
                this._onHit?.(e, this._damageRatio);
            }
        }

        if (cfg.pierceCount <= 0) {
            this._piercing = false;
            this._postPierceCheck();
            return;
        }

        if (this._isOutOfScreen()) {
            ProjectilePool.release(this.node);
        }
    }

    // ── 穿透结束后检查弹射 / 分裂 ─────────────────────

    private _postPierceCheck() {
        const cfg = this._config!;
        const hitPos = this.node.worldPosition.clone();

        if (cfg.bounceCount > 0) {
            cfg.bounceCount--;
            const next = this._findNearest(hitPos);
            if (next) {
                this._retarget(hitPos, next);
                return;
            }
        }

        if (cfg.splitCount > 0) {
            this._split(hitPos, cfg.splitCount);
        }

        ProjectilePool.release(this.node);
    }

    // ── 弹射：重建曲线飞向下一个敌人 ──────────────────

    private _retarget(from: Vec3, next: EnemyControl) {
        const end = next.node.worldPosition.clone();
        const dist = Vec3.distance(from, end);
        const facing = end.x > from.x ? 1 : -1;

        this._curve = QuadBezier.createArc(from, end, dist * playerConfig.arrowArcRatio * facing);
        this._duration = dist / playerConfig.arrowSpeed;
        this._elapsed = 0;
        this._hasTarget = true;
        this._target = next;
        this._piercing = false;
    }

    // ── 分裂：生成子箭矢 ──────────────────────────────

    private _split(from: Vec3, count: number) {
        const { arrowTexture, arrowWidth, arrowHeight, arrowSpeed, arrowArcRatio } = playerConfig;
        const used = new Set(this._hitEnemies);

        for (let i = 0; i < count; i++) {
            const next = this._findNearest(from, used);
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
                arrowWidth, arrowHeight, arrowTexture,
                splitCfg, this._onHit ?? undefined,
            );
        }
    }

    // ── 工具 ───────────────────────────────────────────

    private _findNearest(from: Vec3, exclude?: Set<EnemyControl>): EnemyControl | null {
        const skip = exclude ?? this._hitEnemies;
        let best: EnemyControl | null = null;
        let bestDist = Infinity;
        for (const e of EnemyControl.allEnemies) {
            if (!e.node.isValid || e.combat.isDead || skip.has(e)) continue;
            const d = Vec3.distance(from, e.node.worldPosition);
            if (d < bestDist) { bestDist = d; best = e; }
        }
        return best;
    }

    private _applyRotation(tangent: Vec3) {
        const angle = Math.atan2(tangent.y, tangent.x) * RAD2DEG;
        this.node.setRotationFromEuler(0, 0, angle);
        this.node.setScale(1, tangent.x < 0 ? -1 : 1, 1);
    }

    private _isOutOfScreen(): boolean {
        const { width, height } = view.getVisibleSize();
        const margin = 100;
        const hw = width / 2 + margin;
        const hh = height / 2 + margin;

        const cam = director.getScene()?.getComponentInChildren(Camera);
        const cx = cam ? cam.node.worldPosition.x : 0;
        const cy = cam ? cam.node.worldPosition.y : 0;

        const pos = this.node.worldPosition;
        return pos.x < cx - hw || pos.x > cx + hw || pos.y < cy - hh || pos.y > cy + hh;
    }
}
