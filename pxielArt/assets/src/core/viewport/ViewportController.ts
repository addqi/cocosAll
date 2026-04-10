import { Node, Vec2, view } from 'cc';
import { GameConfig } from '../../config/GameConfig';

export interface ViewportControllerOptions {
    minScale: number;
    maxScale: number;
    zoomStep: number;
    autoFitInitial: boolean;
    boardWidthPx: number;
    boardHeightPx: number;
    zoomSpeedPerSecond: number;
    viewportPadding: number;
    topInset: number;
    bottomInset: number;
    onScaleChanged?: (scale: number) => void;
}

interface SnapState {
    startS: number; startPx: number; startPy: number;
    endS: number; endPx: number; endPy: number;
    elapsed: number; duration: number;
}

/** Content 节点：scale + position；键盘缩放 / 双指捏合 / 平移 + 边界钳制 */
export class ViewportController {
    private _scale: number;
    private readonly _initialScale: number;
    private _panX = 0;
    private _panY = 0;
    private readonly _content: Node;
    private readonly _opts: ViewportControllerOptions;
    private _snap: SnapState | null = null;

    constructor(content: Node, opts: ViewportControllerOptions) {
        this._content = content;
        this._opts = opts;
        let s = 1;
        if (opts.autoFitInitial) {
            s = Math.max(opts.minScale, Math.min(opts.maxScale, opts.minScale));
        } else {
            s = Math.max(opts.minScale, Math.min(opts.maxScale, 1));
        }
        this._initialScale = s;
        this._scale = s;
        this._clampPan();
        this._apply(false);
    }

    get scale(): number { return this._scale; }
    get initialScale(): number { return this._initialScale; }
    get minScale(): number { return this._opts.minScale; }
    get maxScale(): number { return this._opts.maxScale; }

    zoomInStep(): void { this.setScale(this._scale + this._opts.zoomStep); }
    zoomOutStep(): void { this.setScale(this._scale - this._opts.zoomStep); }

    zoomContinuous(dt: number, direction: 1 | -1): void {
        if (dt <= 0) return;
        const f = 1 + direction * this._opts.zoomSpeedPerSecond * dt;
        this.setScale(this._scale * f);
    }

    setScale(s: number): void {
        this.cancelSnap();
        const v = Math.max(this._opts.minScale, Math.min(this._opts.maxScale, s));
        if (Math.abs(v - this._scale) < 1e-6) return;
        this._scale = v;
        this._clampPan();
        this._apply();
    }

    /**
     * 双指一步 — 弹性缩放：不硬夹 [min, max]，允许越界但带橡皮筋阻力。
     * 松手后由 snapBack() 缓动归位。
     */
    applyPinchPanStep(prevDist: number, curDist: number, prevMid: Vec2, curMid: Vec2): void {
        if (prevDist < 1e-4 || curDist < 1e-4) return;
        this.cancelSnap();
        this._panX += curMid.x - prevMid.x;
        this._panY += curMid.y - prevMid.y;

        const ratio = curDist / prevDist;
        let newScale = this._scale * ratio;

        const min = this._opts.minScale;
        const max = this._opts.maxScale;
        const rf = GameConfig.viewportRubberBandFactor;
        if (newScale < min) {
            newScale = min - (min - newScale) * rf;
        } else if (newScale > max) {
            newScale = max + (newScale - max) * rf;
        }
        newScale = Math.max(min * 0.5, Math.min(max * 2, newScale));

        const fx = curMid.x;
        const fy = curMid.y;
        const lx = (fx - this._panX) / this._scale;
        const ly = (fy - this._panY) / this._scale;
        this._scale = newScale;
        this._panX = fx - newScale * lx;
        this._panY = fy - newScale * ly;
        this._apply();
    }

    panBy(deltaX: number, deltaY: number): void {
        this.cancelSnap();
        this._panX += deltaX;
        this._panY += deltaY;
        this._clampPan();
        this._apply();
    }

    /* ── snap-back 弹回 ── */

    snapBack(duration = GameConfig.viewportSnapBackDuration): void {
        const ts = Math.max(this._opts.minScale, Math.min(this._opts.maxScale, this._scale));
        const [tpx, tpy] = this._clampedPanForScale(ts);
        if (Math.abs(ts - this._scale) < 1e-6
            && Math.abs(tpx - this._panX) < 1
            && Math.abs(tpy - this._panY) < 1) {
            this._snap = null;
            this._clampPan();
            this._apply();
            return;
        }
        this._snap = {
            startS: this._scale, startPx: this._panX, startPy: this._panY,
            endS: ts, endPx: tpx, endPy: tpy,
            elapsed: 0, duration,
        };
    }

    snapTo(targetScale: number, targetPanX: number, targetPanY: number, duration: number): void {
        this._snap = {
            startS: this._scale, startPx: this._panX, startPy: this._panY,
            endS: targetScale, endPx: targetPanX, endPy: targetPanY,
            elapsed: 0, duration,
        };
    }

    cancelSnap(): void { this._snap = null; }

    /** 由 Component.update 驱动；返回 true 表示正在弹回中（阻断其他输入） */
    tickSnapBack(dt: number): boolean {
        const st = this._snap;
        if (!st) return false;
        st.elapsed = Math.min(st.elapsed + dt, st.duration);
        let t = st.elapsed / st.duration;
        t = t * (2 - t);
        this._scale = st.startS + (st.endS - st.startS) * t;
        this._panX = st.startPx + (st.endPx - st.startPx) * t;
        this._panY = st.startPy + (st.endPy - st.startPy) * t;
        this._apply();
        if (st.elapsed >= st.duration) this._snap = null;
        return true;
    }

    /* ── 内部 ── */

    private _clampedPanForScale(scale: number): [number, number] {
        const vs = view.getVisibleSize();
        const P = this._opts.viewportPadding;
        const W = this._opts.boardWidthPx * scale;
        const H = this._opts.boardHeightPx * scale;
        const topI = this._opts.topInset;
        const botI = this._opts.bottomInset;
        const availableH = vs.height - topI - botI;
        const centerY = (botI - topI) * 0.5;

        let px = this._panX;
        let py = this._panY;
        if (W > vs.width) {
            const m = (W - vs.width) * 0.5 + P;
            px = Math.max(-m, Math.min(m, px));
        } else {
            px = 0;
        }
        if (H > availableH) {
            const m = (H - availableH) * 0.5 + P;
            py = Math.max(centerY - m, Math.min(centerY + m, py));
        } else {
            py = centerY;
        }
        return [px, py];
    }

    private _clampPan(): void {
        const [px, py] = this._clampedPanForScale(this._scale);
        this._panX = px;
        this._panY = py;
    }

    private _apply(notifyScaleChanged = true): void {
        this._content.setScale(this._scale, this._scale, 1);
        this._content.setPosition(this._panX, this._panY, 0);
        if (notifyScaleChanged) {
            this._opts.onScaleChanged?.(this._scale);
        }
    }
}
