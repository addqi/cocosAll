import { _decorator, Component, Node, Vec2, Input, EventMouse, Sprite, Color, Label } from 'cc';
import { FlowFieldMgr } from './FlowFieldMgr';
const { ccclass, property } = _decorator;

@ccclass('Box')
export class Box extends Component {

    gridX = 0;
    gridY = 0;
    isBlock = false;

    @property(Node)
    arrowNode: Node = null!;

    @property(Label)
    labelNode: Label = null!;   // 用来显示流场权值

    sprite: Sprite = null!;

    init(x: number, y: number) {
        this.gridX = x;
        this.gridY = y;
    }

    start() {
        this.sprite = this.getComponent(Sprite)!;
        this.node.on(Input.EventType.MOUSE_DOWN, this.onClick, this);
    }

    onClick(event: EventMouse) {
        this.isBlock = !this.isBlock;

        // 修改地图
        FlowFieldMgr.Instance.setBlock(this.gridX, this.gridY, !this.isBlock);

        // 修改颜色
        this.sprite.color = this.isBlock ? Color.BLACK : Color.WHITE;

        // 点击后刷新流场权值显示
        FlowFieldMgr.Instance.updateAllBoxText();
    }

    setDirection(dir: Vec2) {
        if (!this.arrowNode) return;

        if (dir.equals(Vec2.ZERO)) {
            this.arrowNode.active = false;
            return;
        }

        this.arrowNode.active = true;

        const angle = Math.atan2(dir.y, dir.x) * 180 / Math.PI;
        this.arrowNode.setRotationFromEuler(0, 0, angle - 90);
    }

    /** 更新文本显示流场权值 */
    updateText(cost: number) {
        if (!this.labelNode) return;

        this.labelNode.string = cost === Infinity ? '∞' : cost.toString();
    }
}
