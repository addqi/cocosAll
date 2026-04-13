import { Sprite, Material, EffectAsset } from 'cc';
import { ResourceMgr } from '../../baseSystem/resource';

const FLASH_DURATION = 0.12;

export class FlashWhite {
    private _sprite: Sprite;
    private _mat: Material | null = null;
    private _originalMat: Material | null = null;
    private _timer = 0;
    private _active = false;

    constructor(sprite: Sprite) {
        this._sprite = sprite;
    }

    private _ensureMaterial(): boolean {
        if (this._mat) return true;
        const effect = ResourceMgr.inst.get<EffectAsset>('shader/flash-white');
        if (!effect) return false;
        this._mat = new Material();
        this._mat.initialize({ effectAsset: effect, technique: 0 });
        return true;
    }

    flash(duration = FLASH_DURATION): void {
        if (!this._ensureMaterial()) return;
        if (!this._active) {
            this._originalMat = this._sprite.customMaterial;
        }
        this._sprite.customMaterial = this._mat!;
        this._mat!.setProperty('flashIntensity', 1.0);
        this._timer = duration;
        this._active = true;
    }

    tick(dt: number): void {
        if (!this._active) return;
        this._timer -= dt;
        if (this._timer <= 0) {
            this._sprite.customMaterial = this._originalMat;
            this._originalMat = null;
            this._active = false;
            return;
        }
    }

    get isFlashing(): boolean { return this._active; }
}
