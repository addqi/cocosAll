import { _decorator, Color, Component, Graphics, Label, Node, UITransform } from 'cc';
const { ccclass } = _decorator;

export enum RedDisplayMode {
    DOT_ONLY = 0,
    NUMBER_ONLY = 1,
    AUTO = 2,
}

@ccclass('RedDisplay')
export class RedDisplay extends Component {
    private _label: Label | null = null;

    protected onLoad(): void {
        const ut = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
        ut.setContentSize(20, 20);

        const g = this.node.getComponent(Graphics) ?? this.node.addComponent(Graphics);
        g.clear();
        g.circle(0, 0, 10);
        g.fillColor = new Color(244, 67, 54);
        g.fill();

        const labelNode = new Node('Count');
        this.node.addChild(labelNode);
        const labelUT = labelNode.addComponent(UITransform);
        labelUT.setContentSize(20, 20);

        this._label = labelNode.addComponent(Label);
        this._label.fontSize = 12;
        this._label.color = new Color(255, 255, 255);
        this._label.horizontalAlign = Label.HorizontalAlign.CENTER;
        this._label.verticalAlign = Label.VerticalAlign.CENTER;
        this._label.string = '';
    }

    setRed(count: number, mode: RedDisplayMode): void {
        this.node.active = count > 0;
        if (!this._label) return;

        if (count <= 0) {
            this._label.string = '';
            return;
        }
        if (mode === RedDisplayMode.DOT_ONLY) {
            this._label.string = '';
        } else if (mode === RedDisplayMode.NUMBER_ONLY) {
            this._label.string = count > 99 ? '99+' : String(count);
        } else {
            this._label.string = count === 1 ? '' : (count > 99 ? '99+' : String(count));
        }
    }
}