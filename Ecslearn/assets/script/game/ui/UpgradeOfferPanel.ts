import {
    _decorator, Component, Node, Color, Label, Sprite, UITransform, Widget, UIOpacity,
    EventTouch, Size,
} from 'cc';
import { emit, on, off } from '../../baseSystem/util';
import {
    GameEvt,
    type UpgradeOfferShowEvent,
    type UpgradeChosenEvent,
    type UpgradeRerollEvent,
} from '../events/GameEvents';
import type { UpgradeConfig } from '../upgrade/types';
import { getWhiteSF, rarityToColor } from './UiAtlas';

const { ccclass } = _decorator;

// 布局常数
const PANEL_DIM_COLOR  = new Color(0, 0, 0, 180);    // 背景半透明黑
const CARD_W = 220;
const CARD_H = 300;
const CARD_GAP = 30;
const FRAME_THICKNESS = 6;
const REROLL_W = 200;
const REROLL_H = 60;

/**
 * 升级三选一面板（纯视图）
 *
 * 设计：
 *   - 生命周期：onLoad 建节点树（初始 active=false）；监听 UpgradeOfferShow / UpgradeReroll 事件
 *   - 外部调用面：**零** —— 只走 EventBus。LevelManager 不需要直接拿到本组件引用
 *   - 用户交互：
 *     - 点卡片 → emit GameEvt.UpgradeChosen，面板自动隐藏
 *     - 点刷新 → emit GameEvt.UpgradeReroll（quota=0 时按钮灰，不可点）
 *
 * Linus 式好品味：
 *   - 完全不知道 UpgradeOfferSystem 是什么；只认 UpgradeConfig 和事件名
 *   - 卡片可动态 0/1/2/3 张（候选池不足场景），用 forEach 渲染
 *   - rarity → 颜色查表，不 switch
 */
@ccclass('UpgradeOfferPanel')
export class UpgradeOfferPanel extends Component {

    private _dim!: Node;
    private _title!: Label;
    private _cards: CardView[] = [];
    private _rerollBtn!: Node;
    private _rerollBtnSprite!: Sprite;
    private _rerollLabel!: Label;
    private _rerollQuota = 0;

    onLoad(): void {
        this._build();
        this.node.active = false;
        on(GameEvt.UpgradeOfferShow, this._onOfferShow);
    }

    onDestroy(): void {
        off(GameEvt.UpgradeOfferShow, this._onOfferShow);
    }

    // ─── 对外（仅事件驱动）─────────────────────

    /** 事件监听入口 —— LevelManager emit(OfferShow, {offers, rerollQuota}) 就自动弹出 */
    private _onOfferShow = (e: UpgradeOfferShowEvent): void => {
        this._show(e.offers, e.rerollQuota);
    };

    private _show(offers: readonly UpgradeConfig[], rerollQuota: number): void {
        this._rerollQuota = rerollQuota;

        // 渲染卡片
        for (let i = 0; i < this._cards.length; i++) {
            const v = this._cards[i];
            const cfg = offers[i];
            if (cfg) {
                v.show(cfg);
            } else {
                v.hide();
            }
        }

        // 刷新按钮状态
        this._updateRerollBtn();

        this.node.active = true;
    }

    private _hide(): void {
        this.node.active = false;
    }

    // ─── 事件回调 ──────────────────────────────

    private _onCardClick(cfg: UpgradeConfig): void {
        const payload: UpgradeChosenEvent = { id: cfg.id };
        emit(GameEvt.UpgradeChosen, payload);
        this._hide();
    }

    private _onRerollClick(): void {
        if (this._rerollQuota <= 0) return;  // 门禁
        this._rerollQuota -= 1;
        this._updateRerollBtn();
        const payload: UpgradeRerollEvent = { remainingQuota: this._rerollQuota };
        emit(GameEvt.UpgradeReroll, payload);
        // 不 _hide —— 等外部再次 emit UpgradeOfferShow 刷新卡片
    }

    private _updateRerollBtn(): void {
        const can = this._rerollQuota > 0;
        this._rerollBtnSprite.color = can
            ? new Color(120, 180, 80, 255)   // 绿 = 可点
            : new Color(80, 80, 80, 255);    // 灰 = 禁用
        this._rerollLabel.string = can
            ? `刷新 (剩 ${this._rerollQuota})`
            : `刷新 (0)`;
    }

    // ─── 节点树构建 ─────────────────────────────

    private _build(): void {
        // Panel 自身 —— 全屏
        const widget = this.node.addComponent(Widget);
        widget.isAlignTop = widget.isAlignBottom = true;
        widget.isAlignLeft = widget.isAlignRight = true;
        widget.top = widget.bottom = widget.left = widget.right = 0;

        this._dim        = this._buildDim();
        const title      = this._buildTitle();
        this._title      = title;
        const cardRow    = this._buildCardRow();
        this._cards      = cardRow.cards;
        this._rerollBtn  = this._buildRerollBtn();
    }

    private _buildDim(): Node {
        const n = new Node('Dim');
        this.node.addChild(n);
        const w = n.addComponent(Widget);
        w.isAlignTop = w.isAlignBottom = true;
        w.isAlignLeft = w.isAlignRight = true;
        w.top = w.bottom = w.left = w.right = 0;

        const sp = n.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.spriteFrame = getWhiteSF();
        sp.color = PANEL_DIM_COLOR;

        return n;
    }

