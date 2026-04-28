import {
    _decorator, Button, Color, Component, Label, Node, Sprite, sys, UITransform, view, Widget,
} from 'cc';
import { getWhitePixelSF } from '../../util/WhitePixel';

const { ccclass } = _decorator;

export interface ConfirmResult {
    confirmed: boolean;
    /** 用户勾了"不再显示"。当 confirmed=true 时调用方才该持久化。 */
    dontAskAgain: boolean;
}

/**
 * 通用确认弹窗。
 *
 * 静态用法：
 *   const r = await ConfirmDialog.show(parent, '修改难度', '修改难度会打乱当前排序，确定吗？');
 *   if (r.confirmed) { ... if (r.dontAskAgain) sys.localStorage.setItem(KEY, '1'); }
 *
 * 持久化辅助：调用方自己管 key，本组件只负责 UI + 返回勾选状态。
 *   ConfirmDialog.shouldSkip('puzzle.skipDiffConfirm')  // 启动时查
 *   ConfirmDialog.markSkip('puzzle.skipDiffConfirm')    // 用户确认+勾选时写
 *
 * 设计选择：
 *   - 全屏遮罩吃事件，避免穿透到背景；
 *   - 卡片不响应点击，只能通过"取消/确定"出场；
 *   - 复选框是整行可点击，比只点小方块更宽容（Fitts's Law）。
 */
@ccclass('ConfirmDialog')
export class ConfirmDialog extends Component {

    static show(parent: Node, title: string, message: string): Promise<ConfirmResult> {
        return new Promise(resolve => {
            const node = new Node('ConfirmDialog');
            parent.addChild(node);
            const dlg = node.addComponent(ConfirmDialog);
            dlg._init(title, message, resolve);
        });
    }

    /** 调用方查询：是否要跳过这次弹窗（用户之前勾过"不再显示"）。 */
    static shouldSkip(storageKey: string): boolean {
        return sys.localStorage.getItem(storageKey) === '1';
    }

    /** 调用方写入"不再显示"的标记。 */
    static markSkip(storageKey: string): void {
        sys.localStorage.setItem(storageKey, '1');
    }

    private _checked = false;
    private _checkbox: Sprite | null = null;
    private _checkInner: Node | null = null;
    private _checkmark: Label | null = null;
    private _resolve: ((r: ConfirmResult) => void) | null = null;

    private _init(title: string, message: string, resolve: (r: ConfirmResult) => void): void {
        this._resolve = resolve;
        const vs = view.getVisibleSize();
        const sf = getWhitePixelSF();

        this.node.addComponent(UITransform).setContentSize(vs.width, vs.height);
        const w = this.node.addComponent(Widget);
        w.isAlignTop = w.isAlignBottom = w.isAlignLeft = w.isAlignRight = true;
        w.top = w.bottom = w.left = w.right = 0;
        w.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;

        // 全屏遮罩：吞掉点击穿透
        const mask = new Node('Mask');
        this.node.addChild(mask);
        mask.addComponent(UITransform).setContentSize(vs.width, vs.height);
        const ms = mask.addComponent(Sprite);
        ms.sizeMode = Sprite.SizeMode.CUSTOM;
        ms.spriteFrame = sf;
        ms.color = new Color(0, 0, 0, 160);
        const maskBtn = mask.addComponent(Button);
        maskBtn.target = mask;
        maskBtn.transition = Button.Transition.NONE;

        const card = new Node('Card');
        this.node.addChild(card);
        card.addComponent(UITransform).setContentSize(560, 380);
        const cs = card.addComponent(Sprite);
        cs.sizeMode = Sprite.SizeMode.CUSTOM;
        cs.type = Sprite.Type.SIMPLE;
        cs.spriteFrame = sf;
        cs.color = new Color(255, 255, 255, 255);

        const titleNode = new Node('Title');
        card.addChild(titleNode);
        titleNode.setPosition(0, 140, 0);
        titleNode.addComponent(UITransform).setContentSize(520, 44);
        const tl = titleNode.addComponent(Label);
        tl.string = title;
        tl.fontSize = 32;
        tl.horizontalAlign = Label.HorizontalAlign.CENTER;
        tl.verticalAlign = Label.VerticalAlign.CENTER;
        tl.color = new Color(40, 40, 40, 255);

        const msgNode = new Node('Message');
        card.addChild(msgNode);
        msgNode.setPosition(0, 60, 0);
        msgNode.addComponent(UITransform).setContentSize(520, 60);
        const ml = msgNode.addComponent(Label);
        ml.string = message;
        ml.fontSize = 26;
        ml.horizontalAlign = Label.HorizontalAlign.CENTER;
        ml.verticalAlign = Label.VerticalAlign.CENTER;
        ml.color = new Color(80, 80, 80, 255);

        this._buildCheckRow(card, 0, -20);
        this._buildBtn(card, '取消', -130, -130,
            new Color(180, 180, 180, 255), () => this._finish(false));
        this._buildBtn(card, '确定', 130, -130,
            new Color(76, 175, 80, 255), () => this._finish(true));
    }

