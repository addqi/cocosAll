import { _decorator, Component, EventTouch, Node, Vec2 } from 'cc';
import { BoardRuntimeContext } from '../../game/BoardRuntimeContext';

const { ccclass } = _decorator;

/**
 * 挂在 boardRoot：仅当触点未命中子节点（盘面小于屏幕时的留白）时引擎会把事件派到本节点，此时单指拖动为平移视口。
 * 落在 Brush 上的触点仍由 BoardTouchInput 处理（涂色 / 双指捏合）。
 */
@ccclass('BoardRootPanInput')
export class BoardRootPanInput extends Component {
    private _ctx: BoardRuntimeContext | null = null;
    private _prevUi: Vec2 | null = null;

    init(ctx: BoardRuntimeContext): void {
        this._unbind();
        this._ctx = ctx;
        this.node.on(Node.EventType.TOUCH_START, this._onStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this._onMove, this);
        this.node.on(Node.EventType.TOUCH_END, this._onEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this._onEnd, this);
    }

    onDestroy(): void {
        this._unbind();
    }

    private _unbind(): void {
        this.node.off(Node.EventType.TOUCH_START, this._onStart, this);
        this.node.off(Node.EventType.TOUCH_MOVE, this._onMove, this);
        this.node.off(Node.EventType.TOUCH_END, this._onEnd, this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this._onEnd, this);
    }

    private _onStart(e: EventTouch): void {
        const g = e.getTouches();
        if (g && g.length === 1) {
            const loc = e.getUILocation();
            this._prevUi = new Vec2(loc.x, loc.y);
        } else {
            this._prevUi = null;
        }
    }

    private _onMove(e: EventTouch): void {
        const ctx = this._ctx;
        if (!ctx || !this._prevUi) return;
        const g = e.getTouches();
        if (!g || g.length !== 1) return;
        const cur = e.getUILocation();
        const dx = cur.x - this._prevUi.x;
        const dy = cur.y - this._prevUi.y;
        this._prevUi.set(cur.x, cur.y);
        ctx.viewport.panBy(dx, dy);
    }

    private _onEnd(): void {
        this._prevUi = null;
    }
}
