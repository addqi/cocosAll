import { Node, Label, Color, UITransform, Vec3, director } from 'cc';

export enum EDamageStyle {
    Normal,
    Crit,
    Heal,
    PlayerHurt,
}

interface PopupEntry {
    node: Node;
    label: Label;
    elapsed: number;
    duration: number;
    startX: number;
    startY: number;
}

const POPUP_DURATION = 0.8;
const RISE_HEIGHT = 60;
const POOL_INIT = 20;
const CRIT_SCALE = 1.4;

const STYLE_MAP: Record<EDamageStyle, { color: Color; fontSize: number }> = {
    [EDamageStyle.Normal]:     { color: new Color(255, 255, 255, 255), fontSize: 22 },
    [EDamageStyle.Crit]:       { color: new Color(255, 220, 50, 255),  fontSize: 30 },
    [EDamageStyle.Heal]:       { color: new Color(80, 230, 80, 255),   fontSize: 22 },
    [EDamageStyle.PlayerHurt]: { color: new Color(255, 70, 70, 255),   fontSize: 26 },
};

export class DamagePopupMgr {
    private static _inst: DamagePopupMgr | null = null;
    static get inst(): DamagePopupMgr {
        if (!this._inst) this._inst = new DamagePopupMgr();
        return this._inst;
    }

    private _root: Node | null = null;
    private _pool: PopupEntry[] = [];
    private _active: PopupEntry[] = [];

    get root(): Node | null { return this._root; }

    init(parent: Node): void {
        if (this._root?.isValid) return;
        this._root = new Node('DamagePopupRoot');
        parent.addChild(this._root);
        this._root.setSiblingIndex(999);
        for (let i = 0; i < POOL_INIT; i++) {
            this._pool.push(this._createEntry());
        }
    }

    /**
     * @param worldPos  damage origin in world coords
     * @param value     damage number (negative for heal display)
     * @param style     visual style
     */
    show(worldPos: Readonly<Vec3>, value: number, style = EDamageStyle.Normal): void {
        if (!this._root?.isValid) return;

        const entry = this._pool.pop() ?? this._createEntry();
        const { color, fontSize } = STYLE_MAP[style] ?? STYLE_MAP[EDamageStyle.Normal];

        entry.label.string = style === EDamageStyle.Heal ? `+${value}` : `${value}`;
        entry.label.fontSize = fontSize;
        entry.label.lineHeight = fontSize + 4;
        entry.label.color = color;
        entry.elapsed = 0;
        entry.duration = POPUP_DURATION;

        const jitterX = (Math.random() - 0.5) * 30;
        entry.startX = worldPos.x + jitterX;
        entry.startY = worldPos.y + 40;

        entry.node.setWorldPosition(entry.startX, entry.startY, 0);
        entry.node.setScale(style === EDamageStyle.Crit ? CRIT_SCALE : 1, style === EDamageStyle.Crit ? CRIT_SCALE : 1, 1);
        entry.node.active = true;

        this._active.push(entry);
    }

    tick(dt: number): void {
        for (let i = this._active.length - 1; i >= 0; i--) {
            const e = this._active[i];
            e.elapsed += dt;
            const t = e.elapsed / e.duration;

            if (t >= 1) {
                e.node.active = false;
                this._active.splice(i, 1);
                this._pool.push(e);
                continue;
            }

            const ease = 1 - (1 - t) * (1 - t);
            e.node.setWorldPosition(e.startX, e.startY + RISE_HEIGHT * ease, 0);

            const alpha = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
            e.label.color = new Color(
                e.label.color.r, e.label.color.g, e.label.color.b,
                Math.round(alpha * 255),
            );
        }
    }

    private _createEntry(): PopupEntry {
        const node = new Node('DmgPopup');
        if (this._root?.isValid) this._root.addChild(node);

        const ut = node.addComponent(UITransform);
        ut.setContentSize(120, 30);

        const label = node.addComponent(Label);
        label.fontSize = 22;
        label.lineHeight = 26;
        label.enableOutline = true;
        label.outlineColor = new Color(0, 0, 0, 200);
        label.outlineWidth = 2;
        label.isBold = true;
        label.cacheMode = Label.CacheMode.CHAR;
        node.active = false;

        return { node, label, elapsed: 0, duration: POPUP_DURATION, startX: 0, startY: 0 };
    }
}
