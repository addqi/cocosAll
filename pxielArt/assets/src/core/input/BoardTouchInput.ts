import { _decorator, Component, EventTouch, Node, Touch, UITransform, Vec2, Vec3 } from 'cc';
import { GameConfig } from '../../config/GameConfig';
import { ToolType } from '../../config/ToolConfig';
import { BoardRuntimeContext } from '../../game/BoardRuntimeContext';
import { ToolExecutor } from '../tool/ToolExecutor';
import {
    PaintSnapSession,
    cellFilled,
    cellHitAllowsDraw,
    collectPaintCellsDDA,
    filterPaintPathToBrush,
} from '../paint/PaintSnapRules';

const { ccclass } = _decorator;

/** 设为 false 可关闭本文件内所有调试打印 */
const BOARD_TOUCH_DEBUG = true;
function btLog(...args: unknown[]): void {
    if (BOARD_TOUCH_DEBUG) console.log('[BoardTouch]', ...args);
}

/**
 * 涂色 / 视口手势 — 对齐 G15_FBase：
 * - TouchStart：CellHitTest（吸附 + 未填 + 笔号对）→ 绘制模式；否则平移模式。
 * - TouchMove：绘制模式 → DDA 收集 + 路径过滤 + PaintLogic；平移模式 → moved 过阈值后 ViewportDrag。
 * - TouchEnd：点按可上半透明（非匹配格），见 TouchEndPaintRouteLogic。
 * - 双指：捏合 + 中点平移。
 */
@ccclass('BoardTouchInput')
export class BoardTouchInput extends Component {
    private _ctx: BoardRuntimeContext | null = null;
    private readonly _activeTouchIds = new Set<number>();
    private readonly _snapSession = new PaintSnapSession();
    private readonly _pending: import('../../types/types').CellBrushEntry[] = [];

    /** 对齐 G15 rt.hited：touchstart 时是否进入绘制模式 */
    private _drawMode = false;
    private _moved = false;
    private _paintStarted = false;
    private _hasLastPaintPos = false;
    private _lastPaintX = 0;
    private _lastPaintY = 0;
    private _gestureStartUi = new Vec2();
    private _panPrevUi: Vec2 | null = null;

    private _pinchSession = false;
    private _pinchPrevMid: Vec2 | null = null;
    private _pinchPrevDist = 0;

    init(ctx: BoardRuntimeContext): void {
        this._unbind();
        this._ctx = ctx;
        this.node.on(Node.EventType.TOUCH_START, this._onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this._onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this._onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this._onTouchCancel, this);
    }

    onDestroy(): void {
        this._unbind();
    }

    private _unbind(): void {
        this.node.off(Node.EventType.TOUCH_START, this._onTouchStart, this);
        this.node.off(Node.EventType.TOUCH_MOVE, this._onTouchMove, this);
        this.node.off(Node.EventType.TOUCH_END, this._onTouchEnd, this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this._onTouchCancel, this);
    }

    private _uiToBoardRoot(ui: Vec2): Vec2 {
        const ctx = this._ctx!;
        const ut = ctx.boardRoot.getComponent(UITransform)!;
        const local = ut.convertToNodeSpaceAR(new Vec3(ui.x, ui.y, 0));
        return new Vec2(local.x, local.y);
    }

    private _brushLocalFromTouch(t: Touch): Vec2 {
        const ut = this.node.getComponent(UITransform)!;
        const loc = t.getUILocation();
        const l = ut.convertToNodeSpaceAR(new Vec3(loc.x, loc.y, 0));
        return new Vec2(l.x, l.y);
    }

    private _cellFromTouch(t: Touch): import('../../types/types').CellPosition | null {
        const ctx = this._ctx;
        if (!ctx) return null;
        const l = this._brushLocalFromTouch(t);
        return ctx.cellConverter.pointerToCell(l.x, l.y, 0, 0, 1);
    }

    private _touchInsideBrush(t: Touch): boolean {
        const ut = this.node.getComponent(UITransform);
        if (!ut) return false;
        const l = this._brushLocalFromTouch(t);
        const hw = ut.width * 0.5;
        const hh = ut.height * 0.5;
        return l.x >= -hw && l.x <= hw && l.y >= -hh && l.y <= hh;
    }

    private _brushTouches(list: readonly Touch[]): Touch[] {
        const out: Touch[] = [];
        for (let i = 0; i < list.length; i++) {
            if (this._touchInsideBrush(list[i])) out.push(list[i]);
        }
        return out;
    }

    private _touchList(event: EventTouch): readonly Touch[] {
        const g = event.getTouches();
        return g && g.length > 0 ? g : event.touch ? [event.touch] : [];
    }

