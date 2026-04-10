import {
    _decorator, Component, Node, Label, Color, UITransform,
    Graphics, Button, Widget, Layout, director,
} from 'cc';
import type { BuffData } from '../../baseSystem/buff';
import { EPropertyId } from '../config/enum/propertyEnum';
import { PlayerControl } from '../player/PlayerControl';
import { EnemyControl } from '../enemy/EnemyControl';

const { ccclass } = _decorator;

interface BuffToggleEntry {
    label: string;
    data: BuffData;
}

const PROJ_BUFF_TESTS: BuffToggleEntry[] = [
    {
        label: '穿透+1',
        data: { id: 9001, name: '穿透+1', duration: 0, maxStack: 10, effectClass: 'SimpleAttrBuffEffect', targetAttr: 'PierceCount-Value-Buff', valuePerStack: 1 },
    },
    {
        label: '弹射+1',
        data: { id: 9002, name: '弹射+1', duration: 0, maxStack: 10, effectClass: 'SimpleAttrBuffEffect', targetAttr: 'BounceCount-Value-Buff', valuePerStack: 1 },
    },
    {
        label: '额外弹道+1',
        data: { id: 9003, name: '额外弹道+1', duration: 0, maxStack: 10, effectClass: 'SimpleAttrBuffEffect', targetAttr: 'ExtraProjectiles-Value-Buff', valuePerStack: 1 },
    },
];

@ccclass('BattleTestPanel')
export class BattleTestPanel extends Component {
    private _player: PlayerControl | null = null;
    private _enemy: EnemyControl | null = null;
    private _playerStatusLabel: Label | null = null;
    private _enemyStatusLabel: Label | null = null;

    start() {
        this._player = director.getScene()?.getComponentInChildren(PlayerControl) ?? null;
        this._enemy = EnemyControl.allEnemies[0] ?? null;

        if (!this._player) {
            console.error('[BattleTestPanel] 场景中找不到 PlayerControl');
            return;
        }
        if (!this._enemy) {
            console.error('[BattleTestPanel] 场景中找不到 EnemyControl');
        }
        this._buildUI();
    }

    private _buildUI() {
        const panel = new Node('TestPanel');
        this.node.addChild(panel);

        const widget = panel.addComponent(Widget);
        widget.isAlignLeft = true;
        widget.isAlignTop = true;
        widget.left = 20;
        widget.top = 20;
        widget.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;

        const layout = panel.addComponent(Layout);
        layout.type = Layout.Type.VERTICAL;
        layout.spacingY = 6;
        layout.resizeMode = Layout.ResizeMode.CONTAINER;
        layout.paddingTop = 10;
        layout.paddingBottom = 10;
        layout.paddingLeft = 10;
        layout.paddingRight = 10;

        panel.addComponent(UITransform).setContentSize(380, 400);

        this._playerStatusLabel = this._createLabel(panel, '', 16, new Color(80, 220, 80, 255));
        this._enemyStatusLabel = this._createLabel(panel, '', 16, new Color(255, 100, 100, 255));

        this._createSectionLabel(panel, '--- 弹道属性 ---');
        this._buildProjBuffButtons(panel);

        this._createSectionLabel(panel, '--- 重置 ---');
        this._buildResetButtons(panel);
    }

    private _buildProjBuffButtons(parent: Node) {
        const player = this._player!;
        const addColor = new Color(80, 40, 140, 230);
        const rmColor = new Color(140, 40, 40, 230);

        for (const entry of PROJ_BUFF_TESTS) {
            const row = this._createRow(parent);
            const valLabel = this._createLabel(row, `${entry.label} (0)`, 14, new Color(200, 200, 255, 255));
            valLabel.node.getComponent(UITransform)!.setContentSize(160, 32);

            const updateLabel = () => {
                let propId: EPropertyId | null = null;
                if (entry.data.targetAttr?.startsWith('PierceCount')) propId = EPropertyId.PierceCount;
                else if (entry.data.targetAttr?.startsWith('BounceCount')) propId = EPropertyId.BounceCount;
                else if (entry.data.targetAttr?.startsWith('ExtraProjectiles')) propId = EPropertyId.ExtraProjectiles;
                const val = propId ? Math.floor(player.playerProp.getValue(propId)) : 0;
                valLabel.string = `${entry.label} (${val})`;
            };

            this._createBtn(row, '+1', addColor, () => {
                player.buffMgr.addBuff(entry.data, player.buffOwner);
                updateLabel();
                console.log(`[Proj] ${entry.label} +1`);
            });
            this._createBtn(row, '重置', rmColor, () => {
                player.buffMgr.removeBuff(entry.data.id);
                updateLabel();
                console.log(`[Proj] ${entry.label} 重置`);
            });
        }
    }

