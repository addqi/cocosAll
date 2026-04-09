import { Button, Color, Label, Node, Sprite, SpriteFrame, tween, UIOpacity, UITransform, Widget } from 'cc';
import { CellBrushEntry, PuzzleData } from '../../types/types';
import { GameConfig } from '../../config/GameConfig';
import { getWhitePixelSF } from '../../util/WhitePixel';
import { ReplayAnimator } from './ReplayAnimator';

/**
 * 结算弹窗 — 对标 G15 SettlementRender + SettlementCreateFunction + SettlementFadeFunction。
 *
 * 流程：全屏白色面板 alpha 0→255 渐显 → delay → 纯白画布逐帧回放 → 标题+按钮 fade-in。
 */
export class CompletionPopup {

    static show(
        parent: Node,
        viewW: number,
        viewH: number,
        puzzle: PuzzleData,
        history: CellBrushEntry[],
        onBack: () => void,
    ): void {
        const sf = getWhitePixelSF();

        /* ── 根节点（挂 UIOpacity 做整体 fade-in） ── */
        const root = new Node('CompletionRoot');
        parent.addChild(root);
        root.addComponent(UITransform).setContentSize(viewW, viewH);
        const rootOpacity = root.addComponent(UIOpacity);
        rootOpacity.opacity = 0;

        /* ── 全屏白色背景（拦截输入） ── */
        const bg = new Node('SettlementBg');
        root.addChild(bg);
        bg.addComponent(UITransform).setContentSize(viewW, viewH);
        const bgSp = bg.addComponent(Sprite);
        bgSp.sizeMode = Sprite.SizeMode.CUSTOM;
        bgSp.spriteFrame = sf;
        bgSp.color = Color.WHITE;
        const bgW = bg.addComponent(Widget);
        bgW.isAlignTop = true;    bgW.top = 0;
        bgW.isAlignBottom = true; bgW.bottom = 0;
        bgW.isAlignLeft = true;   bgW.left = 0;
        bgW.isAlignRight = true;  bgW.right = 0;
        bgW.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;
        const blocker = bg.addComponent(Button);
        blocker.target = bg;
        blocker.transition = Button.Transition.NONE;

        /* ── 回放画布 ── */
        const imgSize = Math.min(viewW, viewH) * GameConfig.settlementImageScale;
        const canvasNode = new Node('ReplayCanvas');
        root.addChild(canvasNode);
        canvasNode.setPosition(0, 40, 0);
        canvasNode.addComponent(UITransform).setContentSize(imgSize, imgSize);
        const canvasSp = canvasNode.addComponent(Sprite);
        canvasSp.sizeMode = Sprite.SizeMode.CUSTOM;

        /* ── 标题（回放完成后 fade-in） ── */
        const titleNode = new Node('Title');
        root.addChild(titleNode);
        titleNode.setPosition(0, imgSize / 2 + 70, 0);
        titleNode.addComponent(UITransform).setContentSize(400, 60);
        const titleLab = titleNode.addComponent(Label);
        titleLab.string = '恭喜完成!';
        titleLab.fontSize = 44;
        titleLab.horizontalAlign = Label.HorizontalAlign.CENTER;
        titleLab.verticalAlign = Label.VerticalAlign.CENTER;
        titleLab.color = new Color(60, 60, 60, 255);
        const titleOpacity = titleNode.addComponent(UIOpacity);
        titleOpacity.opacity = 0;

        /* ── 按钮容器（回放完成后 fade-in） ── */
        const btnGroup = new Node('BtnGroup');
        root.addChild(btnGroup);
        btnGroup.setPosition(0, -imgSize / 2 - 30, 0);
        btnGroup.addComponent(UITransform).setContentSize(viewW, 70);
        const btnGroupOpacity = btnGroup.addComponent(UIOpacity);
        btnGroupOpacity.opacity = 0;

        let animator: ReplayAnimator | null = null;

        const showResults = (): void => {
            tween(titleOpacity)
                .delay(GameConfig.settlementActionFadeInDelay)
                .to(GameConfig.settlementActionFadeInDur, { opacity: 255 })
                .start();
            tween(btnGroupOpacity)
                .delay(GameConfig.settlementActionFadeInDelay)
                .to(GameConfig.settlementActionFadeInDur, { opacity: 255 })
                .start();
        };

        /* ── "再看一次" 按钮（对标 G15 ReplayAgainLogic：按钮保持可见，仅重放像素动画） ── */
        const replayNode = this._createButton(sf, '再看一次', new Color(220, 220, 220, 255), new Color(60, 60, 60, 255));
        btnGroup.addChild(replayNode);
        replayNode.setPosition(-130, 0, 0);
        replayNode.getComponent(Button)!.node.on(Button.EventType.CLICK, () => {
            if (animator && !animator.playing) {
                animator.play();
            }
        });

        /* ── "返回首页" 按钮 ── */
        const backNode = this._createButton(sf, '返回首页', new Color(76, 175, 80, 255), Color.WHITE);
        btnGroup.addChild(backNode);
        backNode.setPosition(130, 0, 0);
        backNode.getComponent(Button)!.node.on(Button.EventType.CLICK, () => onBack());

        /* ── 挂载回放动画器 ── */
        animator = canvasNode.addComponent(ReplayAnimator);
        animator.setup(puzzle, history, canvasSp, showResults, GameConfig.settlementReplayDur);

        /* ── 启动：白色面板 fade-in → delay → 回放 ── */
        tween(rootOpacity)
            .to(GameConfig.settlementFadeInDur, { opacity: 255 })
            .delay(GameConfig.settlementReplayStartDelay)
            .call(() => animator!.play())
            .start();
    }

    private static _createButton(sf: SpriteFrame, label: string, bgColor: Color, textColor: Color): Node {
        const node = new Node(`Btn_${label}`);
        node.addComponent(UITransform).setContentSize(200, 56);

        const sp = node.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.spriteFrame = sf;
        sp.color = bgColor;

        const labNode = new Node('Label');
        node.addChild(labNode);
        labNode.addComponent(UITransform).setContentSize(200, 56);
        const lab = labNode.addComponent(Label);
        lab.string = label;
        lab.fontSize = 26;
        lab.horizontalAlign = Label.HorizontalAlign.CENTER;
        lab.verticalAlign = Label.VerticalAlign.CENTER;
        lab.color = textColor;

        const btn = node.addComponent(Button);
        btn.target = node;
        btn.transition = Button.Transition.SCALE;
        btn.zoomScale = 0.9;

        return node;
    }
}
