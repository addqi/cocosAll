import {
    _decorator, Canvas, Component, EventTouch, Input, UITransform, Vec3,
    Widget,
} from 'cc';
import { findArrowIndex } from '../core/Coord';
import { LevelData } from '../core/LevelData';
const { ccclass } = _decorator;

export type ArrowClickHandler = (arrowIndex: number) => void;

/**
 * 输入控制器。挂在 BoardView 节点上，监听 TOUCH_END。
 * 把"触摸坐标"翻译成"箭头索引"，通过回调交给 GameController。
 */
@ccclass('InputController')
export class InputController extends Component {
    private _data: LevelData | null = null;
    private _onArrowClick: ArrowClickHandler | null = null;

    /** 由 GameController 调用一次，注入关卡数据和点击回调 */
    public setup(data: LevelData, handler: ArrowClickHandler) {
        this._data = data;
        this._onArrowClick = handler;

        this._ensureTouchableSize();
        this.node.on(Input.EventType.TOUCH_START, this._onTouchStart, this);
        this.node.on(Input.EventType.TOUCH_MOVE, this._onTouchMove, this);
        this.node.on(Input.EventType.TOUCH_END, this._onTouchEnd, this);
        this.node.on(Input.EventType.TOUCH_CANCEL, this._onTouchEnd, this);
    }

    private _ensureTouchableSize() {
        if(!this.node.getComponent(UITransform)){
            this.node.addComponent(UITransform);
        }
        let widget = this.node.getComponent(Widget);
        if (!widget) widget = this.node.addComponent(Widget);
        widget.enabled = true;
        widget.top=0;
        widget.left=0;
        widget.right=0;
        widget.bottom=0;
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
        if (!this._data || !this._onArrowClick) return;

        const uiLoc = event.getUILocation();
        const world = new Vec3(uiLoc.x, uiLoc.y, 0);
        const ui = this.node.getComponent(UITransform)!;
        const local = ui.convertToNodeSpaceAR(world);

        const idx = findArrowIndex(
            local.x, local.y,
            this._data.arrows,
            this._data.rows, this._data.cols,
        );
        if (idx < 0) return;
        this._onArrowClick(idx);
    }

    private _onTouchStart(event: EventTouch) {
    }
    private _onTouchMove(event: EventTouch) {
    }

}