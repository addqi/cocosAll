import {
    _decorator, Component, Vec2, view,
    RigidBody2D, CircleCollider2D, BoxCollider2D,
    Contact2DType, Collider2D,
} from 'cc';
import { PHY_GROUP } from '../../physics/PhysicsGroups';
import { PlayerControl } from '../../player/PlayerControl';
import { ProjectilePool } from '../../projectile/ProjectilePool';
import { getMainCamera } from '../../core/CameraRef';

const { ccclass } = _decorator;

const RAD2DEG = 180 / Math.PI;
const ARROW_SPEED = 250;
const _v2 = new Vec2();

@ccclass('EnemyArrow')
export class EnemyArrow extends Component {
    private _rb: RigidBody2D = null!;
    private _col: Collider2D = null!;
    private _damage = 0;
    private _inited = false;
    private _done = false;

    onLoad() {
        this._setupPhysics();
    }

    init(worldX: number, worldY: number, angle: number, damage: number) {
        this._damage = damage;
        this._inited = true;
        this._done = false;

        this.node.setWorldPosition(worldX, worldY, 0);
        this.node.setRotationFromEuler(0, 0, angle * RAD2DEG);
        const dirX = Math.cos(angle);
        this.node.setScale(1, dirX < 0 ? -1 : 1, 1);

        this._rb.group = PHY_GROUP.EBullet;
        this._col.group = PHY_GROUP.EBullet;

        _v2.set(dirX * ARROW_SPEED, Math.sin(angle) * ARROW_SPEED);
        this._rb.linearVelocity = _v2;
    }

    onDisable() {
        this._inited = false;
        this._done = true;
        if (this._rb) {
            _v2.set(0, 0);
            this._rb.linearVelocity = _v2;
        }
    }

    // ── 物理（复用 prefab 已配好的 RigidBody2D + Collider2D）────

    private _setupPhysics() {
        const rb = this.node.getComponent(RigidBody2D);
        if (!rb) { console.error('[EnemyArrow] prefab 缺少 RigidBody2D'); return; }
        rb.enabledContactListener = true;
        this._rb = rb;

        const col = this.node.getComponent(CircleCollider2D)
                 || this.node.getComponent(BoxCollider2D);
        if (!col) { console.error('[EnemyArrow] prefab 缺少 Collider2D'); return; }
        col.on(Contact2DType.BEGIN_CONTACT, this._onContact, this);
        this._col = col;
    }

    private _onContact(_self: Collider2D, other: Collider2D) {
        if (!this._inited || this._done) return;

        const player = other.node.getComponent(PlayerControl);
        if (!player) return;

        player.applyDamage(this._damage);
        this._release();
    }

    update(_dt: number) {
        if (!this._inited || this._done) return;
        if (this._isOutOfScreen()) this._release();
    }

    private _release() {
        if (this._done) return;
        this._done = true;
        this._inited = false;
        ProjectilePool.release(this.node);
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
        return pos.x < cx - hw || pos.x > cx + hw
            || pos.y < cy - hh || pos.y > cy + hh;
    }
}
