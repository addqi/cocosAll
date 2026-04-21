import { _decorator, Color, Component, Graphics, Label, UITransform } from 'cc';
const { ccclass } = _decorator;

@ccclass('RedDisplay')
export class RedDisplay extends Component {

    _label: Label | null = null;
    protected onLoad(): void {
        const ut = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
        ut.setContentSize(16, 16);
        
        const g = this.node.getComponent(Graphics) ?? this.node.addComponent(Graphics);
        g.clear();
        g.circle(0, 0, 8);
        g.fillColor = new Color(244, 67, 54);
        g.fill();
    }

    setRed(isRed: boolean,number?: number): void {
        this.node.active = isRed;
        if(number){
            if(!this._label){
                this._label = this.node.getComponent(Label) ?? this.node.addComponent(Label);
                this._label.fontSize = 12;
                this._label.color = new Color(255, 255, 255, 255);
                this._label.horizontalAlign = Label.HorizontalAlign.CENTER;
                this._label.verticalAlign = Label.VerticalAlign.CENTER;
            }
            this._label.node.active = true;
            this._label.string = number.toString();
        }
    }
}