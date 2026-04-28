import {
    _decorator, Button, Color, Component, director,
    Label, Node, Sprite, SpriteFrame, UITransform, view, Widget,
} from 'cc';
import { BundleManager } from './config/BundleManager';
import { getWhitePixelSF } from './util/WhitePixel';

const { ccclass } = _decorator;

/**
 * start 场景入口。
 *
 * 极简版：标题 + 开始按钮 + 进度条。点击按钮 → 加载 game-bundle → director.loadScene('game')。
 *
 * 编辑器侧操作：
 *   1. 在 start.scene 的 Canvas 下建一个空节点 'LaunchRoot'，给 Widget 撑满
 *   2. 把这个组件挂到 LaunchRoot 节点上
 *   3. （如想在背景显示一张启动图，可在编辑器手动加 Sprite，本组件不依赖编辑器引用）
 */
@ccclass('LaunchRoot')
export class LaunchRoot extends Component {

    private _btn: Node | null = null;
    private _bar: Node | null = null;
    private _fill: UITransform | null = null;
    private _label: Label | null = null;
    private _barWidth = 0;

    private _targetRatio = 0;
    private _displayRatio = 0;
    private _loading = false;
    /** 进度条填充速度：1.0 = 1 秒从 0 到满。 */
    private static readonly FILL_SPEED = 1.0;

    start(): void {
        const vs = view.getVisibleSize();
        const ut = this.node.getComponent(UITransform);
        if (ut) ut.setContentSize(vs.width, vs.height);
        this._buildUI(vs.width, vs.height);
    }

    update(dt: number): void {
        if (!this._fill) return;
        const target = this._targetRatio;
        if (this._displayRatio >= target) return;

        const next = Math.min(target, this._displayRatio + LaunchRoot.FILL_SPEED * dt);
        this._displayRatio = next;
        this._fill.setContentSize(this._barWidth * next, 12);
        if (this._label) this._label.string = `加载中... ${Math.round(next * 100)}%`;
    }

    /* ── 构建 UI ── */

    private _buildUI(vw: number, vh: number): void {
        const sf = getWhitePixelSF();

        const bg = new Node('Bg');
        this.node.addChild(bg);
        bg.addComponent(UITransform).setContentSize(vw, vh);
        const bgSp = bg.addComponent(Sprite);
        bgSp.sizeMode = Sprite.SizeMode.CUSTOM;
        bgSp.spriteFrame = sf;
        bgSp.color = new Color(245, 245, 250, 255);
        const bgW = bg.addComponent(Widget);
        bgW.isAlignTop = true; bgW.top = 0;
        bgW.isAlignBottom = true; bgW.bottom = 0;
        bgW.isAlignLeft = true; bgW.left = 0;
        bgW.isAlignRight = true; bgW.right = 0;
        bgW.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;

        const title = new Node('Title');
        this.node.addChild(title);
        title.setPosition(0, 120, 0);
        title.addComponent(UITransform).setContentSize(400, 120);
        const tl = title.addComponent(Label);
        tl.string = '拼图';
        tl.fontSize = 64;
        tl.horizontalAlign = Label.HorizontalAlign.CENTER;
        tl.verticalAlign = Label.VerticalAlign.CENTER;
        tl.color = new Color(60, 60, 80, 255);
        tl.cacheMode = Label.CacheMode.CHAR;
        tl.lineHeight = 80;

        const btn = new Node('StartBtn');
        this.node.addChild(btn);
        btn.setPosition(0, -40, 0);
        btn.addComponent(UITransform).setContentSize(240, 72);
        const btnSp = btn.addComponent(Sprite);
        btnSp.sizeMode = Sprite.SizeMode.CUSTOM;
        btnSp.spriteFrame = sf;
        btnSp.color = new Color(76, 175, 80, 255);

        const labNode = new Node('Label');
        btn.addChild(labNode);
        labNode.addComponent(UITransform).setContentSize(240, 72);
        const ll = labNode.addComponent(Label);
        ll.string = '开始游戏';
        ll.fontSize = 32;
        ll.horizontalAlign = Label.HorizontalAlign.CENTER;
        ll.verticalAlign = Label.VerticalAlign.CENTER;
        ll.color = Color.WHITE;

        const button = btn.addComponent(Button);
        button.target = btn;
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 0.9;
        button.node.on(Button.EventType.CLICK, () => this._onStartClick());
        this._btn = btn;

        this._buildProgressBar(vw, sf);
    }