    private _onTouchStart(event: EventTouch): void {
        const ctx = this._ctx;
        if (!ctx) return;
        const t = event.touch;
        if (t) this._activeTouchIds.add(t.getID());

        const list = this._touchList(event);

        if (this._pinchSession) {
            const active = this._getActiveTouches(list);
            if (active.length >= 2) this._resetPinchBaseline(active);
            return;
        }

        const bt = this._brushTouches(list);
        if (bt.length >= 2) {
            btLog('TOUCH_START → 分支: 双指捏合');
            this._pinchSession = true;
            this._snapSession.reset();
            this._resetPaintGesture();
            ctx.paintExecutor.clearEntries();
            ctx.viewport.cancelSnap();
            this._resetPinchBaseline(bt);
            return;
        }

        if (bt.length === 1) {
            ctx.viewport.cancelSnap();
            ctx.paintExecutor.clearEntries();
            this._snapSession.reset();
            this._paintStarted = false;
            this._hasLastPaintPos = false;
            this._moved = false;

            const loc = this._brushLocalFromTouch(bt[0]);
            const brushIdx = ctx.brushState.currentIndex;
            const scale = ctx.viewport.scale;
            const cols = ctx.boardData.gridCols;
            const rows = ctx.boardData.gridRows;
            const cw = ctx.cellDisplayW;
            const ch = ctx.cellDisplayH;

            const snapPos = this._snapSession.snap(
                loc.x,
                loc.y,
                scale,
                brushIdx,
                cols,
                rows,
                cw,
                ch,
                ctx.boardData,
                ctx.brushLayer.pixelBuffer,
                GameConfig.correctCellExpandPx,
                false,
            );
            this._drawMode = cellHitAllowsDraw(snapPos, ctx.boardData, ctx.brushLayer.pixelBuffer, brushIdx);

            const ui = bt[0].getUILocation();
            this._gestureStartUi.set(ui.x, ui.y);
            this._panPrevUi = new Vec2(ui.x, ui.y);

            if (this._drawMode) {
                this._lastPaintX = loc.x;
                this._lastPaintY = loc.y;
                this._hasLastPaintPos = true;
            }

            const rawCell = ctx.cellConverter.pointerToCell(loc.x, loc.y, 0, 0, 1);
            btLog(
                'TOUCH_START → 分支: 单指 | drawMode=',
                this._drawMode,
                '(绘制)',
                '| snapPos=',
                snapPos,
                '| rawCell=',
                rawCell,
                '| UI=',
                ui.x.toFixed(0),
                ui.y.toFixed(0),
            );
        }
    }

    private _resetPaintGesture(): void {
        this._drawMode = false;
        this._moved = false;
        this._paintStarted = false;
        this._hasLastPaintPos = false;
        this._panPrevUi = null;
    }

