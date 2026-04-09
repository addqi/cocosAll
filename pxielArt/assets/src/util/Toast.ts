import { Color, Label, Node, Sprite, tween, UIOpacity, UITransform, Vec3, view } from 'cc';

const FONT_SIZE = 26;
const PAD_H = 24;
const PAD_V = 14;
const RISE_PX = 40;
const FADE_DELAY = 0.8;
const FADE_DURATION = 0.8;
const TOTAL_DURATION = FADE_DELAY + FADE_DURATION;

export function showToast(parent: Node, msg: string): void {
    const vs = view.getVisibleSize();
    const textW = msg.length * FONT_SIZE * 0.65;
    const bgW = textW + PAD_H * 2;
    const bgH = FONT_SIZE + PAD_V * 2;
    const startY = -vs.height / 2 + 160;

    const node = new Node('Toast');
    parent.addChild(node);
    node.setPosition(0, startY, 0);
    node.addComponent(UITransform).setContentSize(bgW, bgH);

    const bgNode = new Node('Bg');
    node.addChild(bgNode);
    bgNode.addComponent(UITransform).setContentSize(bgW, bgH);
    const bgSp = bgNode.addComponent(Sprite);
    bgSp.sizeMode = Sprite.SizeMode.CUSTOM;
    bgSp.color = new Color(50, 50, 50, 200);

    const labNode = new Node('Label');
    node.addChild(labNode);
    labNode.addComponent(UITransform).setContentSize(bgW, bgH);
    const lab = labNode.addComponent(Label);
    lab.string = msg;
    lab.fontSize = FONT_SIZE;
    lab.horizontalAlign = Label.HorizontalAlign.CENTER;
    lab.verticalAlign = Label.VerticalAlign.CENTER;
    lab.color = Color.WHITE;

    const uiOp = node.addComponent(UIOpacity);
    uiOp.opacity = 255;

    tween(node)
        .to(TOTAL_DURATION, { position: new Vec3(0, startY + RISE_PX, 0) })
        .start();
    tween(uiOp)
        .delay(FADE_DELAY)
        .to(FADE_DURATION, { opacity: 0 })
        .call(() => node.destroy())
        .start();
}
