import { _decorator, Canvas, Component, EventTouch, Node, UITransform, Vec2 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('joystick')
export class joystick extends Component {

    /**实例 */
    private static _instance: joystick = null;
    public static get instance(): joystick {
        return this._instance;
    }
    /**摇杆背景 */
    @property(Node)
    private dish: Node;
    /**摇杆 */
    @property(Node)
    private joystick: Node;
    /**方向 */
    public direction: Vec2;
    private maxDistance: number;
    protected onLoad(): void {
        joystick._instance = this;
        this.direction = Vec2.ZERO;
        this.dish.active = false;
        this.joystick.active = true;   
        this.joystick.setPosition(0, 0, 0);
        this.maxDistance = this.dish.getComponent(UITransform).width / 2;

        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }
    onTouchStart(event: EventTouch) {
        this.dish.setWorldPosition(event.getUILocation().x, event.getUILocation().y, 0);
        this.joystick.setPosition(0, 0, 0);
        this.dish.active = true;
        this.joystick.active = true;
        this.direction = new Vec2(0, 0);
    }
    onTouchMove(event: EventTouch) {
        let touchPos = new Vec2(event.getUILocation().x, event.getUILocation().y);
        let dishWorldPos = new Vec2(this.dish.getWorldPosition().x, this.dish.getWorldPosition().y);
        let distance = touchPos.subtract(dishWorldPos);
        if (distance.length() > this.maxDistance) {
            distance.normalize().multiplyScalar(this.maxDistance);
        }
        this.joystick.setPosition(distance.x, distance.y, 0);
        this.direction = distance.normalize().clone();
    }
    onTouchEnd(event: EventTouch) {
        this.joystick.setPosition(0, 0, 0);
        this.dish.active = false;
        this.joystick.active = false;
        this.direction = new Vec2(0, 0);
    }

}


