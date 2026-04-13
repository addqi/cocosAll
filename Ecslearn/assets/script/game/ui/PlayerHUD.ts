import { _decorator, Component, Node, Sprite, SpriteFrame, Color, UITransform, Label,
    Texture2D, ImageAsset, Widget, UIOpacity } from 'cc';
import type { PlayerCombat } from '../player/combat/PlayerCombat';
import type { PlayerExperience } from '../player/experience/PlayerExperience';

const { ccclass } = _decorator;

const HP_W = 200;
const HP_H = 16;
const XP_W = 200;
const XP_H = 8;
const MARGIN_LEFT = 20;
const MARGIN_TOP = 20;

let _whiteFrame: SpriteFrame | null = null;
function getWhiteSF(): SpriteFrame {
    if (!_whiteFrame) {
        const size = 4;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        const tex = new Texture2D();
        tex.image = new ImageAsset(canvas as any);
        _whiteFrame = new SpriteFrame();
        _whiteFrame.texture = tex;
        _whiteFrame.packable = false;
    }
    return _whiteFrame;
}

/**
 * 屏幕左上角玩家 HUD
 *
 * 结构:
 *   PlayerHUD (Widget: top-left)
 *   ├── HpBg / HpWhite / HpRed
 *   ├── HpLabel
 *   ├── XpBg / XpGreen
 *   └── LvLabel
 */
@ccclass('PlayerHUD')
export class PlayerHUD extends Component {
    private _combat: PlayerCombat | null = null;
    private _exp: PlayerExperience | null = null;

    private _hpRedUt!: UITransform;
    private _hpWhiteUt!: UITransform;
    private _hpDisplayRatio = 1;
    private _hpLabel!: Label;

    private _xpGreenUt!: UITransform;
    private _lvLabel!: Label;

    bind(combat: PlayerCombat, exp: PlayerExperience): void {
        this._combat = combat;
        this._exp = exp;
    }

    onLoad() {
        const widget = this.node.addComponent(Widget);
        widget.isAlignTop = true;
        widget.isAlignLeft = true;
        widget.top = MARGIN_TOP;
        widget.left = MARGIN_LEFT;

        this._buildHpBar();
        this._buildXpBar();
    }

    update(dt: number) {
        if (this._combat) this._updateHp(dt);
        if (this._exp) this._updateXp();
    }

    // ─── HP ───────────────────────────────────

    private _buildHpBar() {
        const sf = getWhiteSF();
        const y = 0;

        this._makeBar('HpBg', this.node, sf, HP_W, HP_H, new Color(40, 40, 40, 200), y);

        const whiteNode = this._makeBar('HpWhite', this.node, sf, HP_W, HP_H, new Color(255, 255, 255, 200), y);
        this._hpWhiteUt = whiteNode.getComponent(UITransform)!;

        const redNode = this._makeBar('HpRed', this.node, sf, HP_W, HP_H, new Color(200, 40, 40, 255), y);
        this._hpRedUt = redNode.getComponent(UITransform)!;

        const lblNode = new Node('HpLabel');
        this.node.addChild(lblNode);
        lblNode.setPosition(HP_W / 2, y, 0);
        const ut = lblNode.addComponent(UITransform);
        ut.setContentSize(HP_W, HP_H);
        this._hpLabel = lblNode.addComponent(Label);
        this._hpLabel.fontSize = 12;
        this._hpLabel.lineHeight = HP_H;
        this._hpLabel.color = new Color(255, 255, 255, 255);
        this._hpLabel.enableOutline = true;
        this._hpLabel.outlineColor = new Color(0, 0, 0, 200);
        this._hpLabel.outlineWidth = 1;
    }

    private _updateHp(dt: number) {
        const c = this._combat!;
        const ratio = Math.max(0, c.currentHp / c.maxHp);

        this._hpRedUt.setContentSize(HP_W * ratio, HP_H);
        if (this._hpDisplayRatio > ratio) {
            this._hpDisplayRatio = Math.max(ratio, this._hpDisplayRatio - 0.8 * dt);
        } else {
            this._hpDisplayRatio = ratio;
        }
        this._hpWhiteUt.setContentSize(HP_W * this._hpDisplayRatio, HP_H);

        this._hpLabel.string = `${c.currentHp} / ${c.maxHp}`;
    }

    // ─── XP ───────────────────────────────────

    private _buildXpBar() {
        const sf = getWhiteSF();
        const y = -(HP_H + 4);

        this._makeBar('XpBg', this.node, sf, XP_W, XP_H, new Color(30, 30, 30, 180), y);

        const greenNode = this._makeBar('XpGreen', this.node, sf, XP_W, XP_H, new Color(50, 200, 255, 255), y);
        this._xpGreenUt = greenNode.getComponent(UITransform)!;

        const lblNode = new Node('LvLabel');
        this.node.addChild(lblNode);
        lblNode.setPosition(HP_W + 8, -(HP_H + 4) + XP_H / 2, 0);
        const ut = lblNode.addComponent(UITransform);
        ut.setContentSize(60, XP_H + 8);
        this._lvLabel = lblNode.addComponent(Label);
        this._lvLabel.fontSize = 12;
        this._lvLabel.lineHeight = XP_H + 8;
        this._lvLabel.color = new Color(220, 220, 100, 255);
        this._lvLabel.enableOutline = true;
        this._lvLabel.outlineColor = new Color(0, 0, 0, 200);
        this._lvLabel.outlineWidth = 1;
    }

    private _updateXp() {
        const e = this._exp!;
        this._xpGreenUt.setContentSize(XP_W * e.xpRatio, XP_H);
        this._lvLabel.string = `Lv.${e.level}`;
    }

    // ─── Util ─────────────────────────────────

    private _makeBar(name: string, parent: Node, sf: SpriteFrame, w: number, h: number, color: Color, y: number): Node {
        const nd = new Node(name);
        parent.addChild(nd);
        nd.setPosition(0, y, 0);

        const ut = nd.addComponent(UITransform);
        ut.setContentSize(w, h);
        ut.setAnchorPoint(0, 0.5);

        const sp = nd.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.spriteFrame = sf;
        sp.color = color;
        return nd;
    }
}