    private _onTouchMove(event: EventTouch): void {
        const ctx = this._ctx;
        if (!ctx) return;

        const list = this._touchList(event);

        if (this._pinchSession) {
            const active = this._getActiveTouches(list);
            if (active.length >= 2) this._handlePinchMove(active[0], active[1], ctx);
            return;
        }

        const bt = this._brushTouches(list);
        if (bt.length >= 2) {
            btLog('TOUCH_MOVE → 双指进入捏合');
            this._pinchSession = true;
            this._snapSession.reset();
            this._resetPaintGesture();
            ctx.paintExecutor.clearEntries();
            ctx.viewport.cancelSnap();
            this._handlePinchMove(bt[0], bt[1], ctx);
            return;
        }

        if (bt.length !== 1) {
            btLog('TOUCH_MOVE → 忽略: brush 上有效触点数=', bt.length, '(非 1)');
            return;
        }

        const thr = GameConfig.moveThreshold;
        const curUi = bt[0].getUILocation();
        const ox = curUi.x - this._gestureStartUi.x;
        const oy = curUi.y - this._gestureStartUi.y;

        if (!this._drawMode) {
            btLog(
                'TOUCH_MOVE → 分支: 平移模式(drawMode=false) | UI=',
                curUi.x.toFixed(0),
                curUi.y.toFixed(0),
                '| 相对起点 dx,dy=',
                ox.toFixed(1),
                oy.toFixed(1),
                '| threshold=',
                thr,
                '| _moved=',
                this._moved,
            );
            if (!this._panPrevUi) this._panPrevUi = new Vec2(curUi.x, curUi.y);
            if (!this._moved) {
                if (Math.abs(ox) < thr && Math.abs(oy) < thr) {
                    btLog('TOUCH_MOVE → 平移: 未过阈值，等待滑动');
                    this._panPrevUi.set(curUi.x, curUi.y);
                    return;
                }
                this._moved = true;
                btLog('TOUCH_MOVE → 平移: 已过阈值，开始跟手移动');
            }
            const dx = curUi.x - this._panPrevUi.x;
            const dy = curUi.y - this._panPrevUi.y;
            const cx = ctx.contentNode;
            const bx = cx.position.x;
            const by = cx.position.y;
            btLog(
                'TOUCH_MOVE → 平移: 移动前 Content 本地坐标 position=',
                `(${bx.toFixed(2)}, ${by.toFixed(2)})`,
                '| 本帧 delta UI=',
                `(${dx.toFixed(2)}, ${dy.toFixed(2)})`,
            );
            ctx.viewport.panBy(dx, dy);
            this._panPrevUi.set(curUi.x, curUi.y);
            btLog(
                'TOUCH_MOVE → 平移: 移动后 Content 本地坐标 position=',
                `(${cx.position.x.toFixed(2)}, ${cx.position.y.toFixed(2)})`,
            );
            return;
        }

        btLog(
            'TOUCH_MOVE → 分支: 绘制模式(drawMode=true) | UI=',
            curUi.x.toFixed(0),
            curUi.y.toFixed(0),
        );

        if (!this._moved) {
            if (Math.abs(ox) < thr && Math.abs(oy) < thr) {
                btLog('TOUCH_MOVE → 绘制: 未过绘制阈值，跳过');
                return;
            }
            this._moved = true;
            btLog('TOUCH_MOVE → 绘制: 已过阈值');
        }

        const loc = this._brushLocalFromTouch(bt[0]);
        const rawCell = ctx.cellConverter.pointerToCell(loc.x, loc.y, 0, 0, 1);
        if (!rawCell || cellFilled(ctx.boardData, ctx.brushLayer.pixelBuffer, rawCell.row, rawCell.col)) {
            btLog(
                'TOUCH_MOVE → 绘制: 提前 return | rawCell=',
                rawCell,
                '| reason=',
                !rawCell ? '无格(null)' : 'cellFilled(空格或已填)',
            );
            return;
        }

        const brushIdx = ctx.brushState.currentIndex;
        const scale = ctx.viewport.scale;
        const cols = ctx.boardData.gridCols;
        const rows = ctx.boardData.gridRows;
        const cw = ctx.cellDisplayW;
        const ch = ctx.cellDisplayH;

        const snapPos = this._snapSession.snap(
            loc.x,
            loc.y,
            scale,
            brushIdx,
            cols,
            rows,
            cw,
            ch,
            ctx.boardData,
            ctx.brushLayer.pixelBuffer,
            GameConfig.correctCellExpandPx,
            this._paintStarted,
        );
        if (!snapPos) {
            btLog('TOUCH_MOVE → 绘制: 提前 return | snap()=null');
            return;
        }

        collectPaintCellsDDA(
            this._hasLastPaintPos,
            this._lastPaintX,
            this._lastPaintY,
            loc.x,
            loc.y,
            brushIdx,
            cols,
            rows,
            cw,
            ch,
            ctx.boardData,
            ctx.brushLayer.pixelBuffer,
            this._pending,
        );

        this._lastPaintX = loc.x;
        this._lastPaintY = loc.y;
        this._hasLastPaintPos = true;

        let hasTarget = false;
        for (let i = 0; i < this._pending.length; i++) {
            if (this._pending[i].row === snapPos.row && this._pending[i].col === snapPos.col) {
                hasTarget = true;
                break;
            }
        }
        if (!hasTarget) {
            this._pending.push({ row: snapPos.row, col: snapPos.col, brushIndex: brushIdx });
        }

        filterPaintPathToBrush(this._pending, snapPos, ctx.boardData, brushIdx);
        if (this._pending.length === 0) {
            btLog('TOUCH_MOVE → 绘制: 提前 return | filter 后 pending 为空');
            return;
        }

        btLog('TOUCH_MOVE → 绘制: paintCells 数量=', this._pending.length, 'snapPos=', snapPos);
        ctx.paintExecutor.paintCells(this._pending);
        ctx.flushPaintLayers();
        this._paintStarted = true;
    }

