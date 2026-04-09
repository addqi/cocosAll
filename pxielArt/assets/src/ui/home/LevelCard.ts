import { Button, Color, Label, Node, Sprite, SpriteFrame, UITransform } from 'cc';

export type LevelStatus = 'new' | 'progress' | 'done';

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
        previewFrame: SpriteFrame,
        onClick: () => void,
        status: LevelStatus = 'new',
        style: Partial<LevelCardStyle> = {},
    ): Node {
        const s = { ...DEFAULT_STYLE, ...style };

        const root = new Node(`LevelCard_${name}`);
        const rootUt = root.addComponent(UITransform);
        rootUt.setContentSize(s.width, s.height);

        const bg = new Node('Bg');
        root.addChild(bg);
        const bgUt = bg.addComponent(UITransform);
        bgUt.setContentSize(s.width, s.height);
        const bgSp = bg.addComponent(Sprite);
        bgSp.sizeMode = Sprite.SizeMode.CUSTOM;
        bgSp.color = s.bgColor.clone();

        const preview = new Node('Preview');
        root.addChild(preview);
        preview.setPosition(0, (s.height - s.previewSize) / 2 - 10, 0);
        const pvUt = preview.addComponent(UITransform);
        pvUt.setContentSize(s.previewSize, s.previewSize);
        const pvSp = preview.addComponent(Sprite);
        pvSp.sizeMode = Sprite.SizeMode.CUSTOM;
        pvSp.spriteFrame = previewFrame;

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

        if (status !== 'new') {
            this._addStatusBadge(root, s, status);
        }

        const btn = root.addComponent(Button);
        btn.target = root;
        btn.transition = Button.Transition.SCALE;
        btn.zoomScale = 0.95;
        btn.node.on(Button.EventType.CLICK, onClick);

        return root;
    }

    private static _addStatusBadge(root: Node, s: LevelCardStyle, status: LevelStatus): void {
        const badge = new Node('StatusBadge');
        root.addChild(badge);

        const isDone = status === 'done';
        const text = isDone ? '\u2714' : '...';
        const bgColor = isDone ? new Color(76, 175, 80, 230) : new Color(255, 152, 0, 230);
        const size = isDone ? 40 : 50;

        badge.setPosition(s.width / 2 - size / 2 - 8, s.height / 2 - size / 2 - 8, 0);
        const bUt = badge.addComponent(UITransform);
        bUt.setContentSize(size, size);
        const bSp = badge.addComponent(Sprite);
        bSp.sizeMode = Sprite.SizeMode.CUSTOM;
        bSp.color = bgColor;

        const lblNode = new Node('BadgeLabel');
        badge.addChild(lblNode);
        const lUt = lblNode.addComponent(UITransform);
        lUt.setContentSize(size, size);
        const lbl = lblNode.addComponent(Label);
        lbl.string = text;
        lbl.fontSize = isDone ? 26 : 20;
        lbl.horizontalAlign = Label.HorizontalAlign.CENTER;
        lbl.verticalAlign = Label.VerticalAlign.CENTER;
        lbl.color = new Color(255, 255, 255, 255);
    }
}
