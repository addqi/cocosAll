import {
    _decorator, Component, Node, Color, Label, Sprite, UITransform, UIOpacity, Widget, Size,
} from 'cc';
import { PlayerControl } from '../player/PlayerControl';
import type { IActiveSkill } from '../skill/SkillTypes';
import { getWhiteSF } from './UiAtlas';

const { ccclass } = _decorator;

// ─── 布局 ─────────────────────────────────────────
const SLOT_SIZE = 100;        // 单个槽位边长
const SLOT_GAP  = 20;
const MAX_SLOTS = 3;          // 与 SkillSystem.maxSlots 对齐
// 屏幕右下：攻击按钮中心约 (3W/4, H/4)，技能栏放在攻击按钮上方 = (3W/4, H/4 + 200)
const POS_X_FACTOR = 0.75;    // 中心 X = W * 0.75
const POS_Y_OFFSET_PX = 200;  // 在攻击按钮中心 (H * 0.25) 之上 200px

// 颜色
const SLOT_BG_AVAILABLE = new Color( 60,  90, 160, 220);
const SLOT_BG_COOLING   = new Color( 50,  50,  60, 200);
const SLOT_BG_EMPTY     = new Color( 40,  40,  48, 120);
const COOL_COVER_COLOR  = new Color(  0,   0,   0, 140);
const KEY_COLOR         = new Color(255, 220, 100, 255);
const NAME_COLOR        = new Color(255, 255, 255, 240);
const CD_COLOR          = new Color(255, 240, 200, 255);

/**
 * 单槽视图。每个槽显示：
 *   - 背景圆（颜色按"可用 / 冷却中 / 空"切）
 *   - 半透明 cover 覆盖（冷却中时显示，覆盖比例 = cd 剩余 / maxCd）
 *   - 左下角"1/2/3"按键提示
 *   - 中央技能名（最多 3 个汉字）
 *   - 右上角剩余冷却秒数（仅冷却中显示）
 */
class SkillSlotView {
    readonly node: Node;
    private _bgSprite: Sprite;
    private _coolCoverNode: Node;
    private _coolCoverUt: UITransform;
    private _coolCoverSp: Sprite;
    private _coolLabel: Label;
    private _nameLabel: Label;

    constructor(parent: Node, x: number, y: number, slotIndex: number) {
        this.node = new Node(`SkillSlot${slotIndex}`);
        parent.addChild(this.node);
        this.node.setPosition(x, y, 0);

        const ut = this.node.addComponent(UITransform);
        ut.setContentSize(new Size(SLOT_SIZE, SLOT_SIZE));

        // 背景圆
        const bg = this.node.addComponent(Sprite);
        bg.sizeMode = Sprite.SizeMode.CUSTOM;
        bg.spriteFrame = getWhiteSF();
        bg.color = SLOT_BG_EMPTY;
        this._bgSprite = bg;

        // 冷却覆盖（半透明黑），用 height 缩放表示进度
        const coverNode = new Node('Cover');
        this.node.addChild(coverNode);
        const coverUt = coverNode.addComponent(UITransform);
        coverUt.anchorY = 0;   // 锚点底，cd 越多 height 越大向上覆盖
        coverUt.setContentSize(SLOT_SIZE, 0);
        coverNode.setPosition(0, -SLOT_SIZE / 2, 0);
        const coverSp = coverNode.addComponent(Sprite);
        coverSp.sizeMode = Sprite.SizeMode.CUSTOM;
        coverSp.spriteFrame = getWhiteSF();
        coverSp.color = COOL_COVER_COLOR;
        this._coolCoverNode = coverNode;
        this._coolCoverUt = coverUt;
        this._coolCoverSp = coverSp;

        // 按键提示（左下"1"/"2"/"3"）
        const keyNode = new Node('Key');
        this.node.addChild(keyNode);
        keyNode.setPosition(-SLOT_SIZE / 2 + 14, -SLOT_SIZE / 2 + 14, 0);
        const keyUt = keyNode.addComponent(UITransform);
        keyUt.setContentSize(new Size(28, 28));
        const keyLbl = keyNode.addComponent(Label);
        keyLbl.fontSize = 22;
        keyLbl.lineHeight = 28;
        keyLbl.color = KEY_COLOR;
        keyLbl.string = String(slotIndex + 1);
        keyLbl.enableOutline = true;
        keyLbl.outlineColor = new Color(0, 0, 0, 220);
        keyLbl.outlineWidth = 2;

        // 技能名（中央）
        const nameNode = new Node('Name');
        this.node.addChild(nameNode);
        nameNode.setPosition(0, 0, 0);
        const nameUt = nameNode.addComponent(UITransform);
        nameUt.setContentSize(new Size(SLOT_SIZE - 8, SLOT_SIZE));
        const nameLbl = nameNode.addComponent(Label);
        nameLbl.fontSize = 22;
        nameLbl.lineHeight = 26;
        nameLbl.color = NAME_COLOR;
        nameLbl.string = '';
        nameLbl.enableOutline = true;
        nameLbl.outlineColor = new Color(0, 0, 0, 220);
        nameLbl.outlineWidth = 2;
        nameLbl.overflow = Label.Overflow.RESIZE_HEIGHT;
        nameLbl.enableWrapText = true;
        this._nameLabel = nameLbl;

        // 冷却秒数（右上）
        const cdNode = new Node('Cd');
        this.node.addChild(cdNode);
        cdNode.setPosition(SLOT_SIZE / 2 - 16, SLOT_SIZE / 2 - 14, 0);
        const cdUt = cdNode.addComponent(UITransform);
        cdUt.setContentSize(new Size(40, 28));
        const cdLbl = cdNode.addComponent(Label);
        cdLbl.fontSize = 24;
        cdLbl.lineHeight = 28;
        cdLbl.color = CD_COLOR;
        cdLbl.string = '';
        cdLbl.enableOutline = true;
        cdLbl.outlineColor = new Color(0, 0, 0, 220);
        cdLbl.outlineWidth = 2;
        this._coolLabel = cdLbl;
    }

