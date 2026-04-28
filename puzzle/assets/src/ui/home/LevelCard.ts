import { Button, Color, Label, Node, Sprite, SpriteFrame, UITransform } from 'cc';
import { getWhitePixelSF } from '../../util/WhitePixel';

/**
 * 一张关卡卡片：背景 + 缩略图 + 名字 + 整体可点。
 *
 * 不带状态徽章（done/progress）——本工程没存档系统，假装有就是垃圾设计。
 * 等真要做存档时再加 status 参数。
 */
export interface LevelCardStyle {
    width: number;
    height: number;
    previewSize: number;
    nameFontSize: number;
    nameColor: Color;
    bgColor: Color;
}

const DEFAULT_STYLE: LevelCardStyle = {
    width: 320,
    height: 380,
    previewSize: 280,
    nameFontSize: 28,
    nameColor: new Color(50, 50, 50, 255),
    bgColor: new Color(255, 255, 255, 255),
};

export class LevelCard {

    static create(
        name: string,
        previewFrame: SpriteFrame | null,
        onClick: () => void,
        style: Partial<LevelCardStyle> = {},
    ): Node {
        const s = { ...DEFAULT_STYLE, ...style };

        const root = new Node(`LevelCard_${name}`);
        root.addComponent(UITransform).setContentSize(s.width, s.height);

        const bg = new Node('Bg');
        root.addChild(bg);
        bg.addComponent(UITransform).setContentSize(s.width, s.height);
        const bgSp = bg.addComponent(Sprite);
        bgSp.sizeMode = Sprite.SizeMode.CUSTOM;
        bgSp.spriteFrame = getWhitePixelSF();
        bgSp.color = s.bgColor.clone();

        const preview = new Node('Preview');
        root.addChild(preview);
        preview.setPosition(0, (s.height - s.previewSize) / 2 - 10, 0);
        preview.addComponent(UITransform).setContentSize(s.previewSize, s.previewSize);
        const pvSp = preview.addComponent(Sprite);
        pvSp.sizeMode = Sprite.SizeMode.CUSTOM;
        if (previewFrame) {
            pvSp.spriteFrame = previewFrame;
        } else {
            pvSp.spriteFrame = getWhitePixelSF();
            pvSp.color = new Color(220, 220, 220, 255);
        }

        const labelNode = new Node('Name');
        root.addChild(labelNode);
        labelNode.setPosition(0, -s.height / 2 + 30, 0);
        labelNode.addComponent(UITransform).setContentSize(s.width, 40);
        const lab = labelNode.addComponent(Label);
        lab.string = name;
        lab.fontSize = s.nameFontSize;
        lab.horizontalAlign = Label.HorizontalAlign.CENTER;
        lab.verticalAlign = Label.VerticalAlign.CENTER;
        lab.color = s.nameColor.clone();

        const btn = root.addComponent(Button);
        btn.target = root;
        btn.transition = Button.Transition.SCALE;
        btn.zoomScale = 0.95;
        btn.node.on(Button.EventType.CLICK, onClick);

        return root;
    }
}
