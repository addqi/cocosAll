import { _decorator, Color, Component, Label, resources, Sprite, SpriteFrame, UITransform, Node } from "cc";

const { ccclass, property } = _decorator;

/**
 * 红点背景图在 resources 下的加载路径。
 * 对应文件：assets/resources/reddot/redPoint.png
 * 加载 SpriteFrame 必须在尾部加 "/spriteFrame"。
 */
const RED_DOT_FRAME_PATH = 'reddot/redPoint/spriteFrame';
/** 显示模式 */
export enum RedDotDisplayMode {
    /** 只显示点，不显示数字 */
    DotOnly = 0,
    /** 必须有数字（count=0 隐藏） */
    NumberOnly = 1,
    /** count=1 显示点；count>=2 显示数字（默认） */
    NumberOrDot = 2,
}
export interface RedDotViewStyle {
    bgColor: Color;
    dotSize: number;       // 纯点模式下的直径
    capsuleHeight: number; // 胶囊模式下的高度
    fontSize: number;
    fontColor: Color;
    /** 超过显示 "99+" */
    maxDisplay: number;    // 超过显示 "99+"
}

const DEFAULT_STYLE: RedDotViewStyle = {
    bgColor: new Color(244, 67, 54, 255),
    dotSize: 16,
    capsuleHeight: 28,
    fontSize: 20,
    fontColor: new Color(255, 255, 255, 255),
    maxDisplay: 99,
};

@ccclass('RedDotView')
export class RedDotView extends Component {
    /** 全局共享的红点背景 SpriteFrame，所有实例用同一张 */
    private static _sharedFrame: SpriteFrame | null = null;
    /** 正在加载中的 Promise，防止并发 onLoad 重复加载 */
    private static _loadingPromise: Promise<SpriteFrame> | null = null;

    /**
     * 启动阶段调用一次即可，后续 RedDotView 实例创建时同步就能拿到 SpriteFrame。
     * 建议在 LaunchRoot / BundleManager 预加载阶段调用。
     * 没调也没关系，实例 onLoad 时会兜底异步加载。
     */
    static preload(): Promise<SpriteFrame> {
        if (this._sharedFrame) return Promise.resolve(this._sharedFrame);
        if (this._loadingPromise) return this._loadingPromise;

        this._loadingPromise = new Promise<SpriteFrame>((resolve, reject) => {
            resources.load(RED_DOT_FRAME_PATH, SpriteFrame, (err, frame) => {
                if (err || !frame) {
                    this._loadingPromise = null;
                    reject(err ?? new Error('load redPoint SpriteFrame failed'));
                    return;
                }
                this._sharedFrame = frame;
                resolve(frame);
            });
        });
        return this._loadingPromise;
    }

    private _count = 0;
    private _mode: RedDotDisplayMode = RedDotDisplayMode.NumberOrDot;
    private _style: RedDotViewStyle = { ...DEFAULT_STYLE };

    private _bgSprite: Sprite | null = null;
    private _label: Label | null = null;
    private _labelNode: Node | null = null;

    onLoad(): void {
        this._ensureChildren();
        this._refresh();
        this._ensureBgFrame();
    }

    setCount(count: number): void {
        const c = Math.max(0, Math.floor(count));
        if (c === this._count) return;
        this._count = c;
        this._refresh();
    }

    getCount(): number {
        return this._count;
    }
    /** 设置显示模式 */

    setMode(mode: RedDotDisplayMode): void {
        if (mode === this._mode) return;
        this._mode = mode;
        this._refresh();
    }
/** 设置样式 */
    setStyle(style: Partial<RedDotViewStyle>): void {
        this._style = { ...this._style, ...style };
        this._applyStyle();
        this._refresh();
    }
    private _ensureChildren(): void {
        if (!this.node.getComponent(UITransform)) {
            this.node.addComponent(UITransform);
        }
        this._bgSprite = this.node.getComponent(Sprite) ?? this.node.addComponent(Sprite);
        this._bgSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        if (RedDotView._sharedFrame && !this._bgSprite.spriteFrame) {
            this._bgSprite.spriteFrame = RedDotView._sharedFrame;
        }

        const labelName = 'RedDotLabel';
        let lblNode = this.node.getChildByName(labelName);
        if (!lblNode) {
            lblNode = new Node(labelName);
            this.node.addChild(lblNode);
            lblNode.addComponent(UITransform);
            lblNode.addComponent(Label);
        }
        this._labelNode = lblNode;
        this._label = lblNode.getComponent(Label);
        this._applyStyle();
    }

    /** 应用样式 */
    private _applyStyle(): void {
        if (this._bgSprite) this._bgSprite.color = this._style.bgColor.clone();
        if (this._label) {
            this._label.fontSize = this._style.fontSize;
            this._label.color = this._style.fontColor.clone();
            this._label.horizontalAlign = Label.HorizontalAlign.CENTER;
            this._label.verticalAlign = Label.VerticalAlign.CENTER;
        }
    }
    /** 刷新 */
    private _refresh(): void {
        const { shouldShow, showNumber, text } = this._decide();

        this.node.active = shouldShow;
        if (!shouldShow) return;

        const ut = this.node.getComponent(UITransform)!;
        if (showNumber) {
            const h = this._style.capsuleHeight;
            const w = Math.max(h, h * 0.6 + text.length * this._style.fontSize * 0.55);
            ut.setContentSize(w, h);
        } else {
            ut.setContentSize(this._style.dotSize, this._style.dotSize);
        }

        if (this._label && this._labelNode) {
            this._labelNode.active = showNumber;
            if (showNumber) this._label.string = text;
        }
    }

    /**
     * 兜底加载背景图：如果没人提前调过 preload()，这里触发一次异步加载，
     * 加载成功后回填到当前 Sprite 并重新刷新一次。
     * 已加载过就直接 return，不会重复请求（复用 preload 的 Promise 缓存）。
     */
    private _ensureBgFrame(): void {
        if (!this._bgSprite) return;
        if (this._bgSprite.spriteFrame) return;

        RedDotView.preload().then((frame) => {
            // 组件可能已被销毁
            if (!this.isValid || !this._bgSprite) return;
            if (!this._bgSprite.spriteFrame) {
                this._bgSprite.spriteFrame = frame;
            }
        }).catch((err) => {
            console.error('[RedDotView] load background failed:', err);
        });
    }

    /** 决定是否显示、显示什么 */
    private _decide(): { shouldShow: boolean; showNumber: boolean; text: string } {
        const c = this._count;
        const cap = this._style.maxDisplay;
        const text = c > cap ? `${cap}+` : String(c);

        switch (this._mode) {
            case RedDotDisplayMode.DotOnly:
                return { shouldShow: c > 0, showNumber: false, text: '' };
            case RedDotDisplayMode.NumberOnly:
                return { shouldShow: c > 0, showNumber: true, text };
            case RedDotDisplayMode.NumberOrDot:
            default:
                return { shouldShow: c > 0, showNumber: c >= 2, text };
        }
    }
}