    private _onTouchEnd(event: EventTouch): void {
        const ctx = this._ctx;
        if (!ctx) return;
        const t = event.touch;
        if (t) this._activeTouchIds.delete(t.getID());

        if (this._pinchSession) {
            if (this._activeTouchIds.size >= 2) {
                const list = this._touchList(event);
                const active = this._getActiveTouches(list);
                if (active.length >= 2) this._resetPinchBaseline(active);
                return;
            }
            ctx.viewport.snapBack();
            this._pinchSession = false;
            this._resetPinchBaseline(null);
            this._resetPaintGesture();
            this._snapSession.reset();
            return;
        }

        if (this._activeTouchIds.size > 0) return;

        if (!this._moved && t) {
            if (this._tryExecuteTool(ctx, t)) {
                this._resetPaintGesture();
                this._snapSession.reset();
                return;
            }

            const loc = this._brushLocalFromTouch(t);
            const brushIdx = ctx.brushState.currentIndex;
            const scale = ctx.viewport.scale;
            const cols = ctx.boardData.gridCols;
            const rows = ctx.boardData.gridRows;
            const cw = ctx.cellDisplayW;
            const ch = ctx.cellDisplayH;

            const snapPos = this._snapSession.snap(
                loc.x,
                loc.y,
                scale,
                brushIdx,
                cols,
                rows,
                cw,
                ch,
                ctx.boardData,
                ctx.brushLayer.pixelBuffer,
                GameConfig.correctCellExpandPx,
                this._paintStarted,
            );
            let pos = snapPos;
            if (!pos) pos = this._cellFromTouch(t);
            if (pos && !cellFilled(ctx.boardData, ctx.brushLayer.pixelBuffer, pos.row, pos.col)) {
                ctx.paintExecutor.paintCells([{ row: pos.row, col: pos.col, brushIndex: brushIdx }]);
                ctx.flushPaintLayers();
            }
        }

        ctx.saveManager.commitMatchedEntries(
            ctx.paintExecutor.entries,
            ctx.boardData.gridCols,
        );

        this._resetPaintGesture();
        this._snapSession.reset();
    }

    private _onTouchCancel(event: EventTouch): void {
        this._onTouchEnd(event);
    }

    private _getActiveTouches(list: readonly Touch[]): Touch[] {
        const out: Touch[] = [];
        for (let i = 0; i < list.length; i++) {
            if (this._activeTouchIds.has(list[i].getID())) out.push(list[i]);
        }
        return out;
    }

    private _handlePinchMove(t0: Touch, t1: Touch, ctx: BoardRuntimeContext): void {
        const l0 = t0.getUILocation();
        const l1 = t1.getUILocation();
        const midUi = new Vec2((l0.x + l1.x) * 0.5, (l0.y + l1.y) * 0.5);
        const dist = Vec2.distance(l0, l1);
        const midRoot = this._uiToBoardRoot(midUi);

        if (!this._pinchPrevMid || this._pinchPrevDist < 1e-4) {
            this._pinchPrevMid = midRoot.clone();
            this._pinchPrevDist = dist;
            return;
        }

        ctx.viewport.applyPinchPanStep(this._pinchPrevDist, dist, this._pinchPrevMid, midRoot);
        this._pinchPrevMid = midRoot;
        this._pinchPrevDist = dist;
    }

    private _resetPinchBaseline(twoTouches: readonly Touch[] | null): void {
        if (!twoTouches || twoTouches.length < 2) {
            this._pinchPrevMid = null;
            this._pinchPrevDist = 0;
            return;
        }
        const l0 = twoTouches[0].getUILocation();
        const l1 = twoTouches[1].getUILocation();
        const midUi = new Vec2((l0.x + l1.x) * 0.5, (l0.y + l1.y) * 0.5);
        this._pinchPrevMid = this._uiToBoardRoot(midUi);
        this._pinchPrevDist = Vec2.distance(l0, l1);
    }

    private _tryExecuteTool(ctx: BoardRuntimeContext, t: Touch): boolean {
        const ts = ctx.toolState;
        const activeType = ts.activeType;
        if (activeType === ToolType.None) return false;

        const cell = this._cellFromTouch(t);
        if (!cell) { ts.deactivate(); return true; }

        const isFilled = (r: number, c: number) =>
            cellFilled(ctx.boardData, ctx.brushLayer.pixelBuffer, r, c);

        let pending: import('../../types/types').CellBrushEntry[] = [];
        if (activeType === ToolType.MagicWand) {
            pending = ToolExecutor.magicWand(cell.row, cell.col, ctx.boardData, isFilled);
        } else if (activeType === ToolType.Bomb) {
            pending = ToolExecutor.bomb(cell.row, cell.col, ctx.boardData, isFilled);
        }

        if (pending.length > 0) {
            ts.consume(activeType);
            ctx.paintExecutor.paintCells(pending);
            ctx.flushPaintLayers();
            ctx.saveManager.commitMatchedEntries(ctx.paintExecutor.entries, ctx.boardData.gridCols);
        } else {
            ctx.onToast?.('该区域已涂完');
        }
        ts.deactivate();
        return true;
    }
}
