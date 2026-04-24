import {
    _decorator, Component, Node, Color, Label, Sprite, UITransform, Widget, Size,
} from 'cc';
import { emit } from '../../baseSystem/util';
import { GameEvt, type ClassChosenEvent } from '../events/GameEvents';
import {
    allPlayerClassDefs,
    type PlayerClassDef,
} from '../config/classConfig/ClassConfigLoader';
import { getWhiteSF } from './UiAtlas';

const { ccclass } = _decorator;

// 布局常数
const DIM_COLOR = new Color(0, 0, 0, 200);
const CARD_W = 360;
const CARD_H = 480;
const CARD_GAP = 60;
const FRAME_THICKNESS = 8;

/**
 * 固定流派主题色。
 * 为什么写死而不 data-driven：
 *   - 只有 2~3 个流派，加 class 本身是大事，顺手在这里加一行 key 很合理
 *   - JSON 里放颜色会让美术/策划改色时要编辑代码目录下的 JSON，职责混乱
 */
const CLASS_THEME: Readonly<Record<string, { frame: Color; accent: Color }>> = {
    rapid: {
        frame:  new Color( 80, 160, 255, 255),   // 蓝 = 速射
        accent: new Color(140, 200, 255, 255),
    },
    charge: {
        frame:  new Color(255, 120,  60, 255),   // 红橙 = 蓄力
        accent: new Color(255, 180, 120, 255),
    },
};
const FALLBACK_THEME = {
    frame:  new Color(180, 180, 180, 255),
    accent: new Color(220, 220, 220, 255),
};

function themeOf(classId: string) {
    return CLASS_THEME[classId] ?? FALLBACK_THEME;
}

/**
 * 开局流派选择面板（纯视图）
 *
 * 职责：
 *   - 屏幕中央显示全部流派卡片（数据从 classes.json 读）
 *   - 点某张卡 → emit GameEvt.ClassChosen + 自动隐藏
 *
 * 非职责：
 *   - 不知道 PlayerControl / LevelManager 任何事情
 *   - 不自动弹出；由 GameManager 显式调用 show()（因为只弹一次）
 *
 * Linus 式好品味：
 *   - 卡片从 classes.json 动态生成，加第三流派零 UI 改动
 *   - 一次性 panel：点击后 destroy，避免 onDestroy 监听泄漏
 */
@ccclass('ClassSelectPanel')
export class ClassSelectPanel extends Component {

    private _cards: ClassCardView[] = [];

    onLoad(): void {
        this._build();
        this.node.active = false;
    }

    /** 外部调用入口 —— GameManager 在资源就绪后调一次 */
    show(): void {
        this.node.active = true;
    }

    private _onCardClick(def: PlayerClassDef): void {
        const payload: ClassChosenEvent = { id: def.id };
        emit(GameEvt.ClassChosen, payload);
        // 一次性面板：直接销毁，清掉所有子节点事件监听
        this.node.destroy();
    }

    // ─── 节点树构建 ─────────────────────────────

    private _build(): void {
        const widget = this.node.addComponent(Widget);
        widget.isAlignTop = widget.isAlignBottom = true;
        widget.isAlignLeft = widget.isAlignRight = true;
        widget.top = widget.bottom = widget.left = widget.right = 0;

        this._buildDim();
        this._buildTitle();
        this._buildCardRow();
    }

    private _buildDim(): void {
        const n = new Node('Dim');
        this.node.addChild(n);
        const w = n.addComponent(Widget);
        w.isAlignTop = w.isAlignBottom = true;
        w.isAlignLeft = w.isAlignRight = true;
        w.top = w.bottom = w.left = w.right = 0;

        const sp = n.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.spriteFrame = getWhiteSF();
        sp.color = DIM_COLOR;
    }

    private _buildTitle(): void {
        const n = new Node('Title');
        this.node.addChild(n);
        n.setPosition(0, 320, 0);

        const ut = n.addComponent(UITransform);
        ut.setContentSize(new Size(600, 80));

        const lbl = n.addComponent(Label);
        lbl.fontSize = 48;
        lbl.lineHeight = 60;
        lbl.color = new Color(255, 240, 200, 255);
        lbl.string = '选择开局流派';
        lbl.enableOutline = true;
        lbl.outlineColor = new Color(0, 0, 0, 220);
        lbl.outlineWidth = 3;
    }

    private _buildCardRow(): void {
        const row = new Node('CardRow');
        this.node.addChild(row);

        const defs = allPlayerClassDefs();
        const count = defs.length;
        if (count === 0) {
            console.error('[ClassSelectPanel] classes.json 为空，无法渲染卡片');
            return;
        }
        const totalW = CARD_W * count + CARD_GAP * (count - 1);
        const startX = -totalW / 2 + CARD_W / 2;

        for (let i = 0; i < count; i++) {
            const def = defs[i];
            const v = new ClassCardView(
                row,
                startX + i * (CARD_W + CARD_GAP),
                0,
                def,
                () => this._onCardClick(def),
            );
            this._cards.push(v);
        }
    }
}

/**
 * 单张流派卡视图。
 */
class ClassCardView {
    private _node: Node;

    constructor(
        parent: Node,
        x: number,
        y: number,
        def: PlayerClassDef,
        onClick: () => void,
    ) {
        const theme = themeOf(def.id);

        this._node = new Node(`ClassCard_${def.id}`);
        parent.addChild(this._node);
        this._node.setPosition(x, y, 0);

        const ut = this._node.addComponent(UITransform);
        ut.setContentSize(new Size(CARD_W, CARD_H));

        // 外框 —— 流派主题色
        const frame = this._node.addComponent(Sprite);
        frame.sizeMode = Sprite.SizeMode.CUSTOM;
        frame.spriteFrame = getWhiteSF();
        frame.color = theme.frame;

        // 内部深色底板
        const inner = new Node('Inner');
        this._node.addChild(inner);
        const iut = inner.addComponent(UITransform);
        iut.setContentSize(
            CARD_W - FRAME_THICKNESS * 2,
            CARD_H - FRAME_THICKNESS * 2,
        );
        const isp = inner.addComponent(Sprite);
        isp.sizeMode = Sprite.SizeMode.CUSTOM;
        isp.spriteFrame = getWhiteSF();
        isp.color = new Color(20, 20, 28, 245);

        // 流派名（上部，主题色）
        const nameNode = new Node('Name');
        inner.addChild(nameNode);
        nameNode.setPosition(0, CARD_H / 2 - 90, 0);
        const nameUt = nameNode.addComponent(UITransform);
        nameUt.setContentSize(CARD_W - 40, 80);
        const nameLbl = nameNode.addComponent(Label);
        nameLbl.fontSize = 40;
        nameLbl.lineHeight = 50;
        nameLbl.color = theme.accent;
        nameLbl.string = def.name;
        nameLbl.enableOutline = true;
        nameLbl.outlineColor = new Color(0, 0, 0, 220);
        nameLbl.outlineWidth = 2;

        // 描述（中部，换行）
        const descNode = new Node('Desc');
        inner.addChild(descNode);
        descNode.setPosition(0, -30, 0);
        const descUt = descNode.addComponent(UITransform);
        descUt.setContentSize(CARD_W - 50, 280);
        const descLbl = descNode.addComponent(Label);
        descLbl.fontSize = 24;
        descLbl.lineHeight = 34;
        descLbl.color = new Color(230, 230, 230, 255);
        descLbl.string = def.desc;
        descLbl.overflow = Label.Overflow.RESIZE_HEIGHT;
        descLbl.enableWrapText = true;

        this._node.on(Node.EventType.TOUCH_END, () => onClick(), this);
    }
}
