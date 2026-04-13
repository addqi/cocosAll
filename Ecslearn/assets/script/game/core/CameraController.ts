import { Camera, Node, Vec3, director, misc } from 'cc';

const _tmpV3 = new Vec3();

export class CameraController {
    private static _inst: CameraController | null = null;
    static get inst(): CameraController {
        if (!this._inst) this._inst = new CameraController();
        return this._inst;
    }

    private _cam: Camera | null = null;
    private _followTarget: Node | null = null;
    private _followSmooth = 5;
    private _followOffset = new Vec3(0, 0, 0);

    private _shakeTimer = 0;
    private _shakeIntensity = 0;
    private _shakeFreq = 30;
    private _preShakePos = new Vec3();

    private _targetZoom = 1;
    private _currentZoom = 1;
    private _zoomSpeed = 3;

    get camera(): Camera | null {
        if (this._cam?.node.isValid) return this._cam;
        this._cam = director.getScene()?.getComponentInChildren(Camera) ?? null;
        return this._cam;
    }

    // ─── Follow ───────────────────────────────────

    setFollowTarget(target: Node | null, smooth = 5): void {
        this._followTarget = target;
        this._followSmooth = smooth;
    }

    setFollowOffset(x: number, y: number): void {
        this._followOffset.set(x, y, 0);
    }

    // ─── Shake ────────────────────────────────────

    shake(intensity = 4, duration = 0.15, freq = 30): void {
        this._shakeIntensity = intensity;
        this._shakeTimer = duration;
        this._shakeFreq = freq;
    }

    // ─── Zoom ─────────────────────────────────────

    setZoom(orthoHeight: number): void {
        this._targetZoom = orthoHeight;
        this._currentZoom = orthoHeight;
        const cam = this.camera;
        if (cam) cam.orthoHeight = orthoHeight;
    }

    zoomTo(orthoHeight: number, speed = 3): void {
        this._targetZoom = orthoHeight;
        this._zoomSpeed = speed;
    }

    // ─── Tick ─────────────────────────────────────

    tick(dt: number): void {
        const cam = this.camera;
        if (!cam) return;

        this._tickFollow(cam, dt);
        this._tickShake(cam, dt);
        this._tickZoom(cam, dt);
    }

    private _tickFollow(cam: Camera, dt: number): void {
        if (!this._followTarget?.isValid) return;
        const target = this._followTarget.worldPosition;
        const camPos = cam.node.worldPosition;

        const tx = target.x + this._followOffset.x;
        const ty = target.y + this._followOffset.y;

        const alpha = 1 - Math.exp(-this._followSmooth * dt);
        _tmpV3.set(
            camPos.x + (tx - camPos.x) * alpha,
            camPos.y + (ty - camPos.y) * alpha,
            camPos.z,
        );
        cam.node.setWorldPosition(_tmpV3);
    }

    private _tickShake(cam: Camera, dt: number): void {
        if (this._shakeTimer <= 0) return;

        this._shakeTimer -= dt;
        if (this._shakeTimer <= 0) {
            this._shakeTimer = 0;
            return;
        }

        const t = performance.now() * 0.001 * this._shakeFreq;
        const ox = Math.sin(t * 7.13) * this._shakeIntensity;
        const oy = Math.cos(t * 5.71) * this._shakeIntensity;

        const pos = cam.node.worldPosition;
        _tmpV3.set(pos.x + ox, pos.y + oy, pos.z);
        cam.node.setWorldPosition(_tmpV3);
    }

    private _tickZoom(cam: Camera, dt: number): void {
        if (Math.abs(this._currentZoom - this._targetZoom) < 0.01) return;
        this._currentZoom += (this._targetZoom - this._currentZoom) * Math.min(1, this._zoomSpeed * dt);
        cam.orthoHeight = this._currentZoom;
    }
}
