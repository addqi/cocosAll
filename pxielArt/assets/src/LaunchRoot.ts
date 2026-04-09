import {
    _decorator, Button, Color, Component, director,
    Label, Node, Sprite, UITransform, view, Widget,
} from 'cc';
import { BundleManager } from './config/BundleManager';
import { getWhitePixelSF } from './util/WhitePixel';

const { ccclass } = _decorator;

@ccclass('LaunchRoot')
export class LaunchRoot extends Component {

    private _progressFill: UITransform | null = null;
    private _progressLabel: Label | null = null;
    private _barWidth = 0;

    start(): void {
        const vs = view.getVisibleSize();
        const ut = this.node.getComponent(UITransform);
        if (ut) ut.setContentSize(vs.width, vs.height);
        this._buildUI(vs.width, vs.height);
    }

    private _buildUI(vw: number, vh: number): void {
        const sf = getWhitePixelSF();

        // ── 全屏白色背景 ──
        const bg = new Node('Bg');
        this.node.addChild(bg);
        bg.addComponent(UITransform).setContentSize(vw, vh);
        const bgSp = bg.addComponent(Sprite);
        bgSp.sizeMode = Sprite.SizeMode.CUSTOM;
        bgSp.spriteFrame = sf;
        bgSp.color = Color.WHITE;
        const w = bg.addComponent(Widget);
        w.isAlignTop = true; w.top = 0;
        w.isAlignBottom = true; w.bottom = 0;
        w.isAlignLeft = true; w.left = 0;
        w.isAlignRight = true; w.right = 0;
        w.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;

        // ── 标题 ──
        const title = new Node('Title');
        this.node.addChild(title);
        title.setPosition(0, 100, 0);
        title.addComponent(UITransform).setContentSize(400, 80);
        const titleLab = title.addComponent(Label);
        titleLab.string = '像素涂色';
        titleLab.fontSize = 56;
        titleLab.horizontalAlign = Label.HorizontalAlign.CENTER;
        titleLab.verticalAlign = Label.VerticalAlign.CENTER;
        titleLab.color = new Color(60, 60, 60, 255);

        // ── 开始按钮 ──
        const btnNode = new Node('StartBtn');
        this.node.addChild(btnNode);
        btnNode.setPosition(0, -40, 0);
        btnNode.addComponent(UITransform).setContentSize(240, 64);
        const btnSp = btnNode.addComponent(Sprite);
        btnSp.sizeMode = Sprite.SizeMode.CUSTOM;
        btnSp.spriteFrame = sf;
        btnSp.color = new Color(76, 175, 80, 255);

        const btnLab = new Node('Label');
        btnNode.addChild(btnLab);
        btnLab.addComponent(UITransform).setContentSize(240, 64);
        const bl = btnLab.addComponent(Label);
        bl.string = '开始游戏';
        bl.fontSize = 32;
        bl.horizontalAlign = Label.HorizontalAlign.CENTER;
        bl.verticalAlign = Label.VerticalAlign.CENTER;
        bl.color = Color.WHITE;

        const btn = btnNode.addComponent(Button);
        btn.target = btnNode;
        btn.transition = Button.Transition.SCALE;
        btn.zoomScale = 0.9;
        btn.node.on(Button.EventType.CLICK, () => this._onStartClick(btnNode));

        this._buildProgressBar(vw);
    }

    private _buildProgressBar(vw: number): void {
        const barW = vw * 0.6;
        this._barWidth = barW;

        const root = new Node('LoadingBar');
        this.node.addChild(root);
        root.setPosition(0, -140, 0);
        root.active = false;

        const sf = getWhitePixelSF();

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
        this._progressFill = fillUt;

        const labNode = new Node('Percent');
        root.addChild(labNode);
        labNode.setPosition(0, -24, 0);
        labNode.addComponent(UITransform).setContentSize(200, 30);
        const lab = labNode.addComponent(Label);
        lab.string = '加载中...';
        lab.fontSize = 22;
        lab.horizontalAlign = Label.HorizontalAlign.CENTER;
        lab.verticalAlign = Label.VerticalAlign.CENTER;
        lab.color = new Color(120, 120, 120, 255);
        this._progressLabel = lab;
    }
    private async _onStartClick(btnNode: Node): Promise<void> {
        btnNode.active = false;
        const bar = this.node.getChildByName('LoadingBar');
        if (bar) bar.active = true;

        try {
            await BundleManager.load((finished, total) => {
                const ratio = total > 0 ? finished / total : 0;
                if (this._progressFill) {
                    this._progressFill.setContentSize(this._barWidth * ratio, 12);
                }
                if (this._progressLabel) {
                    this._progressLabel.string = `加载中... ${Math.round(ratio * 100)}%`;
                }
            });
            director.loadScene('game');
        } catch (e) {
            if (this._progressLabel) {
                this._progressLabel.string = '加载失败，请重试';
            }
            btnNode.active = true;
            if (bar) bar.active = false;
        }
    }
}