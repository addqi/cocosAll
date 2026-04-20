import { _decorator, Component, Node, UITransform } from 'cc';
import { RedDotView, RedDotDisplayMode } from './RedDotView';
import { RedDotManager } from './RedDotManager';

const { ccclass } = _decorator;

@ccclass('DemoButton')
export class DemoButton extends Component {
    private _dot: RedDotView | null = null;

    start() {
        // 1. 在按钮右上角创建一个空节点
        const dotNode = new Node('RedDot');
        this.node.addChild(dotNode);
        const ut = this.node.getComponent(UITransform)!;
        dotNode.setPosition(ut.width / 2, ut.height / 2, 0);

        // 2. 挂上 RedDotView 组件
        this._dot = dotNode.addComponent(RedDotView);
        this._dot.setMode(RedDotDisplayMode.NumberOrDot);

        // 3. 视觉测试
        // this._dot.setCount(0);        // 隐藏
        this._dot.setCount(1);     // 纯红点
        // this._dot.setCount(5);     // 胶囊 "5"
        // this._dot.setCount(1000);  // 胶囊 "99+"

        // 4. RedDotManager 冒泡测试（控制台查看输出）
        this._testRedDotManager();
    }

    /**
     * 跑一遍 RedDotManager 的冒泡流程，F12 控制台查看输出。
     * 预期输出已经标注在每次调用下方。
     */
    private _testRedDotManager(): void {
        const mgr = RedDotManager.instance;

        // 先清一遍，避免热重载/重复进入场景时数据残留
        mgr._resetForTest();

        mgr.register('home.level.l1');
        mgr.register('home.level.l2');
        mgr.register('home.mail.m1');

        // 订阅：subscribe 那一刻会立即派发初始值（0）
        mgr.subscribe('home', (n) => console.log(`home: ${n}`));
        mgr.subscribe('home.level', (n) => console.log(`home.level: ${n}`));
        // 预期立即输出：
        //   home: 0
        //   home.level: 0

        mgr.setSelfCount('home.level.l1', 1);
        // 预期输出：
        //   home.level: 1
        //   home: 1

        mgr.setSelfCount('home.level.l2', 3);
        // 预期输出：
        //   home.level: 4
        //   home: 4

        mgr.setSelfCount('home.mail.m1', 2);
        // 预期输出：
        //   home: 6
        //   （home.level 没变，不被通知）

        mgr.setSelfCount('home.level.l1', 0);
        // 预期输出：
        //   home.level: 3
        //   home: 5
    }
}