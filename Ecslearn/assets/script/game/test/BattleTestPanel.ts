import {
    _decorator, Component, Node, Label, Color, UITransform,
    Graphics, Button, Widget, Layout, director,
} from 'cc';
import { EPropertyId } from '../config/enum/propertyEnum';
import { PlayerControl } from '../player/PlayerControl';
import { EnemyControl } from '../enemy/EnemyControl';
import { ArrowStormSkill } from '../skill/ArrowStormSkill';
import { DashShotSkill } from '../skill/DashShotSkill';
import type { IActiveSkill } from '../skill/SkillTypes';
import type { UpgradeConfig } from '../upgrade/types';
import { ALL_UPGRADES } from '../upgrade/upgradeConfigs';

const { ccclass } = _decorator;

const C_GREEN  = new Color(80, 220, 80, 255);
const C_GRAY   = new Color(100, 100, 100, 100);
const C_RED_CD = new Color(255, 100, 100, 220);
const C_OK_CD  = new Color(80, 220, 80, 220);
const C_OFF_CD = new Color(120, 120, 120, 160);

const RARITY_COLOR: Record<string, Color> = {
    common:    new Color(200, 200, 200, 255),
    rare:      new Color(80, 160, 255, 255),
    epic:      new Color(180, 80, 255, 255),
    legendary: new Color(255, 180, 40, 255),
};
const RARITY_BG: Record<string, Color> = {
    common:    new Color(50, 50, 50, 200),
    rare:      new Color(25, 45, 80, 200),
    epic:      new Color(50, 25, 70, 200),
    legendary: new Color(70, 50, 15, 200),
};

const PICKS_PER_TIER = 6;
const TOTAL_TIERS    = 3;
const CHOICES_COUNT  = 3;

interface SkillEntry {
    skill: IActiveSkill;
    cdLabel: Label;
    statusLabel: Label;
}

interface ChoiceUI {
    root: Node;
    nameLabel: Label;
    descLabel: Label;
    bg: Graphics;
    config: UpgradeConfig | null;
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

    private _tierPools = new Map<number, UpgradeConfig[]>();
    private _currentTier  = 1;
    private _picksThisTier = 0;
    private _pickedList: UpgradeConfig[] = [];
    private _pickedSet  = new Set<string>();
    private _choices: ChoiceUI[] = [];
    private _tierLabel: Label | null = null;
    private _pickedLabel: Label | null = null;
    private _choicesContainer: Node | null = null;
    private _refreshBtnNode: Node | null = null;
    private _finished = false;

    start() {
        this._player = director.getScene()?.getComponentInChildren(PlayerControl) ?? null;
        this._enemy = EnemyControl.allEnemies[0] ?? null;

        if (!this._player) {
            console.error('[BattleTestPanel] 场景中找不到 PlayerControl');
            return;
        }

        this._buildPools();
        this._buildUI();
        this._rollChoices();
    }

    private _buildPools() {
        for (const cfg of ALL_UPGRADES) {
            if (cfg.evolvesFrom?.length) continue;
            let pool = this._tierPools.get(cfg.tier);
            if (!pool) { pool = []; this._tierPools.set(cfg.tier, pool); }
            pool.push(cfg);
        }
    }

    // ── UI 构建 ─────────────────────────────────────────

    private _buildUI() {
        const root = new Node('TestPanel');
        this.node.addChild(root);

        const w = root.addComponent(Widget);
        w.isAlignLeft = true; w.isAlignTop = true;
        w.left = 20; w.top = 20;
        w.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;

        const lay = root.addComponent(Layout);
        lay.type = Layout.Type.VERTICAL;
        lay.spacingY = 4;
        lay.resizeMode = Layout.ResizeMode.CONTAINER;
        root.addComponent(UITransform).setContentSize(420, 600);

        this._statusLabel = this._label(root, '', 14, C_GREEN);

        this._sectionLabel(root, '--- 主动技能 ---');
        for (const skill of this._availableSkills) {
            this._buildSkillRow(root, skill);
        }

        this._sectionLabel(root, '--- 进化选择 ---');
        this._tierLabel = this._label(root, '', 13, new Color(255, 220, 100, 255));

        this._choicesContainer = new Node('Choices');
        root.addChild(this._choicesContainer);
        const cLay = this._choicesContainer.addComponent(Layout);
        cLay.type = Layout.Type.VERTICAL;
        cLay.spacingY = 3;
        cLay.resizeMode = Layout.ResizeMode.CONTAINER;
        this._choicesContainer.addComponent(UITransform).setContentSize(420, 120);

        for (let i = 0; i < CHOICES_COUNT; i++) {
            this._choices.push(this._buildChoiceRow(this._choicesContainer, i));
        }

        const refreshRow = this._row(root);
        this._refreshBtnNode = this._btn(refreshRow, '🔄 刷新选择', new Color(80, 80, 120, 230), () => this._rollChoices(), 110);

        this._sectionLabel(root, '--- 已选升级 ---');
        this._pickedLabel = this._label(root, '(无)', 12, new Color(180, 180, 180, 200));

        this._sectionLabel(root, '--- 操作 ---');
        const opRow = this._row(root);
        this._btn(opRow, '敌人满血', new Color(40, 80, 160, 230), () => this._enemy?.combat.reset());
        this._btn(opRow, '玩家满血', new Color(40, 80, 160, 230), () => this._player?.combat.reset());
        this._btn(opRow, '重置全部', new Color(160, 40, 40, 230), () => this._resetAll());
    }

