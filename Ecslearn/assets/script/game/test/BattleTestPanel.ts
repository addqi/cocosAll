import {
    _decorator, Component, Node, Label, Color, UITransform,
    Graphics, Button, Widget, Layout, view, director,
} from 'cc';
import type { BuffData } from '../../baseSystem/buff';
import { EPropertyId } from '../config/enum/propertyEnum';
import { PlayerControl } from '../player/PlayerControl';
import attackBoostCfg from '../config/buffConfig/attackBoost.json';

const { ccclass } = _decorator;

interface BuffEntry {
    label: string;
    config: BuffData;
}

const BUFF_LIST: BuffEntry[] = [
    { label: '攻击+10%', config: attackBoostCfg as unknown as BuffData },
];

@ccclass('BattleTestPanel')
export class BattleTestPanel extends Component {
    private _player: PlayerControl | null = null;
    private _statusLabel: Label | null = null;

    start() {
        this._player = director.getScene()?.getComponentInChildren(PlayerControl) ?? null;
        if (!this._player) {
            console.error('[BattleTestPanel] 场景中找不到 PlayerControl');
            return;
        }
        this._buildUI();
    }

    private _buildUI() {
        const panel = new Node('TestPanel');
        this.node.addChild(panel);

        const widget = panel.addComponent(Widget);
        widget.isAlignLeft = true;
        widget.isAlignBottom = true;
        widget.left = 20;
        widget.bottom = 20;
        widget.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;

        const layout = panel.addComponent(Layout);
        layout.type = Layout.Type.VERTICAL;
        layout.spacingY = 8;
        layout.resizeMode = Layout.ResizeMode.CONTAINER;
        layout.paddingTop = 10;
        layout.paddingBottom = 10;
        layout.paddingLeft = 10;
        layout.paddingRight = 10;

        panel.addComponent(UITransform).setContentSize(380, 200);

        this._statusLabel = this._createLabel(panel, '', 18, new Color(255, 255, 200, 255));

        for (const entry of BUFF_LIST) {
            this._createBuffRow(panel, entry);
        }
    }

    private _createBuffRow(parent: Node, entry: BuffEntry) {
        const row = new Node('Row');
        parent.addChild(row);
        row.addComponent(UITransform).setContentSize(360, 40);

        const rowLayout = row.addComponent(Layout);
        rowLayout.type = Layout.Type.HORIZONTAL;
        rowLayout.spacingX = 10;
        rowLayout.resizeMode = Layout.ResizeMode.NONE;

        this._createBtn(row, `增加 ${entry.label}`, new Color(40, 120, 40, 230), () => {
            if (!this._player) return;
            this._player.buffMgr.addBuff(entry.config, this._player.buffOwner);
            console.log(`[Test] 添加 buff: ${entry.config.name}`);
        });

        this._createBtn(row, `移除 ${entry.label}`, new Color(160, 40, 40, 230), () => {
            if (!this._player) return;
            const removed = this._player.buffMgr.removeBuff(entry.config.id);
            console.log(`[Test] 移除 buff: ${entry.config.name} → ${removed ? '成功' : '未找到'}`);
        });
    }

    private _createBtn(parent: Node, text: string, bgColor: Color, onClick: () => void): Node {
        const btn = new Node(text);
        parent.addChild(btn);

        const ut = btn.addComponent(UITransform);
        ut.setContentSize(170, 36);

        const g = btn.addComponent(Graphics);
        g.fillColor = bgColor;
        g.roundRect(-85, -18, 170, 36, 6);
        g.fill();

        const button = btn.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 0.9;
        btn.on('click', onClick, this);

        const labelNode = new Node('Label');
        btn.addChild(labelNode);
        labelNode.addComponent(UITransform).setContentSize(170, 36);
        const label = labelNode.addComponent(Label);
        label.string = text;
        label.fontSize = 16;
        label.lineHeight = 36;
        label.color = Color.WHITE;
        label.enableOutline = true;
        label.outlineColor = new Color(0, 0, 0, 180);
        label.outlineWidth = 1;

        return btn;
    }

    private _createLabel(parent: Node, text: string, fontSize: number, color: Color): Label {
        const node = new Node('StatusLabel');
        parent.addChild(node);
        node.addComponent(UITransform).setContentSize(360, 28);
        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = 24;
        label.color = color;
        label.overflow = Label.Overflow.NONE;
        label.enableOutline = true;
        label.outlineColor = new Color(0, 0, 0, 180);
        label.outlineWidth = 1;
        return label;
    }

    update() {
        if (!this._player || !this._statusLabel) return;
        const p = this._player.playerProp;
        const atk = p.getValue(EPropertyId.Attack);
        const stack = this._player.buffMgr.getRuntime(attackBoostCfg.id)?.stack ?? 0;
        this._statusLabel.string = `ATK: ${atk.toFixed(0)}` + (stack > 0 ? `  (buff ×${stack})` : '');
    }
}