    /**
     * 复选框行：[ □ ] 不再显示
     *
     * 视觉刻意做"重"：浅灰背景 + 加粗描边色 + 大字号——
     * 之前做太轻量（透明背景 + 26px 灰方块）用户根本看不到。
     * 这里 row 整体可点，box 32×32，命中区域整行 320×52。
     */
    private _buildCheckRow(parent: Node, x: number, y: number): void {
        const sf = getWhitePixelSF();

        const row = new Node('CheckRow');
        parent.addChild(row);
        row.setPosition(x, y, 0);
        row.addComponent(UITransform).setContentSize(320, 52);
        // 浅灰底，让整行作为一个明显的"可点击元素"存在
        const rowSp = row.addComponent(Sprite);
        rowSp.sizeMode = Sprite.SizeMode.CUSTOM;
        rowSp.type = Sprite.Type.SIMPLE;
        rowSp.spriteFrame = sf;
        rowSp.color = new Color(245, 245, 245, 255);
        const rowBtn = row.addComponent(Button);
        rowBtn.target = row;
        rowBtn.transition = Button.Transition.NONE;
        rowBtn.node.on(Button.EventType.CLICK, () => this._toggleCheck());

        // 复选框（左）
        const box = new Node('Box');
        row.addChild(box);
        box.setPosition(-120, 0, 0);
        const boxUt = box.addComponent(UITransform);
        const bs = box.addComponent(Sprite);
        bs.sizeMode = Sprite.SizeMode.CUSTOM;
        bs.type = Sprite.Type.SIMPLE;
        bs.spriteFrame = sf;
        bs.color = new Color(180, 180, 180, 255);
        boxUt.setContentSize(32, 32);
        this._checkbox = bs;

        // 复选框内白色填充——未选中时显示，做出"灰边框 + 白底"效果。
        // 选中时隐藏 inner，让绿色 box 整块露出当 ✓ 的背景，避免"白底白字"看不到 ✓。
        const inner = new Node('Inner');
        box.addChild(inner);
        const innerUt = inner.addComponent(UITransform);
        const ins = inner.addComponent(Sprite);
        ins.sizeMode = Sprite.SizeMode.CUSTOM;
        ins.type = Sprite.Type.SIMPLE;
        ins.spriteFrame = sf;
        ins.color = new Color(255, 255, 255, 255);
        innerUt.setContentSize(26, 26);
        this._checkInner = inner;

        // 勾√——选中时 string='✓'，white on green。
        // 必须在 inner **之后** addChild，保证 ✓ 渲染在 inner 之上（即便 inner 还活着也能看到）。
        const checkNode = new Node('Check');
        box.addChild(checkNode);
        const checkUt = checkNode.addComponent(UITransform);
        checkUt.setContentSize(32, 32);
        const cl = checkNode.addComponent(Label);
        cl.fontSize = 28;
        cl.horizontalAlign = Label.HorizontalAlign.CENTER;
        cl.verticalAlign = Label.VerticalAlign.CENTER;
        cl.color = new Color(255, 255, 255, 255);
        cl.string = '';
        this._checkmark = cl;

        // 文字"不再显示"（右）
        const labelNode = new Node('Label');
        row.addChild(labelNode);
        labelNode.setPosition(20, 0, 0);
        labelNode.addComponent(UITransform).setContentSize(240, 52);
        const ll = labelNode.addComponent(Label);
        ll.string = '不再显示';
        ll.fontSize = 26;
        ll.horizontalAlign = Label.HorizontalAlign.LEFT;
        ll.verticalAlign = Label.VerticalAlign.CENTER;
        ll.color = new Color(60, 60, 60, 255);
    }

    private _toggleCheck(): void {
        this._checked = !this._checked;
        // 选中：box 变绿 + 隐藏白色 inner（让绿色露出来）+ 显示白色 ✓
        // 未选中：box 灰边框 + 显示白色 inner（边框白底）+ 隐藏 ✓
        if (this._checkbox) {
            this._checkbox.color = this._checked
                ? new Color(76, 175, 80, 255)
                : new Color(180, 180, 180, 255);
        }
        if (this._checkInner) {
            this._checkInner.active = !this._checked;
        }
        if (this._checkmark) {
            this._checkmark.string = this._checked ? '✓' : '';
        }
    }

    private _buildBtn(
        parent: Node, text: string, x: number, y: number, color: Color, onClick: () => void,
    ): void {
        const sf = getWhitePixelSF();

        const node = new Node(`Btn_${text}`);
        parent.addChild(node);
        node.setPosition(x, y, 0);
        node.addComponent(UITransform).setContentSize(140, 56);
        const sp = node.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.spriteFrame = sf;
        sp.color = color;

        const labNode = new Node('Label');
        node.addChild(labNode);
        labNode.addComponent(UITransform).setContentSize(140, 56);
        const lab = labNode.addComponent(Label);
        lab.string = text;
        lab.fontSize = 26;
        lab.horizontalAlign = Label.HorizontalAlign.CENTER;
        lab.verticalAlign = Label.VerticalAlign.CENTER;
        lab.color = Color.WHITE;

        const btn = node.addComponent(Button);
        btn.target = node;
        btn.transition = Button.Transition.SCALE;
        btn.zoomScale = 0.92;
        btn.node.on(Button.EventType.CLICK, onClick);
    }

    private _finish(confirmed: boolean): void {
        if (this._resolve) {
            this._resolve({ confirmed, dontAskAgain: this._checked });
            this._resolve = null;
        }
        this.node.destroy();
    }
}
