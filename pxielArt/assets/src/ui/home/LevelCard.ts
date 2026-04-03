import { Button, Color, Label, Node, Sprite, SpriteFrame, UITransform } from 'cc';

export interface LevelCardStyle {
    width: number;
    height: number;
    /** 预览图区域正方形边长 */
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
        previewFrame: SpriteFrame,
        onClick: () => void,
        style: Partial<LevelCardStyle> = {},
    ): Node {
        const s = { ...DEFAULT_STYLE, ...style };

        const root = new Node(`LevelCard_${name}`);
        const rootUt = root.addComponent(UITransform);
        rootUt.setContentSize(s.width, s.height);

        // 背景底板
        const bg = new Node('Bg');
        root.addChild(bg);
        const bgUt = bg.addComponent(UITransform);
        bgUt.setContentSize(s.width, s.height);
        const bgSp = bg.addComponent(Sprite);
        bgSp.sizeMode = Sprite.SizeMode.CUSTOM;
        bgSp.color = s.bgColor.clone();

        // 预览图
        const preview = new Node('Preview');
        root.addChild(preview);
        preview.setPosition(0, (s.height - s.previewSize) / 2 - 10, 0);
        const pvUt = preview.addComponent(UITransform);
        pvUt.setContentSize(s.previewSize, s.previewSize);
        const pvSp = preview.addComponent(Sprite);
        pvSp.sizeMode = Sprite.SizeMode.CUSTOM;
        pvSp.spriteFrame = previewFrame;

        // 名称
        const labelNode = new Node('Name');
        root.addChild(labelNode);
        labelNode.setPosition(0, -s.height / 2 + 30, 0);
        const lUt = labelNode.addComponent(UITransform);
        lUt.setContentSize(s.width, 40);
        const lab = labelNode.addComponent(Label);
        lab.string = name;
        lab.fontSize = s.nameFontSize;
        lab.horizontalAlign = Label.HorizontalAlign.CENTER;
        lab.verticalAlign = Label.VerticalAlign.CENTER;
        lab.color = s.nameColor.clone();

        // 点击
        const btn = root.addComponent(Button);
        btn.target = root;
        btn.transition = Button.Transition.SCALE;
        btn.zoomScale = 0.95;
        btn.node.on(Button.EventType.CLICK, onClick);

        return root;
    }
}
