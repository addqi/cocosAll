import {
    _decorator, Button, Color, Component, Label, Node, Sprite, UITransform, view, Widget,
} from 'cc';
import { getWhitePixelSF } from '../../util/WhitePixel';

const { ccclass } = _decorator;

export interface WinDialogActions {
    /** 再来一次：重洗当前关卡 */
    onRetry: () => void;
    /** 下一关：null 表示当前是最后一关，"下一关"按钮置灰 */
    onNext: (() => void) | null;
    /** 返回首页 */
    onBack: () => void;
}

/**
 * 胜利结算弹窗。
 *
 * 静态用法：
 *   WinDialog.show(parent, levelName, { onRetry, onNext, onBack });
 *
 * 设计：
 *   - 全屏遮罩吃事件
 *   - 中央卡片：标题 "完成！" + 副标题（关卡名）+ 三按钮
 *   - "下一关" 在最后一关时灰色不可点——这是"消除特殊情况"在 UI 上的体现：
 *     不弹隐藏按钮，永远三个按钮在固定位置，靠 interactable + 灰底标记不可用
 *
 * 不持有任何业务状态——只把用户选择透过回调返出去。
 * 调用方关闭窗口的方式：回调里调用 dialog.node.destroy()——但更省事的是
 * 我们在按钮 onClick 内部先 destroy，再调用回调，让调用方专心做路由。
 */
@ccclass('WinDialog')
export class WinDialog extends Component {

    static show(parent: Node, levelName: string, actions: WinDialogActions): WinDialog {
        const node = new Node('WinDialog');
        parent.addChild(node);
        const dlg = node.addComponent(WinDialog);
        dlg._init(levelName, actions);
        return dlg;
    }

    private _init(levelName: string, actions: WinDialogActions): void {
        const vs = view.getVisibleSize();
        const sf = getWhitePixelSF();

        this.node.addComponent(UITransform).setContentSize(vs.width, vs.height);
        const w = this.node.addComponent(Widget);
        w.isAlignTop = w.isAlignBottom = w.isAlignLeft = w.isAlignRight = true;
        w.top = w.bottom = w.left = w.right = 0;
        w.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;

        const mask = new Node('Mask');
        this.node.addChild(mask);
        mask.addComponent(UITransform).setContentSize(vs.width, vs.height);
        const ms = mask.addComponent(Sprite);
        ms.sizeMode = Sprite.SizeMode.CUSTOM;
        ms.type = Sprite.Type.SIMPLE;
        ms.spriteFrame = sf;
        ms.color = new Color(0, 0, 0, 180);
        const maskBtn = mask.addComponent(Button);
        maskBtn.target = mask;
        maskBtn.transition = Button.Transition.NONE;

        const card = new Node('Card');
        this.node.addChild(card);
        card.addComponent(UITransform).setContentSize(560, 420);
        const cs = card.addComponent(Sprite);
        cs.sizeMode = Sprite.SizeMode.CUSTOM;
        cs.type = Sprite.Type.SIMPLE;
        cs.spriteFrame = sf;
        cs.color = new Color(255, 255, 255, 255);

        const titleNode = new Node('Title');
        card.addChild(titleNode);
        titleNode.setPosition(0, 150, 0);
        titleNode.addComponent(UITransform).setContentSize(520, 60);
        const tl = titleNode.addComponent(Label);
        tl.string = '完成！';
        tl.fontSize = 48;
        tl.horizontalAlign = Label.HorizontalAlign.CENTER;
        tl.verticalAlign = Label.VerticalAlign.CENTER;
        tl.color = new Color(76, 175, 80, 255);

        const nameNode = new Node('LevelName');
        card.addChild(nameNode);
        nameNode.setPosition(0, 80, 0);
        nameNode.addComponent(UITransform).setContentSize(520, 50);
        const nl = nameNode.addComponent(Label);
        nl.string = levelName;
        nl.fontSize = 30;
        nl.overflow = Label.Overflow.SHRINK;
        nl.horizontalAlign = Label.HorizontalAlign.CENTER;
        nl.verticalAlign = Label.VerticalAlign.CENTER;
        nl.color = new Color(80, 80, 80, 255);

        // 三按钮等距铺开，"下一关"为空时按钮变灰但仍占位
        // 横向布局：x ∈ {-180, 0, 180}，间距 180
        this._buildBtn(card, '返回', -180, -100,
            new Color(180, 180, 180, 255), () => this._finish(actions.onBack));
        this._buildBtn(card, '再来一次', 0, -100,
            new Color(255, 152, 0, 255), () => this._finish(actions.onRetry));

        const nextEnabled = actions.onNext !== null;
        const nextColor = nextEnabled
            ? new Color(76, 175, 80, 255)
            : new Color(200, 200, 200, 255);
        this._buildBtn(card, '下一关', 180, -100, nextColor, () => {
            if (!nextEnabled) return;
            this._finish(actions.onNext!);
        });
    }

    private _buildBtn(
        parent: Node, text: string, x: number, y: number, color: Color, onClick: () => void,
    ): void {
        const sf = getWhitePixelSF();

        const node = new Node(`Btn_${text}`);
        parent.addChild(node);
        node.setPosition(x, y, 0);
        node.addComponent(UITransform).setContentSize(150, 64);
        const sp = node.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.type = Sprite.Type.SIMPLE;
        sp.spriteFrame = sf;
        sp.color = color;

        const labNode = new Node('Label');
        node.addChild(labNode);
        labNode.addComponent(UITransform).setContentSize(150, 64);
        const lab = labNode.addComponent(Label);
        lab.string = text;
        lab.fontSize = 28;
        lab.horizontalAlign = Label.HorizontalAlign.CENTER;
        lab.verticalAlign = Label.VerticalAlign.CENTER;
        lab.color = new Color(255, 255, 255, 255);

        const btn = node.addComponent(Button);
        btn.target = node;
        btn.transition = Button.Transition.SCALE;
        btn.zoomScale = 0.92;
        btn.node.on(Button.EventType.CLICK, onClick);
    }

    /**
     * 先销毁弹窗节点、再触发用户回调——这个顺序不能错：
     * 反过来的话，回调里如果 startLevel 触发了新弹窗，会被本弹窗的 destroy 顺手清掉。
     */
    private _finish(action: () => void): void {
        this.node.destroy();
        action();
    }
}