    private _buildProgressBar(vw: number, sf: SpriteFrame): void {
        const barW = vw * 0.6;
        this._barWidth = barW;

        const root = new Node('LoadingBar');
        this.node.addChild(root);
        root.setPosition(0, -140, 0);
        root.active = false;
        this._bar = root;

        const bgBar = new Node('Bg');
        root.addChild(bgBar);
        bgBar.addComponent(UITransform).setContentSize(barW, 12);
        const bgSp = bgBar.addComponent(Sprite);
        bgSp.sizeMode = Sprite.SizeMode.CUSTOM;
        bgSp.spriteFrame = sf;
        bgSp.color = new Color(220, 220, 220, 255);

        const fill = new Node('Fill');
        bgBar.addChild(fill);
        const fillUt = fill.addComponent(UITransform);
        fillUt.setContentSize(0, 12);
        fillUt.setAnchorPoint(0, 0.5);
        fill.setPosition(-barW / 2, 0, 0);
        const fillSp = fill.addComponent(Sprite);
        fillSp.sizeMode = Sprite.SizeMode.CUSTOM;
        fillSp.spriteFrame = sf;
        fillSp.color = new Color(76, 175, 80, 255);
        this._fill = fillUt;

        const labNode = new Node('Percent');
        root.addChild(labNode);
        labNode.setPosition(0, -28, 0);
        labNode.addComponent(UITransform).setContentSize(240, 30);
        const lab = labNode.addComponent(Label);
        lab.string = '加载中...';
        lab.fontSize = 22;
        lab.horizontalAlign = Label.HorizontalAlign.CENTER;
        lab.verticalAlign = Label.VerticalAlign.CENTER;
        lab.color = new Color(120, 120, 120, 255);
        this._label = lab;
    }

    private async _onStartClick(): Promise<void> {
        if (this._loading) return;
        this._loading = true;

        if (this._btn) this._btn.active = false;
        if (this._bar) this._bar.active = true;
        this._targetRatio = 0;
        this._displayRatio = 0;

        try {
            await BundleManager.load((finished, total) => {
                this._targetRatio = total > 0 ? finished / total : 0;
            });
            this._targetRatio = 1;
            await this._waitDisplayCatchUp();
            this._goToGame();
        } catch (e) {
            console.error('[LaunchRoot] bundle load failed:', e);
            this._fail('加载失败，请重试');
        }
    }

    private _goToGame(): void {
        const ok = director.loadScene('game', (err) => {
            if (err) {
                console.error('[LaunchRoot] loadScene("game") callback error:', err);
                this._fail('场景加载失败');
            }
        });
        if (!ok) {
            console.error('[LaunchRoot] loadScene("game") returned false — 场景未找到。请检查：\n' +
                '  1. assets/ 下确实有 game.scene\n' +
                '  2. 项目设置 → 构建发布 → 场景列表 包含 game');
            this._fail('找不到 game 场景');
        }
    }

    private _fail(msg: string): void {
        if (this._label) this._label.string = msg;
        if (this._btn) this._btn.active = true;
        if (this._bar) this._bar.active = false;
        this._loading = false;
    }

    /**
     * 等显示进度条追上目标进度。
     *
     * 不能用 component.scheduleOnce(tick, 0) —— Cocos 调度器会发现 tick 已注册，
     * 触发 "Selector already scheduled" warning 并丢弃新的注册，造成死循环。
     * 改用 setTimeout：每次都是新任务，不存在去重问题。
     */
    private _waitDisplayCatchUp(): Promise<void> {
        return new Promise((resolve) => {
            const tick = (): void => {
                if (this._displayRatio >= this._targetRatio) { resolve(); return; }
                setTimeout(tick, 16);
            };
            tick();
        });
    }
}
