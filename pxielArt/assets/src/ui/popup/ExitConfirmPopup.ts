import { Button, Color, Label, Node, Sprite, tween, UIOpacity, UITransform, Vec3, view } from 'cc';
import { getWhitePixelSF } from '../../util/WhitePixel';

const CARD_W = 400;
const CARD_H = 240;
const BTN_W = 150;
const BTN_H = 50;

export class ExitConfirmPopup {

    static show(parent: Node, onContinue: () => void, onExit: () => void): void {
        const vs = view.getVisibleSize();
        const sf = getWhitePixelSF();

        const root = new Node('ExitConfirm');
        parent.addChild(root);
        root.addComponent(UITransform).setContentSize(vs.width, vs.height);

        /* ── 半透明遮罩 ── */
        const overlay = new Node('Overlay');
        root.addChild(overlay);
        overlay.addComponent(UITransform).setContentSize(vs.width, vs.height);
        const oSp = overlay.addComponent(Sprite);
        oSp.sizeMode = Sprite.SizeMode.CUSTOM;
        oSp.spriteFrame = sf;
        oSp.color = new Color(0, 0, 0, 128);
        const overlayOp = overlay.addComponent(UIOpacity);
        overlayOp.opacity = 0;
        const oBtn = overlay.addComponent(Button);
        oBtn.target = overlay;
        oBtn.transition = Button.Transition.NONE;
        oBtn.node.on(Button.EventType.CLICK, () => dismiss(false));

        /* ── 白色卡片 ── */
        const card = new Node('Card');
        root.addChild(card);
        card.addComponent(UITransform).setContentSize(CARD_W, CARD_H);

        const cardBg = new Node('Bg');
        card.addChild(cardBg);
        cardBg.addComponent(UITransform).setContentSize(CARD_W, CARD_H);
        const bgSp = cardBg.addComponent(Sprite);
        bgSp.sizeMode = Sprite.SizeMode.CUSTOM;
        bgSp.spriteFrame = sf;
        bgSp.color = Color.WHITE;

        /* ── 标题 ── */
        const titleNode = new Node('Title');
        card.addChild(titleNode);
        titleNode.setPosition(0, CARD_H / 2 - 50, 0);
        titleNode.addComponent(UITransform).setContentSize(CARD_W, 50);
        const titleLab = titleNode.addComponent(Label);
        titleLab.string = '确认退出？';
        titleLab.fontSize = 34;
        titleLab.horizontalAlign = Label.HorizontalAlign.CENTER;
        titleLab.verticalAlign = Label.VerticalAlign.CENTER;
        titleLab.color = new Color(50, 50, 50, 255);

        /* ── 副标题 ── */
        const subNode = new Node('Subtitle');
        card.addChild(subNode);
        subNode.setPosition(0, CARD_H / 2 - 95, 0);
        subNode.addComponent(UITransform).setContentSize(CARD_W, 36);
        const subLab = subNode.addComponent(Label);
        subLab.string = '进度已自动保存';
        subLab.fontSize = 24;
        subLab.horizontalAlign = Label.HorizontalAlign.CENTER;
        subLab.verticalAlign = Label.VerticalAlign.CENTER;
        subLab.color = new Color(140, 140, 140, 255);

        /* ── 按钮 ── */
        const continueBtn = this._btn(sf, '继续游戏', new Color(220, 220, 220, 255), new Color(60, 60, 60, 255));
        card.addChild(continueBtn);
        continueBtn.setPosition(-90, -CARD_H / 2 + BTN_H / 2 + 24, 0);
        continueBtn.getComponent(Button)!.node.on(Button.EventType.CLICK, () => dismiss(false));

        const exitBtn = this._btn(sf, '退出', new Color(76, 175, 80, 255), Color.WHITE);
        card.addChild(exitBtn);
        exitBtn.setPosition(90, -CARD_H / 2 + BTN_H / 2 + 24, 0);
        exitBtn.getComponent(Button)!.node.on(Button.EventType.CLICK, () => dismiss(true));

        /* ── 弹出动画 ── */
        const cardOp = card.addComponent(UIOpacity);
        cardOp.opacity = 0;
        card.setScale(0.85, 0.85, 1);

        tween(overlayOp).to(0.25, { opacity: 255 }).start();
        tween(cardOp).to(0.25, { opacity: 255 }).start();
        tween(card).to(0.25, { scale: new Vec3(1, 1, 1) }).start();

        /* ── 关闭逻辑 ── */
        let dismissing = false;
        const dismiss = (exit: boolean) => {
            if (dismissing) return;
            dismissing = true;

            tween(overlayOp).to(0.2, { opacity: 0 }).start();
            tween(cardOp).to(0.2, { opacity: 0 }).start();
            tween(card)
                .to(0.2, { scale: new Vec3(0.85, 0.85, 1) })
                .call(() => {
                    root.destroy();
                    if (exit) onExit(); else onContinue();
                })
                .start();
        };
    }

    private static _btn(sf: import('cc').SpriteFrame, label: string, bgColor: Color, textColor: Color): Node {
        const node = new Node(`Btn_${label}`);
        node.addComponent(UITransform).setContentSize(BTN_W, BTN_H);
        const sp = node.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.spriteFrame = sf;
        sp.color = bgColor;

        const labNode = new Node('Label');
        node.addChild(labNode);
        labNode.addComponent(UITransform).setContentSize(BTN_W, BTN_H);
        const lab = labNode.addComponent(Label);
        lab.string = label;
        lab.fontSize = 24;
        lab.horizontalAlign = Label.HorizontalAlign.CENTER;
        lab.verticalAlign = Label.VerticalAlign.CENTER;
        lab.color = textColor;

        const btn = node.addComponent(Button);
        btn.target = node;
        btn.transition = Button.Transition.SCALE;
        btn.zoomScale = 0.9;
        return node;
    }
}
