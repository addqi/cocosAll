import { _decorator, Component, Sprite, SpriteFrame, UITransform, Size, Vec3, Texture2D, view, Camera, director } from 'cc';
import { ResourceMgr } from '../../baseSystem/resource';
import { QuadBezier } from '../../baseSystem/math';
import { ProjectilePool } from './ProjectilePool';

const { ccclass } = _decorator;

const _tmpPos = new Vec3();
const _tmpTan = new Vec3();
const RAD2DEG = 180 / Math.PI;

@ccclass('ArrowProjectile')
export class ArrowProjectile extends Component {
    private _curve: QuadBezier | null = null;
    private _duration = 1;
    private _elapsed = 0;
    private _hasTarget = false;
    private _onHit: (() => void) | null = null;
    private _inited = false;

    init(
        curve: QuadBezier,
        duration: number,
        hasTarget: boolean,
        width: number, height: number,
        texturePath: string,
        onHit?: () => void,
    ) {
        this._curve = curve;
        this._duration = duration;
        this._elapsed = 0;
        this._hasTarget = hasTarget;
        this._onHit = onHit ?? null;
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
    }

    update(dt: number) {
        if (!this._inited || !this._curve) return;

        this._elapsed += dt;
        const t = Math.min(this._elapsed / this._duration, 1);

        this._curve.getPoint(t, _tmpPos);
        this.node.setWorldPosition(_tmpPos);

        this._curve.getTangent(t, _tmpTan);
        this._applyRotation(_tmpTan);

        if (t >= 1) {
            if (this._hasTarget) this._onHit?.();
            ProjectilePool.release(this.node);
            return;
        }

        if (this._isOutOfScreen()) {
            ProjectilePool.release(this.node);
        }
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
