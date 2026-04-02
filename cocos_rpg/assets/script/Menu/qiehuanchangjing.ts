import { _decorator, Component, director, EventTouch, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('qiehuanchangjing')
export class qiehuanchangjing extends Component {
    start() {
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
    }

    update(deltaTime: number) {
        
    }
    async onTouchStart(event: EventTouch) {
        await director.loadScene('game');
        
    }
}


