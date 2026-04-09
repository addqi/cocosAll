import { Color, Label, Node, tween, UIOpacity, UITransform, Vec3 } from 'cc';

const RISE_PX = 60;
const FONT_SIZE = 28;
const FADE_DELAY = 0.6;
const FADE_DURATION = 0.9;
const TOTAL_DURATION = FADE_DELAY + FADE_DURATION;

export function showToast(parent: Node, msg: string): void {
    const node = new Node('Toast');
    parent.addChild(node);
    node.setPosition(0, 0, 0);

    node.addComponent(UITransform).setContentSize(400, 50);

    const lab = node.addComponent(Label);
    lab.string = msg;
    lab.fontSize = FONT_SIZE;
    lab.horizontalAlign = Label.HorizontalAlign.CENTER;
    lab.verticalAlign = Label.VerticalAlign.CENTER;
    lab.color = new Color(80, 80, 80, 255);

    const uiOp = node.addComponent(UIOpacity);
    uiOp.opacity = 255;

    tween(node)
        .to(TOTAL_DURATION, { position: new Vec3(0, RISE_PX, 0) })
        .start();
    tween(uiOp)
        .delay(FADE_DELAY)
        .to(FADE_DURATION, { opacity: 0 })
        .call(() => node.destroy())
        .start();
}
