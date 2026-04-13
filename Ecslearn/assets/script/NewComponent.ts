import { _decorator, Collider2D, Component, Contact2DType, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('NewComponent')
export class NewComponent extends Component {
    start() {
        const collider = this.node.getComponent(Collider2D);
        collider.on(Contact2DType.BEGIN_CONTACT, this.oncollisionenter, this);
    }

    update(deltaTime: number) {
        
    }

    oncollisionenter(event: Collider2D) {
        console.log('发生碰撞');
    }
}

