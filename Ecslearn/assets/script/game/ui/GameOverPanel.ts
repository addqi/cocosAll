import {
    _decorator, Component, Node, Color, Label, Sprite, UITransform, Widget, Size, EventTouch,
} from 'cc';
import { emit } from '../../baseSystem/util';
import { GameEvt, type RevivePlayerEvent, type RestartGameEvent } from '../events/GameEvents';
import { GameSession } from '../core/GameSession';
import { getWhiteSF } from './UiAtlas';

const { ccclass } = _decorator;

// 布局常数
const DIM_COLOR        = new Color(60, 60, 60, 200);   // 淡灰半透明遮罩
const TITLE_COLOR      = new Color(255, 80, 80, 255);
const BTN_REVIVE_COLOR = new Color(120, 200, 80, 255); // 绿 = 复活
const BTN_RESTART_COLOR = new Color(80, 130, 200, 255); // 蓝 = 重玩
const BTN_DISABLED_COLOR = new Color(80, 80, 80, 255);
const BTN_W = 240;
const BTN_H = 76;
const BTN_GAP = 40;

/**
 * Game Over 面板。
 *
 * 职责（纯视图）：
 *   - 玩家死亡后由 LevelManager.show() 调出
 *   - 显示"再来一局"按钮（始终可点 → emit RestartGame）
 *   - 显示"复活"按钮（仅 GameSession.canRevive 时可点 → emit RevivePlayer）
 *
 * 不知道 PlayerControl / LevelManager；只走 EventBus。
 */
@ccclass('GameOverPanel')
export class GameOverPanel extends Component {

    private _reviveBtn!: Node;
    private _reviveBtnSprite!: Sprite;
    private _reviveLabel!: Label;

    onLoad(): void {
        this._build();
        this.node.active = false;
    }

    /** 外部入口：玩家死亡后由 LevelManager 调用 */
    show(): void {
        this._refreshReviveBtn();
        this.node.active = true;
    }

    /** 外部入口：复活成功后 LevelManager 调用，关闭面板 */
    hide(): void {
        this.node.active = false;
    }

    // ─── 节点树构建 ─────────────────────────────

    private _build(): void {
        const widget = this.node.addComponent(Widget);
        widget.isAlignTop = widget.isAlignBottom = true;
        widget.isAlignLeft = widget.isAlignRight = true;
        widget.top = widget.bottom = widget.left = widget.right = 0;

        this._buildDim();
        this._buildTitle();
        this._buildButtons();
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
        const title = new Node('Title');
        this.node.addChild(title);
        title.setPosition(0, 100, 0);
        const tut = title.addComponent(UITransform);
        tut.setContentSize(new Size(600, 100));
        const lbl = title.addComponent(Label);
        lbl.fontSize = 72;
        lbl.lineHeight = 90;
        lbl.color = TITLE_COLOR;
        lbl.string = '游戏失败';
        lbl.enableOutline = true;
        lbl.outlineColor = new Color(40, 0, 0, 255);
        lbl.outlineWidth = 4;
    }

    private _buildButtons(): void {
        // 复活在左、再来在右
        const totalW = BTN_W * 2 + BTN_GAP;
        const startX = -totalW / 2 + BTN_W / 2;

        // 复活按钮
        this._reviveBtn = this._makeButton(
            'ReviveBtn',
            startX, -80,
            '复活',
            BTN_REVIVE_COLOR,
            () => this._onReviveClick(),
        );
        this._reviveBtnSprite = this._reviveBtn.getComponent(Sprite)!;
        this._reviveLabel = this._reviveBtn.getChildByName('Label')!.getComponent(Label)!;

        // 再来一局按钮
        this._makeButton(
            'RestartBtn',
            startX + BTN_W + BTN_GAP, -80,
            '再来一局',
            BTN_RESTART_COLOR,
            () => this._onRestartClick(),
        );
    }

    private _makeButton(
        name: string, x: number, y: number,
        text: string, color: Color, onClick: () => void,
    ): Node {
        const n = new Node(name);
        this.node.addChild(n);
        n.setPosition(x, y, 0);
        const ut = n.addComponent(UITransform);
        ut.setContentSize(new Size(BTN_W, BTN_H));

        const sp = n.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.spriteFrame = getWhiteSF();
        sp.color = color;

        const lblNode = new Node('Label');
        n.addChild(lblNode);
        const lblUt = lblNode.addComponent(UITransform);
        lblUt.setContentSize(BTN_W, BTN_H);
        const lbl = lblNode.addComponent(Label);
        lbl.fontSize = 36;
        lbl.lineHeight = BTN_H;
        lbl.color = new Color(255, 255, 255, 255);
        lbl.enableOutline = true;
        lbl.outlineColor = new Color(0, 0, 0, 200);
        lbl.outlineWidth = 2;
        lbl.string = text;

        n.on(Node.EventType.TOUCH_END, (_e: EventTouch) => onClick(), this);
        return n;
    }

    // ─── 按钮回调 ───────────────────────────────

    private _onReviveClick(): void {
        if (!GameSession.inst.canRevive) {
            console.warn('[GameOverPanel] 复活次数已用完');
            return;
        }
        const payload: RevivePlayerEvent = { hpRatio: 1.0 };
        emit(GameEvt.RevivePlayer, payload);
    }

    private _onRestartClick(): void {
        const payload: RestartGameEvent = { reload: true };
        emit(GameEvt.RestartGame, payload);
    }

    /** 刷新复活按钮可用状态（按 GameSession.canRevive）*/
    private _refreshReviveBtn(): void {
        const canRevive = GameSession.inst.canRevive;
        this._reviveBtnSprite.color = canRevive ? BTN_REVIVE_COLOR : BTN_DISABLED_COLOR;
        this._reviveLabel.string = canRevive
            ? '复活'
            : '复活 (已用完)';
    }
}