    private _buildChoiceRow(parent: Node, idx: number): ChoiceUI {
        const root = new Node(`Choice_${idx}`);
        parent.addChild(root);
        root.addComponent(UITransform).setContentSize(400, 32);
        const lay = root.addComponent(Layout);
        lay.type = Layout.Type.HORIZONTAL;
        lay.spacingX = 6;
        lay.resizeMode = Layout.ResizeMode.NONE;

        const bgNode = new Node('BG');
        root.addChild(bgNode);
        bgNode.addComponent(UITransform).setContentSize(280, 30);
        const bg = bgNode.addComponent(Graphics);
        bg.fillColor = new Color(50, 50, 50, 200);
        bg.roundRect(-140, -15, 280, 30, 4);
        bg.fill();

        const nameLabel = this._label(bgNode, '', 13, Color.WHITE);
        nameLabel.node.getComponent(UITransform)!.setContentSize(100, 28);
        nameLabel.horizontalAlign = Label.HorizontalAlign.LEFT;

        const descLabel = this._label(bgNode, '', 11, new Color(180, 180, 180, 220));
        descLabel.node.getComponent(UITransform)!.setContentSize(170, 28);
        descLabel.horizontalAlign = Label.HorizontalAlign.LEFT;

        this._btn(root, '选择', new Color(40, 130, 60, 230), () => this._pickChoice(idx), 56);

        return { root, nameLabel, descLabel, bg, config: null };
    }

    private _buildSkillRow(parent: Node, skill: IActiveSkill) {
        const row = new Node('SkillRow');
        parent.addChild(row);
        row.addComponent(UITransform).setContentSize(420, 36);
        const l = row.addComponent(Layout);
        l.type = Layout.Type.HORIZONTAL;
        l.spacingX = 6;
        l.resizeMode = Layout.ResizeMode.NONE;

        const nameLabel = this._label(row, skill.name, 13, new Color(255, 200, 80, 255));
        nameLabel.node.getComponent(UITransform)!.setContentSize(80, 30);

        const cdLabel = this._label(row, '', 12, new Color(200, 200, 200, 220));
        cdLabel.node.getComponent(UITransform)!.setContentSize(60, 30);

        const statusLabel = this._label(row, '', 12, C_GRAY);
        statusLabel.node.getComponent(UITransform)!.setContentSize(30, 30);

        this._skillEntries.push({ skill, cdLabel, statusLabel });

        const sys = this._player!.skillSystem;
        const ctx = () => this._player!.buildSkillContext();

        this._btn(row, '装备', new Color(40, 120, 60, 230), () => {
            if (sys.has(skill.id)) { sys.unequip(skill.id, ctx()); }
            else { sys.equip(skill); }
        }, 56);

        this._btn(row, '释放', new Color(160, 60, 40, 230), () => {
            if (!sys.has(skill.id)) sys.equip(skill);
            if (!sys.tryUse(skill.id, ctx())) {
                console.warn(`[BattleTestPanel] ${skill.name} 释放失败 (CD:${skill.currentCd.toFixed(1)})`);
            }
        }, 56);
    }

    // ── 肉鸽选择逻辑 ───────────────────────────────────

    private _rollChoices() {
        if (this._finished) return;

        const pool = this._tierPools.get(this._currentTier) ?? [];
        const available = pool.filter(c => !this._pickedSet.has(c.id));

        const shuffled = available.slice();
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        const picked = shuffled.slice(0, CHOICES_COUNT);

        for (let i = 0; i < CHOICES_COUNT; i++) {
            const ui = this._choices[i];
            const cfg = picked[i] ?? null;
            ui.config = cfg;

            if (cfg) {
                ui.root.active = true;
                const rarityC = RARITY_COLOR[cfg.rarity] ?? Color.WHITE;
                ui.nameLabel.string = cfg.name;
                ui.nameLabel.color = rarityC;
                ui.descLabel.string = cfg.desc;

                const bgC = RARITY_BG[cfg.rarity] ?? RARITY_BG.common;
                ui.bg.clear();
                ui.bg.fillColor = bgC;
                ui.bg.roundRect(-140, -15, 280, 30, 4);
                ui.bg.fill();
            } else {
                ui.root.active = false;
            }
        }

        this._updateTierLabel();
    }

