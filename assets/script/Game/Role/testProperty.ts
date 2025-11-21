import { _decorator, Component, Node, Label, UITransform, Color, Size, Layers, Sprite, SpriteFrame, Button, tween, v3, Prefab, instantiate } from 'cc';
import { RolePropertyMgr } from './RolePropertyMgr';
import { SpeedProId } from '../GlobalEnum/Enum';
import { PropertyAddModifier } from '../Base/Property/IPropertyInterface';

const { ccclass, property } = _decorator;

const BuffOptions = [
    { name: "基础速度（Base）", prop: SpeedProId.speedBaseValue },
    { name: "速度Buff（Buff）", prop: SpeedProId.speedBuffValue },
    { name: "其他速度（Other）", prop: SpeedProId.speedOtherValue },
    { name: "速度倍率（MulBuff）", prop: SpeedProId.speedMulBuffValue },
    { name: "其他倍率（MulOther）", prop: SpeedProId.speedMulOtherValue },
];

const ValueOptions = [5, 10, 20, 50, 100];

@ccclass('testProperty')
export class testProperty extends Component {
    @property(Prefab)
    private buttonPrefab: Prefab = null;
    @property(Prefab)
    private labelPrefab: Prefab = null;

    @property(RolePropertyMgr)
    private roleMgr: RolePropertyMgr = null;

    private buffTypePanel: Node = null;
    private valuePanel: Node = null;

    private roleNode: Node = null;
    private _selectedPropertyId: string = null;

    protected onLoad(): void {
        if (!this.roleMgr) {
            console.error("RolePropertyMgr 未绑定！");
            return;
        }

        this.roleNode = this.roleMgr.node;

        // 创建 UI 面板
        this.buffTypePanel = this.createPanel("BuffTypePanel");
        this.valuePanel = this.createPanel("ValuePanel");

        // 设置位置，让它们不重叠
        this.buffTypePanel.setPosition(0, 200, 0);
        this.valuePanel.setPosition(0, 200, 0);

        this.buffTypePanel.active = false;
        this.valuePanel.active = false;
        this.node.on(Node.EventType.TOUCH_START, this.onClickOpenBuffType, this);
    }

    //===============================
    // 点击打开 Buff 类型列表
    //===============================
    public onClickOpenBuffType() {
        console.log("点击打开 Buff 类型列表");
        this.buffTypePanel.active = true;
        this.valuePanel.active = false;

        this.clearChildren(this.buffTypePanel);

        BuffOptions.forEach((opt) => {
            let btn = this.createButtonItem(opt.name);
            btn.on(Node.EventType.TOUCH_END, () => {
                this.onSelectBuffType(opt.prop);
            });
            this.buffTypePanel.addChild(btn);
        });

        this.layoutPanel(this.buffTypePanel);
    }

    //===============================
    // 选择 Buff 类型 → 显示数值
    //===============================
    private onSelectBuffType(propId: string) {
        this._selectedPropertyId = propId;

        this.buffTypePanel.active = false;
        this.valuePanel.active = true;

        this.clearChildren(this.valuePanel);

        ValueOptions.forEach((value) => {
            let btn = this.createButtonItem(value.toString());
            btn.on(Node.EventType.TOUCH_END, () => {
                this.onSelectBuffValue(value);
            });
            this.valuePanel.addChild(btn);
        });

        this.layoutPanel(this.valuePanel);
    }

    //===============================
    // 选择数值 → 添加 Buff
    //===============================
    private onSelectBuffValue(value: number) {
        const prop = this.roleMgr.roleSpeed.getProperty(this._selectedPropertyId);
        if (!prop) {
            console.error("未找到属性：" + this._selectedPropertyId);
            return;
        }

        prop.addModifier(new PropertyAddModifier(value));
        this.roleMgr.refreshSpeedDirty();

        this.spawnBuffText(`Buff +${value}`);

        this.buffTypePanel.active = false;
        this.valuePanel.active = false;
    }

    //===============================
    // 飘字
    //===============================
    private spawnBuffText(text: string) {
        if (!this.roleNode) {
            console.error("角色节点为空，无法生成飘字");
            return;
        }

        const node = this.instantiateLabelPrefab(text);
        this.roleNode.addChild(node);
        node.setPosition(0, 80, 0);

        tween(node)
            .to(0.8, { position: v3(0, 140, 0) })
            .call(() => node.destroy())
            .start();
    }
    //===============================
    // 工具：创建面板
    //===============================
    private createPanel(name: string): Node {
        let node = new Node(name);

        let ui = node.addComponent(UITransform);
        ui.setContentSize(320, 400);

        node.layer = Layers.Enum.UI_2D;
        this.node.addChild(node);
        return node;
    }

    //===============================
    // 工具：创建可点击按钮
    //===============================
    private createButtonItem(text: string): Node {
        if (this.buttonPrefab) {
            const btnNode = instantiate(this.buttonPrefab);
            const labelComp = btnNode.getComponent(Label) ?? btnNode.getComponentInChildren(Label);
            if (labelComp) {
                labelComp.string = text;
            }
            return btnNode;
        }

        const item = new Node("Item");
        item.layer = Layers.Enum.UI_2D;

        const bg = item.addComponent(Sprite);
        bg.color = new Color(60, 60, 60, 200);

        const ui = item.addComponent(UITransform);
        ui.setContentSize(300, 50);

        const btn = item.addComponent(Button);
        btn.transition = Button.Transition.SCALE;

        const label = item.addComponent(Label);
        label.string = text;
        label.fontSize = 26;
        label.color = new Color(255, 255, 255);

        return item;
    }

    //===============================
    // 工具：清空子节点
    //===============================
    private clearChildren(parent: Node) {
        parent.removeAllChildren();
    }

    //===============================
    // 工具：面板自动排列
    //===============================
    private layoutPanel(panel: Node) {
        let children = panel.children;

        let startY = 150;
        let step = -60;

        children.forEach((c, i) => {
            c.setPosition(0, startY + step * i, 0);
        });
    }

    private instantiateLabelPrefab(content: string): Node {
        if (this.labelPrefab) {
            const node = instantiate(this.labelPrefab);
            const label = node.getComponent(Label) ?? node.getComponentInChildren(Label);
            if (label) {
                label.string = content;
                label.color = new Color(255, 255, 0);
            }
            return node;
        }

        const node = new Node("BuffText");
        node.layer = Layers.Enum.UI_2D;
        const label = node.addComponent(Label);
        label.string = content;
        label.fontSize = 28;
        label.color = new Color(255, 255, 0);
        return node;
    }
}
