import { Node, Vec2, view } from 'cc';

export interface ViewportControllerOptions {
    minScale: number;
    maxScale: number;
    zoomStep: number;
    /** 为 true 时初始缩放为 minScale（由外部按整盘适配算好） */
    autoFitInitial: boolean;
    boardWidthPx: number;
    boardHeightPx: number;
    /** 对齐 G15：scale *= (1 ± zoomSpeedPerSecond * dt) */
    zoomSpeedPerSecond: number;
    /** 平移时允许露出屏幕外的边距（像素），防止盘面被拖没 */
    viewportPadding: number;
    onScaleChanged?: (scale: number) => void;
}

/** Content 节点：scale + position；键盘缩放 / 双指捏合 / 平移 + 边界钳制 */
export class ViewportController {
    private _scale: number;
    /** 进入游戏时的 content 缩放 */
    private readonly _initialScale: number;
    private _panX = 0;
    private _panY = 0;
    private readonly _content: Node;
    private readonly _opts: ViewportControllerOptions;

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
        this._panX = 0;
        this._panY = 0;
        this._clampPan();
        /** 构造阶段 BoardBootstrap 的 ctx 尚未赋值，勿触发 onScaleChanged */
        this._apply(false);
    }

    get scale(): number {
        return this._scale;
    }

    /** 进入游戏时的 content 缩放 */
    get initialScale(): number {
        return this._initialScale;
    }

    get minScale(): number {
        return this._opts.minScale;
    }

    get maxScale(): number {
        return this._opts.maxScale;
    }

    /** 点按一下（可选保留） */
    zoomInStep(): void {
        this.setScale(this._scale + this._opts.zoomStep);
    }

    zoomOutStep(): void {
        this.setScale(this._scale - this._opts.zoomStep);
    }

    /** 按住键时连续缩放（G15_FBase_KeyboardLogic：scale * (1 ± speed*dt)） */
    zoomContinuous(dt: number, direction: 1 | -1): void {
        if (dt <= 0) return;
        const f = 1 + direction * this._opts.zoomSpeedPerSecond * dt;
        this.setScale(this._scale * f);
    }

    setScale(s: number): void {
        const v = Math.max(this._opts.minScale, Math.min(this._opts.maxScale, s));
        if (Math.abs(v - this._scale) < 1e-6) return;
        this._scale = v;
        this._clampPan();
        this._apply();
    }

    /**
     * 双指一步：先按中点平移，再绕当前中点缩放（prevDist→curDist），最后钳制。
     * 中点坐标为 boardRoot（Content 父节点）下的本地坐标。
     */
    applyPinchPanStep(prevDist: number, curDist: number, prevMid: Vec2, curMid: Vec2): void {
        if (prevDist < 1e-4 || curDist < 1e-4) return;
        this._panX += curMid.x - prevMid.x;
        this._panY += curMid.y - prevMid.y;
        const ratio = curDist / prevDist;
        let newScale = this._scale * ratio;
        newScale = Math.max(this._opts.minScale, Math.min(this._opts.maxScale, newScale));
        const fx = curMid.x;
        const fy = curMid.y;
        const lx = (fx - this._panX) / this._scale;
        const ly = (fy - this._panY) / this._scale;
        this._scale = newScale;
        this._panX = fx - newScale * lx;
        this._panY = fy - newScale * ly;
        this._clampPan();
        this._apply();
    }

    /** 单帧平移（箭头键等），delta 为 boardRoot 本地空间像素 */
    panBy(deltaX: number, deltaY: number): void {
        this._panX += deltaX;
        this._panY += deltaY;
        this._clampPan();
        this._apply();
    }

    /**
     * 与 G15_FBase_OffsetClampFunction 一致：
     * - 缩放后盘面大于视口：偏移限制在 ±((W-V)/2 + padding)，保证盘面仍能盖住可视区
     * - 否则：强制居中（0），避免整盘可见时无意义拖动
     */
    private _clampPan(): void {
        const vs = view.getVisibleSize();
        const P = this._opts.viewportPadding;
        const W = this._opts.boardWidthPx * this._scale;
        const H = this._opts.boardHeightPx * this._scale;
        const Vw = vs.width;
        const Vh = vs.height;

        if (W > Vw) {
            const maxOX = (W - Vw) * 0.5 + P;
            this._panX = Math.max(-maxOX, Math.min(maxOX, this._panX));
        } else {
            this._panX = 0;
        }

        if (H > Vh) {
            const maxOY = (H - Vh) * 0.5 + P;
            this._panY = Math.max(-maxOY, Math.min(maxOY, this._panY));
        } else {
            this._panY = 0;
        }
    }

    private _apply(notifyScaleChanged = true): void {
        this._content.setScale(this._scale, this._scale, 1);
        this._content.setPosition(this._panX, this._panY, 0);
        if (notifyScaleChanged) {
            this._opts.onScaleChanged?.(this._scale);
        }
    }
}