    private _pickChoice(idx: number) {
        if (this._finished) return;
        const ui = this._choices[idx];
        if (!ui.config) return;

        const mgr = this._player!.upgradeMgr;
        const ok = mgr.apply(ui.config);
        if (!ok) {
            console.warn(`[BattleTestPanel] 升级 ${ui.config.id} 应用失败`);
            return;
        }

        this._pickedList.push(ui.config);
        this._pickedSet.add(ui.config.id);
        this._picksThisTier++;

        if (this._picksThisTier >= PICKS_PER_TIER) {
            this._currentTier++;
            this._picksThisTier = 0;

            if (this._currentTier > TOTAL_TIERS) {
                this._finished = true;
                this._onFinished();
                return;
            }
        }

        this._rollChoices();
        this._updatePickedLabel();
    }

    private _onFinished() {
        for (const ui of this._choices) ui.root.active = false;
        if (this._refreshBtnNode) this._refreshBtnNode.active = false;
        this._updateTierLabel();
        this._updatePickedLabel();
    }

    private _resetAll() {
        const mgr = this._player!.upgradeMgr;
        for (const id of [...mgr.appliedIds]) mgr.remove(id);

        this._currentTier = 1;
        this._picksThisTier = 0;
        this._pickedList = [];
        this._pickedSet.clear();
        this._finished = false;

        if (this._refreshBtnNode) this._refreshBtnNode.active = true;

        this._rollChoices();
        this._updatePickedLabel();
    }

    private _updateTierLabel() {
        if (!this._tierLabel) return;
        if (this._finished) {
            this._tierLabel.string = `✅ 选择完成 (共${this._pickedList.length}个)`;
            return;
        }
        this._tierLabel.string =
            `第${this._currentTier}层 (${this._picksThisTier}/${PICKS_PER_TIER})` +
            `  剩余:${(this._tierPools.get(this._currentTier)?.length ?? 0) - this._picksCountForTier(this._currentTier)}`;
    }

    private _picksCountForTier(tier: number): number {
        return this._pickedList.filter(c => c.tier === tier).length;
    }

    private _updatePickedLabel() {
        if (!this._pickedLabel) return;
        if (this._pickedList.length === 0) {
            this._pickedLabel.string = '(无)';
            return;
        }
        const lines = this._pickedList.map((c, i) => `${i + 1}. ${c.name} (${c.desc})`);
        this._pickedLabel.string = lines.join('\n');
    }

    // ── 工具方法 ────────────────────────────────────────

    private _row(parent: Node): Node {
        const row = new Node('Row');
        parent.addChild(row);
        row.addComponent(UITransform).setContentSize(420, 34);
        const l = row.addComponent(Layout);
        l.type = Layout.Type.HORIZONTAL;
        l.spacingX = 6;
        l.resizeMode = Layout.ResizeMode.NONE;
        return row;
    }

    private _sectionLabel(parent: Node, text: string) {
        this._label(parent, text, 13, new Color(200, 200, 200, 140));
    }

    private _btn(parent: Node, text: string, bgColor: Color, onClick: () => void, width = 70): Node {
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

    private _label(parent: Node, text: string, fontSize: number, color: Color): Label {
        const node = new Node('Label');
        parent.addChild(node);
        node.addComponent(UITransform).setContentSize(420, 22);
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

    // ── 每帧更新 ────────────────────────────────────────

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
            const pierce = Math.floor(p.getValue(EPropertyId.PierceCount));
            const bounce = Math.floor(p.getValue(EPropertyId.BounceCount));
            this._statusLabel.string =
                `HP:${hp}/${maxHp}  ATK:${atk.toFixed(0)}  SPD:${spd.toFixed(1)}` +
                `  箭:${1 + extra}  穿:${pierce}  弹:${bounce}`;
        }

        const sys = player.skillSystem;
        for (const entry of this._skillEntries) {
            const { skill, cdLabel, statusLabel } = entry;
            const equipped = sys.has(skill.id);
            statusLabel.string = equipped ? 'ON' : '';
            statusLabel.color = equipped ? C_GREEN : C_GRAY;

            if (equipped) {
                const cd = skill.currentCd;
                cdLabel.string = cd > 0 ? `CD:${cd.toFixed(1)}` : '就绪';
                cdLabel.color = cd > 0 ? C_RED_CD : C_OK_CD;
            } else {
                cdLabel.string = '未装备';
                cdLabel.color = C_OFF_CD;
            }
        }
    }
}
