import {
    _decorator, Component, Node, Label, Color, UITransform,
    Graphics, Button, Widget, Layout, director,
} from 'cc';
import type { HitEffectData } from '../../baseSystem/hitEffect';
import { EPropertyId } from '../config/enum/propertyEnum';
import { PlayerControl } from '../player/PlayerControl';
import { EnemyControl } from '../enemy/EnemyControl';

const { ccclass } = _decorator;

interface ToggleEntry {
    label: string;
    data: HitEffectData;
}

const HIT_EFFECT_TESTS: ToggleEntry[] = [
    {
        label: '灼烧 20%',
        data: { id: 'test-burn', effectClass: 'BurnOnHitEffect', priority: 50,
                burnRatio: 0.2, burnBuffId: 8001 },
    },
    {
        label: '冻伤 -15%速/层',
        data: { id: 'test-frost', effectClass: 'FrostOnHitEffect', priority: 50,
                frostBuffId: 8101, frostSlowPerStack: 0.15, frostDuration: 3, frostMaxStack: 5 },
    },
    {
        label: '闪电链 100%',
        data: { id: 'test-chain', effectClass: 'ChainLightningEffect', priority: 80,
                chance: 1.0, jumps: 3, chainRatio: 0.5, chainDecay: 0.7, chainRange: 300 },
    },
    {
        label: '击退 60px',
        data: { id: 'test-knockback', effectClass: 'KnockbackEffect', priority: 90,
                knockDist: 60 },
    },
    {
        label: '吸血',
        data: { id: 'test-lifesteal', effectClass: 'LifestealHitEffect', priority: 100 },
    },
    {
        label: '命中回血+10',
        data: { id: 'test-life-on-hit', effectClass: 'LifeOnHitEffect', priority: 100,
                healAmount: 10 },
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

        panel.addComponent(UITransform).setContentSize(380, 500);

        this._playerStatusLabel = this._createLabel(panel, '', 16, new Color(80, 220, 80, 255));
        this._enemyStatusLabel = this._createLabel(panel, '', 16, new Color(255, 100, 100, 255));

        this._createSectionLabel(panel, '--- 命中效果开关 ---');
        this._buildHitEffectToggles(panel);

        this._createSectionLabel(panel, '--- 重置 ---');
        this._buildResetButtons(panel);
    }

    private _buildHitEffectToggles(parent: Node) {
        const mgr = this._player!.hitEffectMgr;
        const onColor = new Color(30, 120, 50, 230);
        const offColor = new Color(140, 40, 40, 230);

        for (const entry of HIT_EFFECT_TESTS) {
            const row = this._createRow(parent);
            const statusLabel = this._createLabel(row, `[OFF] ${entry.label}`, 14, new Color(255, 100, 100, 255));
            statusLabel.node.getComponent(UITransform)!.setContentSize(180, 32);

            this._createBtn(row, '开启', onColor, () => {
                if (mgr.has(entry.data.id)) return;
                mgr.add(entry.data);
                statusLabel.string = `[ON]  ${entry.label}`;
                statusLabel.color = new Color(80, 220, 80, 255);
            });
            this._createBtn(row, '关闭', offColor, () => {
                if (!mgr.has(entry.data.id)) return;
                mgr.remove(entry.data.id);
                statusLabel.string = `[OFF] ${entry.label}`;
                statusLabel.color = new Color(255, 100, 100, 255);
            });
        }
    }

    private _buildResetButtons(parent: Node) {
        const row = this._createRow(parent);
        this._createBtn(row, '敌人满血', new Color(40, 80, 160, 230), () => {
            if (this._enemy) {
                this._enemy.combat.reset();
            }
        });
        this._createBtn(row, '玩家满血', new Color(40, 80, 160, 230), () => {
            if (this._player) {
                this._player.combat.reset();
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
        ut.setContentSize(80, 32);

        const g = btn.addComponent(Graphics);
        g.fillColor = bgColor;
        g.roundRect(-40, -16, 80, 32, 6);
        g.fill();

        const button = btn.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 0.9;
        btn.on('click', onClick, this);

        const labelNode = new Node('Label');
        btn.addChild(labelNode);
        labelNode.addComponent(UITransform).setContentSize(80, 32);
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
            const hp = this._player.combat.currentHp;
            const maxHp = this._player.combat.maxHp;
            const effects = this._player.hitEffectMgr.count;
            this._playerStatusLabel.string =
                `HP:${hp}/${maxHp}  ATK:${atk.toFixed(0)}  Crit:${(crit * 100).toFixed(0)}%` +
                `  AtkSpd:${atkSpd.toFixed(1)}  Effects:${effects}`;
        }

        if (this._enemy && this._enemyStatusLabel) {
            const hp = this._enemy.combat.currentHp;
            const maxHp = this._enemy.combat.maxHp;
            const def = this._enemy.prop.getValue(EPropertyId.Defense);
            const spd = this._enemy.prop.getValue(EPropertyId.MoveSpeed);
            this._enemyStatusLabel.string =
                `Enemy HP:${hp}/${maxHp}  DEF:${def.toFixed(0)}  SPD:${spd.toFixed(0)}`;
        }
    }
}
