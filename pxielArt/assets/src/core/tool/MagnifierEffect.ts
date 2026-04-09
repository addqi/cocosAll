import { ToolParams } from '../../config/ToolConfig';
import { CellBrushEntry } from '../../types/types';
import { BoardRuntimeContext } from '../../game/BoardRuntimeContext';

/**
 * 放大镜动画：缩放到目标区域 → 闪烁 N 次 → 结束。
 * 由 BoardViewportInput.update 驱动 tick()。
 */
export class MagnifierEffect {
    private _phase = 0;
    private _targets: CellBrushEntry[] = [];
    private _timer = 0;
    private _blinkCount = 0;
    private _blinkOn = false;

    get active(): boolean { return this._phase > 0; }

    start(targets: CellBrushEntry[], ctx: BoardRuntimeContext): void {
        if (targets.length === 0) return;

        this._targets = targets;
        this._phase = 1;
        this._timer = 0;
        this._blinkCount = 0;
        this._blinkOn = false;

        const focus = targets[0];
        const cw = ctx.cellDisplayW;
        const ch = ctx.cellDisplayH;
        const rows = ctx.boardData.gridRows;
        const bw = ctx.boardData.gridCols * cw;
        const bh = rows * ch;

        const cx = (focus.col + 0.5) * cw - bw / 2;
        const cy = bh / 2 - (rows - 1 - focus.row + 0.5) * ch;

        const vp = ctx.viewport;
        const targetScale = Math.min(vp.maxScale * 0.8, vp.maxScale);
        const targetPanX = -cx * targetScale;
        const targetPanY = -cy * targetScale;

        vp.snapTo(targetScale, targetPanX, targetPanY, ToolParams.magnifierZoomDuration);
    }

    tick(dt: number, ctx: BoardRuntimeContext): void {
        if (this._phase === 0) return;

        if (this._phase === 1) {
            if (!ctx.viewport.tickSnapBack(dt)) {
                this._phase = 2;
                this._timer = ToolParams.magnifierBlinkInterval;
                this._blinkOn = true;
                this._writeBrush(ctx, 100);
            }
            return;
        }

        this._timer -= dt;
        if (this._timer > 0) return;

        if (this._blinkOn) {
            this._blinkOn = false;
            this._blinkCount++;
            this._writeBrush(ctx, 0);
            if (this._blinkCount >= ToolParams.magnifierBlinkCount) {
                this._phase = 0;
                return;
            }
        } else {
            this._blinkOn = true;
            this._writeBrush(ctx, 100);
        }
        this._timer = ToolParams.magnifierBlinkInterval;
    }

    private _writeBrush(ctx: BoardRuntimeContext, alpha: number): void {
        const pb = ctx.brushLayer.pixelBuffer;
        for (const t of this._targets) {
            if (pb.getAlpha(t.row, t.col) === 255) continue;
            if (alpha > 0) {
                const [r, g, b] = ctx.brushState.getRGB(t.brushIndex);
                pb.setPixel(t.row, t.col, r, g, b, alpha);
            } else {
                pb.setPixel(t.row, t.col, 0, 0, 0, 0);
            }
        }
        ctx.brushLayer.flush();
    }
}
