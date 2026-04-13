import {
    _decorator, Component, Node, Label, Color, UITransform,
    Graphics, Button, Widget, Layout, ScrollView, Mask, director,
} from 'cc';
import { EPropertyId } from '../config/enum/propertyEnum';
import { PlayerControl } from '../player/PlayerControl';
import { EnemyControl } from '../enemy/EnemyControl';
import { ArrowStormSkill } from '../skill/ArrowStormSkill';
import { DashShotSkill } from '../skill/DashShotSkill';
import type { IActiveSkill } from '../skill/SkillTypes';

const { ccclass } = _decorator;

interface SkillEntry {
    skill: IActiveSkill;
    cdLabel: Label;
    statusLabel: Label;
}

@ccclass('BattleTestPanel')
export class BattleTestPanel extends Component {
    private _player: PlayerControl | null = null;
    private _enemy: EnemyControl | null = null;
    private _statusLabel: Label | null = null;
    private _skillEntries: SkillEntry[] = [];

    private _availableSkills: IActiveSkill[] = [
        new ArrowStormSkill(),
        new DashShotSkill(),
    ];

    start() {
        this._player = director.getScene()?.getComponentInChildren(PlayerControl) ?? null;
        this._enemy = EnemyControl.allEnemies[0] ?? null;

        if (!this._player) {
            console.error('[BattleTestPanel] 场景中找不到 PlayerControl');
            return;
        }
        this._buildUI();
    }

    private _buildUI() {
        const root = new Node('TestPanel');
        this.node.addChild(root);

        const w = root.addComponent(Widget);
        w.isAlignLeft = true; w.isAlignTop = true;
        w.left = 20; w.top = 20;
        w.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;

        const rootLayout = root.addComponent(Layout);
        rootLayout.type = Layout.Type.VERTICAL;
        rootLayout.spacingY = 4;
        rootLayout.resizeMode = Layout.ResizeMode.CONTAINER;
        root.addComponent(UITransform).setContentSize(380, 400);

        this._statusLabel = this._createLabel(root, '', 14, new Color(80, 220, 80, 255));

        this._createSectionLabel(root, '--- 主动技能 ---');
        for (const skill of this._availableSkills) {
            this._buildSkillRow(root, skill);
        }

        this._createSectionLabel(root, '--- 重置 ---');
        const row = this._createRow(root);
        this._createBtn(row, '敌人满血', new Color(40, 80, 160, 230), () => this._enemy?.combat.reset());
        this._createBtn(row, '玩家满血', new Color(40, 80, 160, 230), () => this._player?.combat.reset());
    }

    private _buildSkillRow(parent: Node, skill: IActiveSkill) {
        const row = new Node('SkillRow');
        parent.addChild(row);
        row.addComponent(UITransform).setContentSize(380, 36);
        const l = row.addComponent(Layout);
        l.type = Layout.Type.HORIZONTAL;
        l.spacingX = 6;
        l.resizeMode = Layout.ResizeMode.NONE;

        const nameLabel = this._createLabel(row, skill.name, 13, new Color(255, 200, 80, 255));
        nameLabel.node.getComponent(UITransform)!.setContentSize(80, 30);

        const cdLabel = this._createLabel(row, '', 12, new Color(200, 200, 200, 220));
        cdLabel.node.getComponent(UITransform)!.setContentSize(60, 30);

        const statusLabel = this._createLabel(row, '', 12, new Color(100, 100, 100, 100));
        statusLabel.node.getComponent(UITransform)!.setContentSize(30, 30);

        this._skillEntries.push({ skill, cdLabel, statusLabel });

        const sys = this._player!.skillSystem;
        const ctx = () => this._player!.buildSkillContext();

        this._createBtn(row, '装备', new Color(40, 120, 60, 230), () => {
            if (sys.has(skill.id)) {
                sys.unequip(skill.id, ctx());
            } else {
                sys.equip(skill);
            }
        }, 56);

        this._createBtn(row, '释放', new Color(160, 60, 40, 230), () => {
            if (!sys.has(skill.id)) sys.equip(skill);
            if (!sys.tryUse(skill.id, ctx())) {
                console.warn(`[BattleTestPanel] ${skill.name} 释放失败 (CD:${skill.currentCd.toFixed(1)})`);
            }
        }, 56);
    }

