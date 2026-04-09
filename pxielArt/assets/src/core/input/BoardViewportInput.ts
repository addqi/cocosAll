import { _decorator, Component, EventKeyboard, Input, KeyCode, input } from 'cc';
import { GameConfig } from '../../config/GameConfig';
import { BoardRuntimeContext } from '../../game/BoardRuntimeContext';

const { ccclass } = _decorator;

/**
 * 键盘视口：按住 W/S 或 ↑/↓ 连续缩放；H J K L 平移。
 * 触摸逻辑在 BoardTouchInput：点在「色号不对/空格」上拖 = 平移盘面；点在「当前笔号与答案一致」格上拖 = 滑动画笔（与根节点留白平移互补）。
 */
@ccclass('BoardViewportInput')
export class BoardViewportInput extends Component {
    private _ctx: BoardRuntimeContext | null = null;
    /** +1 放大 / -1 缩小 / 0 无 */
    private _zoomDir: 1 | -1 | 0 = 0;
    private _panX: 1 | -1 | 0 = 0;
    private _panY: 1 | -1 | 0 = 0;

    init(ctx: BoardRuntimeContext): void {
        input.off(Input.EventType.KEY_DOWN, this._onKeyDown, this);
        input.off(Input.EventType.KEY_UP, this._onKeyUp, this);
        this._ctx = ctx;
        input.on(Input.EventType.KEY_DOWN, this._onKeyDown, this);
        input.on(Input.EventType.KEY_UP, this._onKeyUp, this);
    }

    onDestroy(): void {
        input.off(Input.EventType.KEY_DOWN, this._onKeyDown, this);
        input.off(Input.EventType.KEY_UP, this._onKeyUp, this);
    }

    update(dt: number): void {
        const ctx = this._ctx;
        if (!ctx || dt <= 0) return;
        if (ctx.viewport.tickSnapBack(dt)) return;
        const speed = GameConfig.viewportArrowPanSpeed;
        if (this._panX !== 0 || this._panY !== 0) {
            ctx.viewport.panBy(this._panX * speed * dt, this._panY * speed * dt);
        }
        if (this._zoomDir !== 0) {
            ctx.viewport.zoomContinuous(dt, this._zoomDir);
        }
    }

    private _onKeyDown(e: EventKeyboard): void {
        const k = e.keyCode;
        if (k === KeyCode.KEY_W || k === KeyCode.ARROW_UP) {
            this._zoomDir = 1;
        } else if (k === KeyCode.KEY_S || k === KeyCode.ARROW_DOWN) {
            this._zoomDir = -1;
        } else if (k === KeyCode.KEY_H) {
            this._panX = -1;
        } else if (k === KeyCode.KEY_L) {
            this._panX = 1;
        } else if (k === KeyCode.KEY_K) {
            this._panY = 1;
        } else if (k === KeyCode.KEY_J) {
            this._panY = -1;
        }
    }

    private _onKeyUp(e: EventKeyboard): void {
        const k = e.keyCode;
        if (k === KeyCode.KEY_W || k === KeyCode.ARROW_UP) {
            if (this._zoomDir === 1) this._zoomDir = 0;
        } else if (k === KeyCode.KEY_S || k === KeyCode.ARROW_DOWN) {
            if (this._zoomDir === -1) this._zoomDir = 0;
        } else if (k === KeyCode.KEY_H) {
            if (this._panX === -1) this._panX = 0;
        } else if (k === KeyCode.KEY_L) {
            if (this._panX === 1) this._panX = 0;
        } else if (k === KeyCode.KEY_K) {
            if (this._panY === 1) this._panY = 0;
        } else if (k === KeyCode.KEY_J) {
            if (this._panY === -1) this._panY = 0;
        }
    }
}