    private _buildTitle(): Label {
        const n = new Node('Title');
        this.node.addChild(n);
        n.setPosition(0, 220, 0);

        const ut = n.addComponent(UITransform);
        ut.setContentSize(new Size(400, 60));

        const lbl = n.addComponent(Label);
        lbl.fontSize = 36;
        lbl.lineHeight = 44;
        lbl.color = new Color(255, 240, 200, 255);
        lbl.string = '选择一张升级';
        lbl.enableOutline = true;
        lbl.outlineColor = new Color(0, 0, 0, 220);
        lbl.outlineWidth = 2;
        return lbl;
    }

    private _buildCardRow(): { row: Node; cards: CardView[] } {
        const row = new Node('CardRow');
        this.node.addChild(row);

        const cards: CardView[] = [];
        // 横向 3 卡居中
        const totalW = CARD_W * 3 + CARD_GAP * 2;
        const startX = -totalW / 2 + CARD_W / 2;

        for (let i = 0; i < 3; i++) {
            const v = new CardView(
                row,
                startX + i * (CARD_W + CARD_GAP),
                0,
                (cfg) => this._onCardClick(cfg),
            );
            cards.push(v);
        }
        return { row, cards };
    }

    private _buildRerollBtn(): Node {
        const n = new Node('RerollBtn');
        this.node.addChild(n);
        n.setPosition(0, -220, 0);

        const ut = n.addComponent(UITransform);
        ut.setContentSize(new Size(REROLL_W, REROLL_H));

        const sp = n.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.spriteFrame = getWhiteSF();
        sp.color = new Color(120, 180, 80, 255);
        this._rerollBtnSprite = sp;

        // 文字
        const lblNode = new Node('Label');
        n.addChild(lblNode);
        const lblUt = lblNode.addComponent(UITransform);
        lblUt.setContentSize(REROLL_W, REROLL_H);
        const lbl = lblNode.addComponent(Label);
        lbl.fontSize = 22;
        lbl.lineHeight = REROLL_H;
        lbl.color = new Color(255, 255, 255, 255);
        lbl.enableOutline = true;
        lbl.outlineColor = new Color(0, 0, 0, 200);
        lbl.outlineWidth = 2;
        this._rerollLabel = lbl;

        n.on(Node.EventType.TOUCH_END, (_e: EventTouch) => this._onRerollClick(), this);
        return n;
    }
}

/**
 * 单张升级卡视图 —— 由 UpgradeOfferPanel 内部用，不对外
 */
class CardView {
    private _node: Node;
    private _frame: Sprite;
    private _name: Label;
    private _desc: Label;
    private _cfg: UpgradeConfig | null = null;

    constructor(parent: Node, x: number, y: number, onClick: (cfg: UpgradeConfig) => void) {
        this._node = new Node('UpgradeCard');
        parent.addChild(this._node);
        this._node.setPosition(x, y, 0);

        const ut = this._node.addComponent(UITransform);
        ut.setContentSize(new Size(CARD_W, CARD_H));

        // 外框（rarity 颜色）
        const frame = this._node.addComponent(Sprite);
        frame.sizeMode = Sprite.SizeMode.CUSTOM;
        frame.spriteFrame = getWhiteSF();
        frame.color = new Color(180, 180, 180, 255);
        this._frame = frame;

        // 内部深色底板
        const inner = new Node('Inner');
        this._node.addChild(inner);
        const iut = inner.addComponent(UITransform);
        iut.setContentSize(CARD_W - FRAME_THICKNESS * 2, CARD_H - FRAME_THICKNESS * 2);
        const isp = inner.addComponent(Sprite);
        isp.sizeMode = Sprite.SizeMode.CUSTOM;
        isp.spriteFrame = getWhiteSF();
        isp.color = new Color(30, 30, 35, 240);

        // 名字（上半部）
        const nameNode = new Node('Name');
        inner.addChild(nameNode);
        nameNode.setPosition(0, CARD_H / 2 - 70, 0);
        const nameUt = nameNode.addComponent(UITransform);
        nameUt.setContentSize(CARD_W - 20, 50);
        const nameLbl = nameNode.addComponent(Label);
        nameLbl.fontSize = 24;
        nameLbl.lineHeight = 30;
        nameLbl.color = new Color(255, 240, 200, 255);
        nameLbl.string = '';
        this._name = nameLbl;

        // 描述（下半部）
        const descNode = new Node('Desc');
        inner.addChild(descNode);
        descNode.setPosition(0, -20, 0);
        const descUt = descNode.addComponent(UITransform);
        descUt.setContentSize(CARD_W - 30, 150);
        const descLbl = descNode.addComponent(Label);
        descLbl.fontSize = 18;
        descLbl.lineHeight = 26;
        descLbl.color = new Color(220, 220, 220, 255);
        descLbl.string = '';
        descLbl.overflow = Label.Overflow.RESIZE_HEIGHT;
        descLbl.enableWrapText = true;
        this._desc = descLbl;

        this._node.on(Node.EventType.TOUCH_END, () => {
            if (this._cfg) onClick(this._cfg);
        }, this);
        this._node.active = false;
    }

    show(cfg: UpgradeConfig): void {
        this._cfg = cfg;
        this._frame.color = rarityToColor(cfg.rarity);
        this._name.string = cfg.name;
        this._desc.string = cfg.desc ?? '';
        this._node.active = true;
    }

    hide(): void {
        this._cfg = null;
        this._node.active = false;
    }
}