    /** 每帧调一次 —— 根据技能状态刷新视图 */
    update(skill: IActiveSkill | null): void {
        if (!skill) {
            this._bgSprite.color = SLOT_BG_EMPTY;
            this._nameLabel.string = '';
            this._coolLabel.string = '';
            this._coolCoverUt.setContentSize(SLOT_SIZE, 0);
            return;
        }

        // 名字（取技能 name 前 3 字符，避免溢出）
        this._nameLabel.string = skill.name.length > 3
            ? skill.name.substring(0, 3)
            : skill.name;

        const cdRemain = skill.currentCd;
        const maxCd = skill.maxCooldown;
        if (cdRemain > 0 && maxCd > 0) {
            // 冷却中
            this._bgSprite.color = SLOT_BG_COOLING;
            const ratio = Math.min(1, cdRemain / maxCd);
            this._coolCoverUt.setContentSize(SLOT_SIZE, SLOT_SIZE * ratio);
            this._coolLabel.string = cdRemain >= 1
                ? Math.ceil(cdRemain).toString()
                : cdRemain.toFixed(1);
        } else {
            // 可用
            this._bgSprite.color = SLOT_BG_AVAILABLE;
            this._coolCoverUt.setContentSize(SLOT_SIZE, 0);
            this._coolLabel.string = '';
        }
    }
}

/**
 * 屏幕右下技能栏 —— 显示玩家当前 3 个技能槽位的状态。
 *
 * 设计：
 *   - 横排 3 槽，槽间距 20px
 *   - 中心位置 (W*0.75, H*0.25 + 200) 在攻击按钮上方
 *   - 每帧 update 读 PlayerControl.instance.skillSystem.getSlot(i)
 *   - 没有 PlayerControl / 流派未选时显示空槽（深灰）
 *
 * Linus 式好品味：
 *   - 不监听任何事件，纯轮询：每帧读一次状态，简单稳定
 *   - 视觉用 UiAtlas.getWhiteSF + 颜色配置；零新资源
 *   - 槽数与 SkillSystem.maxSlots 对齐
 */
@ccclass('SkillBarPanel')
export class SkillBarPanel extends Component {

    private _slots: SkillSlotView[] = [];

    onLoad(): void {
        this._build();
    }

    update(_dt: number): void {
        const sys = PlayerControl.instance?.skillSystem;
        if (!sys) {
            // 玩家未就绪 / 流派未选：显示空槽
            for (const v of this._slots) v.update(null);
            return;
        }
        for (let i = 0; i < this._slots.length; i++) {
            this._slots[i].update(sys.getSlot(i));
        }
    }

    private _build(): void {
        // 全屏 root（继承自 GameManager 给的 UI 容器）
        const widget = this.node.addComponent(Widget);
        widget.isAlignTop = widget.isAlignBottom = true;
        widget.isAlignLeft = widget.isAlignRight = true;
        widget.top = widget.bottom = widget.left = widget.right = 0;

        // 容器节点：屏幕右下区域，攻击按钮上方
        const row = new Node('SkillRow');
        this.node.addChild(row);
        const rowUt = row.addComponent(UITransform);
        const totalW = SLOT_SIZE * MAX_SLOTS + SLOT_GAP * (MAX_SLOTS - 1);
        rowUt.setContentSize(new Size(totalW, SLOT_SIZE));

        // 用 Widget 锚定到屏幕右下，距右 W*0.25 - totalW/2、距底 H*0.25 + 200 - SLOT_SIZE/2
        // 但 Widget 不能用百分比 → 在 onLoad 末尾用 view.getVisibleSize 算
        // 简化：每帧由父节点 Widget 全屏，row 直接 setPosition 到中心
        // 中心 X 在屏幕坐标 W*0.75，对应 UI 坐标系 W*0.75 - W/2 = W*0.25 = +1/4 屏宽
        // 中心 Y 在屏幕坐标 H*0.25 + 200，对应 UI 坐标系 H*0.25 + 200 - H/2 = -H*0.25 + 200
        // 但用 view.getVisibleSize() 在 visibleSize 异常的设备上会出问题，
        // 改用 Widget 锚定屏幕右下角更稳：距右 W*POS_X_FACTOR_RIGHT_OFFSET、距底 ...
        const rowWidget = row.addComponent(Widget);
        rowWidget.isAlignRight  = true;
        rowWidget.isAlignBottom = true;
        // 取屏幕宽 1/4 - 一半行宽：让 row 中心对齐 W*0.75
        const visible = this.node.getComponent(UITransform);
        const screenW = visible?.contentSize.width  ?? 1280;
        const screenH = visible?.contentSize.height ?? 720;
        rowWidget.right  = screenW * 0.25 - totalW / 2;
        rowWidget.bottom = screenH * 0.25 + POS_Y_OFFSET_PX - SLOT_SIZE / 2;

        // 创建 3 个槽
        const startX = -totalW / 2 + SLOT_SIZE / 2;
        for (let i = 0; i < MAX_SLOTS; i++) {
            const x = startX + i * (SLOT_SIZE + SLOT_GAP);
            this._slots.push(new SkillSlotView(row, x, 0, i));
        }
    }
}
