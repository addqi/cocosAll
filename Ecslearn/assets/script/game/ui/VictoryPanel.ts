import {
    _decorator, Component, Node, Color, Label, Sprite, UITransform, Widget, Size,
} from 'cc';
import { getWhiteSF } from './UiAtlas';

const { ccclass } = _decorator;

/**
 * Victory 面板（极简）—— 5 波清完时由 LevelManager 显示
 * 设计简单：没有"再来一局"按钮（MVP 阶段刷新页面重开）
 */
@ccclass('VictoryPanel')
export class VictoryPanel extends Component {

    onLoad(): void {
        this._build();
        this.node.active = false;
    }

    show(): void {
        this.node.active = true;
    }

    private _build(): void {
        const widget = this.node.addComponent(Widget);
        widget.isAlignTop = widget.isAlignBottom = true;
        widget.isAlignLeft = widget.isAlignRight = true;
        widget.top = widget.bottom = widget.left = widget.right = 0;

        // 金色半透明遮罩
        const dim = new Node('Dim');
        this.node.addChild(dim);
        const dw = dim.addComponent(Widget);
        dw.isAlignTop = dw.isAlignBottom = true;
        dw.isAlignLeft = dw.isAlignRight = true;
        dw.top = dw.bottom = dw.left = dw.right = 0;
        const sp = dim.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.spriteFrame = getWhiteSF();
        sp.color = new Color(40, 30, 0, 200);

        // Victory 文字
        const title = new Node('Title');
        this.node.addChild(title);
        const tut = title.addComponent(UITransform);
        tut.setContentSize(new Size(600, 100));
        const lbl = title.addComponent(Label);
        lbl.fontSize = 72;
        lbl.lineHeight = 90;
        lbl.color = new Color(255, 220, 80, 255);
        lbl.string = '🏆 Victory';
        lbl.enableOutline = true;
        lbl.outlineColor = new Color(60, 40, 0, 255);
        lbl.outlineWidth = 4;

        // 副标题
        const sub = new Node('Sub');
        this.node.addChild(sub);
        sub.setPosition(0, -80, 0);
        const sut = sub.addComponent(UITransform);
        sut.setContentSize(new Size(600, 60));
        const slbl = sub.addComponent(Label);
        slbl.fontSize = 28;
        slbl.lineHeight = 36;
        slbl.color = new Color(240, 240, 240, 255);
        slbl.string = '刷新页面以再战一局';
    }
}
