import { _decorator, Component, Graphics, Vec3, Color, UITransform } from 'cc';
import { EnemyBase } from '../../../enemy/base/EnemyBase';
import type { AttackHitFn } from '../handlers/AttackHitTypes';

const { ccclass } = _decorator;

/**
 * area handler 用的瞬发 AOE 视觉 + 扫描。
 *
 * 在 center 位置以 radius 画一个圆环，做 0.35s 收缩/淡出动画后销毁。
 * 同一帧扫描 EnemyBase.allEnemies 里处于圆内的目标，对每个目标调 onHit。
 */
@ccclass('GraphicsAreaBurst')
export class GraphicsAreaBurst extends Component {
    private _elapsed = 0;
    private _duration = 0.35;
    private _radius = 200;
    private _color = new Color(120, 200, 255, 255);
    private _gfx: Graphics | null = null;
    private _done = false;

    init(
        center: Vec3,
        radius: number,
        color: Color,
        damageRatio: number,
        onHit: AttackHitFn,
    ): void {
        this.node.setWorldPosition(center);
        this._radius = radius;
        this._color = color;
        this._elapsed = 0;
        this._done = false;

        if (!this.node.getComponent(UITransform)) {
            this.node.addComponent(UITransform);
        }
        let g = this.node.getComponent(Graphics);
        if (!g) g = this.node.addComponent(Graphics);
        this._gfx = g;
        this._draw(1);

        const r2 = radius * radius;
        for (const e of EnemyBase.allEnemies) {
            if (!e.node.isValid || e.combat.isDead) continue;
            const dx = e.node.worldPosition.x - center.x;
            const dy = e.node.worldPosition.y - center.y;
            if (dx * dx + dy * dy <= r2) {
                onHit(e, damageRatio);
            }
        }
    }

    private _draw(alpha: number): void {
        const g = this._gfx!;
        g.clear();
        g.lineWidth = 6;
        g.strokeColor = new Color(this._color.r, this._color.g, this._color.b, Math.floor(255 * alpha));
        g.fillColor = new Color(this._color.r, this._color.g, this._color.b, Math.floor(60 * alpha));
        g.circle(0, 0, this._radius);
        g.fill();
        g.stroke();
    }

    update(dt: number): void {
        if (this._done) return;
        this._elapsed += dt;
        const t = Math.min(this._elapsed / this._duration, 1);
        this._draw(1 - t);
        if (t >= 1) {
            this._done = true;
            if (this.node.isValid) this.node.destroy();
        }
    }
}