    private _buildResetButtons(parent: Node) {
        const row = this._createRow(parent);
        this._createBtn(row, '敌人满血', new Color(40, 80, 160, 230), () => {
            if (this._enemy) {
                this._enemy.combat.reset();
                console.log('[Test] 敌人已重置满血');
            }
        });
        this._createBtn(row, '玩家满血', new Color(40, 80, 160, 230), () => {
            if (this._player) {
                this._player.combat.reset();
                console.log('[Test] 玩家已重置满血');
            }
        });
    }

    private _createRow(parent: Node): Node {
        const row = new Node('Row');
        parent.addChild(row);
        row.addComponent(UITransform).setContentSize(360, 36);
        const l = row.addComponent(Layout);
        l.type = Layout.Type.HORIZONTAL;
        l.spacingX = 8;
        l.resizeMode = Layout.ResizeMode.NONE;
        return row;
    }

    private _createSectionLabel(parent: Node, text: string) {
        this._createLabel(parent, text, 14, new Color(200, 200, 200, 180));
    }

    private _createBtn(parent: Node, text: string, bgColor: Color, onClick: () => void): Node {
        const btn = new Node(text);
        parent.addChild(btn);

        const ut = btn.addComponent(UITransform);
        ut.setContentSize(90, 32);

        const g = btn.addComponent(Graphics);
        g.fillColor = bgColor;
        g.roundRect(-45, -16, 90, 32, 6);
        g.fill();

        const button = btn.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 0.9;
        btn.on('click', onClick, this);

        const labelNode = new Node('Label');
        btn.addChild(labelNode);
        labelNode.addComponent(UITransform).setContentSize(90, 32);
        const label = labelNode.addComponent(Label);
        label.string = text;
        label.fontSize = 14;
        label.lineHeight = 32;
        label.color = Color.WHITE;
        label.enableOutline = true;
        label.outlineColor = new Color(0, 0, 0, 180);
        label.outlineWidth = 1;

        return btn;
    }

    private _createLabel(parent: Node, text: string, fontSize: number, color: Color): Label {
        const node = new Node('Label');
        parent.addChild(node);
        node.addComponent(UITransform).setContentSize(360, 24);
        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = 22;
        label.color = color;
        label.overflow = Label.Overflow.NONE;
        label.enableOutline = true;
        label.outlineColor = new Color(0, 0, 0, 180);
        label.outlineWidth = 1;
        return label;
    }

    update() {
        if (this._player && this._playerStatusLabel) {
            const p = this._player.playerProp;
            const atk = p.getValue(EPropertyId.Attack);
            const crit = p.getValue(EPropertyId.CritRate);
            const atkSpd = p.getValue(EPropertyId.AttackSpeed);
            const pierce = Math.floor(p.getValue(EPropertyId.PierceCount));
            const bounce = Math.floor(p.getValue(EPropertyId.BounceCount));
            const extra = Math.floor(p.getValue(EPropertyId.ExtraProjectiles));
            const hp = this._player.combat.currentHp;
            const maxHp = this._player.combat.maxHp;
            this._playerStatusLabel.string =
                `HP:${hp}/${maxHp}  ATK:${atk.toFixed(0)}  Crit:${(crit * 100).toFixed(0)}%` +
                `  AtkSpd:${atkSpd.toFixed(1)}  箭:${1 + extra}  穿:${pierce}  弹:${bounce}`;
        }

        if (this._enemy && this._enemyStatusLabel) {
            const hp = this._enemy.combat.currentHp;
            const maxHp = this._enemy.combat.maxHp;
            const def = this._enemy.prop.getValue(EPropertyId.Defense);
            this._enemyStatusLabel.string = `Enemy HP:${hp}/${maxHp}  DEF:${def.toFixed(0)}`;
        }
    }
}
