import {
    _decorator, Component, EventTouch, Input, UITransform, Vec3,
    Widget,
} from 'cc';
import { findArrowIndex } from '../core/Coord';
import { ArrowRuntime } from '../core/ArrowState';
const { ccclass } = _decorator;

export type ArrowClickHandler = (arrowIndex: number) => void;

/**
 * 输入控制器。挂在 BoardView 节点上，监听 TOUCH_END。
 * 把"触摸坐标"翻译成"箭头索引"，通过回调交给 GameController。
 */
@ccclass('InputController')
export class InputController extends Component {
    private _runtimes: readonly ArrowRuntime[] | null = null;
    private _rows = 0;
    private _cols = 0;
    private _onArrowClick: ArrowClickHandler | null = null;

    /**
     * 由 GameController 调用一次，注入 runtimes 引用和点击回调。
     * runtimes 必须是 GameController 持有的同一个数组引用，
     * 这样箭头位置更新时 InputController 自动看到最新的 coords，不用再同步。
     */
    public setup(
        runtimes: readonly ArrowRuntime[],
        rows: number, cols: number,
        handler: ArrowClickHandler,
    ) {
        this._runtimes = runtimes;
        this._rows = rows;
        this._cols = cols;
        this._onArrowClick = handler;

        this._ensureTouchableSize();
        this.node.on(Input.EventType.TOUCH_START, this._onTouchStart, this);
        this.node.on(Input.EventType.TOUCH_MOVE, this._onTouchMove, this);
        this.node.on(Input.EventType.TOUCH_END, this._onTouchEnd, this);
        this.node.on(Input.EventType.TOUCH_CANCEL, this._onTouchEnd, this);
    }

    private _ensureTouchableSize() {
        if (!this.node.getComponent(UITransform)) {
            this.node.addComponent(UITransform);
        }
        let widget = this.node.getComponent(Widget);
        if (!widget) widget = this.node.addComponent(Widget);
        widget.enabled = true;
        widget.top = 0;
        widget.left = 0;
        widget.right = 0;
        widget.bottom = 0;
        widget.isAlignTop = true;
        widget.isAlignLeft = true;
        widget.isAlignRight = true;
        widget.isAlignBottom = true;
        widget.updateAlignment();
    }

    onDestroy() {
        this.node.off(Input.EventType.TOUCH_START, this._onTouchStart, this);
        this.node.off(Input.EventType.TOUCH_MOVE, this._onTouchMove, this);
        this.node.off(Input.EventType.TOUCH_END, this._onTouchEnd, this);
        this.node.off(Input.EventType.TOUCH_CANCEL, this._onTouchEnd, this);
    }

    private _onTouchEnd(event: EventTouch) {
        if (!this._runtimes || !this._onArrowClick) return;

        const uiLoc = event.getUILocation();
        const world = new Vec3(uiLoc.x, uiLoc.y, 0);
        const ui = this.node.getComponent(UITransform)!;
        const local = ui.convertToNodeSpaceAR(world);

        const idx = findArrowIndex(
            local.x, local.y,
            this._runtimes,
            this._rows, this._cols,
        );
        if (idx < 0) return;
        this._onArrowClick(idx);
    }

    private _onTouchStart(event: EventTouch) {
    }
    private _onTouchMove(event: EventTouch) {
    }
}