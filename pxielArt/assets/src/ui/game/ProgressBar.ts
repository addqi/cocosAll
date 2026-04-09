import { Color, Label, Node, Sprite, SpriteFrame, UITransform } from 'cc';

const BAR_H = 16;
const BG_COLOR = new Color(220, 220, 220, 255);
const FILL_COLOR = new Color(76, 175, 80, 255);
const TEXT_COLOR = new Color(60, 60, 60, 255);
const FONT_SIZE = 24;

export interface ProgressBarHandle {
    update(filled: number, total: number): void;
}

export class ProgressBar {

    static create(parent: Node, viewW: number, topY: number): ProgressBarHandle {
        const barW = viewW * 0.45;

        const root = new Node('ProgressBar');
        parent.addChild(root);
        root.setPosition(0, topY, 0);

        const bg = new Node('Bg');
        root.addChild(bg);
        const bgUt = bg.addComponent(UITransform);
        bgUt.setContentSize(barW, BAR_H);
        const bgSp = bg.addComponent(Sprite);
        bgSp.sizeMode = Sprite.SizeMode.CUSTOM;
        bgSp.color = BG_COLOR;

        const fill = new Node('Fill');
        bg.addChild(fill);
        const fillUt = fill.addComponent(UITransform);
        fillUt.setContentSize(0, BAR_H);
        fillUt.setAnchorPoint(0, 0.5);
        fill.setPosition(-barW / 2, 0, 0);
        const fillSp = fill.addComponent(Sprite);
        fillSp.sizeMode = Sprite.SizeMode.CUSTOM;
        fillSp.color = FILL_COLOR;

        const labelNode = new Node('Percent');
        root.addChild(labelNode);
        labelNode.setPosition(barW / 2 + 40, 0, 0);
        labelNode.addComponent(UITransform).setContentSize(80, BAR_H + 10);
        const lab = labelNode.addComponent(Label);
        lab.string = '0%';
        lab.fontSize = FONT_SIZE;
        lab.horizontalAlign = Label.HorizontalAlign.LEFT;
        lab.verticalAlign = Label.VerticalAlign.CENTER;
        lab.color = TEXT_COLOR;

        return {
            update(filled: number, total: number) {
                const ratio = total > 0 ? filled / total : 0;
                fillUt.setContentSize(barW * ratio, BAR_H);
                lab.string = `${Math.round(ratio * 100)}%`;
            },
        };
    }
}