    // ── 工具方法 ───────────────────────────────────────

    private _createRow(parent: Node): Node {
        const row = new Node('Row');
        parent.addChild(row);
        row.addComponent(UITransform).setContentSize(380, 34);
        const l = row.addComponent(Layout);
        l.type = Layout.Type.HORIZONTAL;
        l.spacingX = 6;
        l.resizeMode = Layout.ResizeMode.NONE;
        return row;
    }

    private _createSectionLabel(parent: Node, text: string) {
        this._createLabel(parent, text, 13, new Color(200, 200, 200, 140));
    }

    private _createBtn(parent: Node, text: string, bgColor: Color, onClick: () => void, width = 70): Node {
        const btn = new Node(text);
        parent.addChild(btn);

        const hw = width / 2;
        btn.addComponent(UITransform).setContentSize(width, 28);

        const g = btn.addComponent(Graphics);
        g.fillColor = bgColor;
        g.roundRect(-hw, -14, width, 28, 5);
        g.fill();

        const button = btn.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 0.9;
        btn.on('click', onClick, this);

        const labelNode = new Node('Label');
        btn.addChild(labelNode);
        labelNode.addComponent(UITransform).setContentSize(width, 28);
        const label = labelNode.addComponent(Label);
        label.string = text;
        label.fontSize = 12;
        label.lineHeight = 28;
        label.color = Color.WHITE;
        label.enableOutline = true;
        label.outlineColor = new Color(0, 0, 0, 180);
        label.outlineWidth = 1;

        return btn;
    }

    private _createLabel(parent: Node, text: string, fontSize: number, color: Color): Label {
        const node = new Node('Label');
        parent.addChild(node);
        node.addComponent(UITransform).setContentSize(380, 22);
        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = 20;
        label.color = color;
        label.overflow = Label.Overflow.NONE;
        label.enableOutline = true;
        label.outlineColor = new Color(0, 0, 0, 160);
        label.outlineWidth = 1;
        return label;
    }

    // ── 每帧更新状态 ──────────────────────────────────

    update() {
        const player = this._player;
        if (!player) return;

        if (this._statusLabel) {
            const p = player.playerProp;
            const hp    = player.combat.currentHp;
            const maxHp = player.combat.maxHp;
            const atk   = p.getValue(EPropertyId.Attack);
            const spd   = p.getValue(EPropertyId.AttackSpeed);
            const extra = Math.floor(p.getValue(EPropertyId.ExtraProjectiles));
            this._statusLabel.string =
                `HP:${hp}/${maxHp}  ATK:${atk.toFixed(0)}  SPD:${spd.toFixed(1)}` +
                `  箭:${1 + extra}  技能:${player.skillSystem.count}`;
        }

        const sys = player.skillSystem;
        for (const entry of this._skillEntries) {
            const { skill, cdLabel, statusLabel } = entry;
            const equipped = sys.has(skill.id);
            statusLabel.string = equipped ? 'ON' : '';
            statusLabel.color = equipped
                ? new Color(60, 220, 60, 255)
                : new Color(100, 100, 100, 100);

            if (equipped) {
                const cd = skill.currentCd;
                cdLabel.string = cd > 0 ? `CD:${cd.toFixed(1)}` : '就绪';
                cdLabel.color = cd > 0
                    ? new Color(255, 100, 100, 220)
                    : new Color(80, 220, 80, 220);
            } else {
                cdLabel.string = '未装备';
                cdLabel.color = new Color(120, 120, 120, 160);
            }
        }
    }
}
