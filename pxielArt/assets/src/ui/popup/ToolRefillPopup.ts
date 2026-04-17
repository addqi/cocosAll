import { Button, Color, Label, Node, Sprite, tween, UIOpacity, UITransform, Vec3, view } from 'cc';
import { getWhitePixelSF } from '../../util/WhitePixel';

const CARD_W = 420;
const CARD_H = 260;
const BTN_W = 150;
const BTN_H = 50;

export class ToolRefillPopup {

    /**
     * @param onAdComplete 预留广告接口：返回 true 表示广告完成可发放，false 表示取消。
     *                      当前无广告时传 () => Promise.resolve(true) 即可。
     */
    static show(
        parent: Node,
        toolName: string,
        refillCount: number,
        onAdComplete: () => Promise<boolean>,
        onRefill: () => void,
    ): void {
        const vs = view.getVisibleSize();
        const sf = getWhitePixelSF();

        const root = new Node('ToolRefill');
        parent.addChild(root);
        root.addComponent(UITransform).setContentSize(vs.width, vs.height);

        let dismissing = false;
        const dismiss = () => {
            if (dismissing) return;
            dismissing = true;
            tween(overlayOp).to(0.2, { opacity: 0 }).start();
            tween(cardOp).to(0.2, { opacity: 0 }).start();
            tween(card)
                .to(0.2, { scale: new Vec3(0.85, 0.85, 1) })
                .call(() => root.destroy())
                .start();
        };

        /* ── 遮罩 ── */
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
        oBtn.node.on(Button.EventType.CLICK, dismiss);

        /* ── 卡片 ── */
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
        titleNode.setPosition(0, CARD_H / 2 - 55, 0);
        titleNode.addComponent(UITransform).setContentSize(CARD_W, 50);
        const titleLab = titleNode.addComponent(Label);
        titleLab.string = `${toolName} 次数不足`;
        titleLab.fontSize = 34;
        titleLab.horizontalAlign = Label.HorizontalAlign.CENTER;
        titleLab.verticalAlign = Label.VerticalAlign.CENTER;
        titleLab.color = new Color(50, 50, 50, 255);

        /* ── 副标题 ── */
        const subNode = new Node('Subtitle');
        card.addChild(subNode);
        subNode.setPosition(0, CARD_H / 2 - 105, 0);
        subNode.addComponent(UITransform).setContentSize(CARD_W, 36);
        const subLab = subNode.addComponent(Label);
        subLab.string = '观看广告即可获取道具';
        subLab.fontSize = 24;
        subLab.horizontalAlign = Label.HorizontalAlign.CENTER;
        subLab.verticalAlign = Label.VerticalAlign.CENTER;
        subLab.color = new Color(140, 140, 140, 255);

        /* ── 按钮 ── */
        const cancelBtn = this._btn(sf, '取消', new Color(220, 220, 220, 255), new Color(60, 60, 60, 255));
        card.addChild(cancelBtn);
        cancelBtn.setPosition(-100, -CARD_H / 2 + BTN_H / 2 + 28, 0);
        cancelBtn.getComponent(Button)!.node.on(Button.EventType.CLICK, dismiss);

        const refillBtn = this._btn(sf, `获取 ×${refillCount}`, new Color(76, 175, 80, 255), Color.WHITE);
        card.addChild(refillBtn);
        refillBtn.setPosition(100, -CARD_H / 2 + BTN_H / 2 + 28, 0);
        refillBtn.getComponent(Button)!.node.on(Button.EventType.CLICK, async () => {
            const ok = await onAdComplete();
            if (!ok) return;
            onRefill();
            dismiss();
        });

        /* ── 弹出动画 ── */
        const cardOp = card.addComponent(UIOpacity);
        cardOp.opacity = 0;
        card.setScale(0.85, 0.85, 1);

        tween(overlayOp).to(0.25, { opacity: 255 }).start();
        tween(cardOp).to(0.25, { opacity: 255 }).start();
        tween(card).to(0.25, { scale: new Vec3(1, 1, 1) }).start();
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
