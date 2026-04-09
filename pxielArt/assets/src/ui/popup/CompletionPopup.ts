import { Button, Color, Label, Node, Sprite, SpriteFrame, tween, UIOpacity, UITransform, Vec3, Widget } from 'cc';
import { CellBrushEntry, PuzzleData } from '../../types/types';
import { GameConfig } from '../../config/GameConfig';
import { getWhitePixelSF } from '../../util/WhitePixel';
import { ReplayAnimator } from './ReplayAnimator';

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
        const C = GameConfig;

        const imgSize = Math.min(viewW, viewH) * C.settlementImageScale * 0.75;
        const CARD_PAD = 40;
        const TITLE_H = 70;
        const BTN_H = 70;
        const cardW = viewW * 0.85;
        const cardH = TITLE_H + CARD_PAD + imgSize + CARD_PAD + BTN_H + CARD_PAD;

        /* ── 根节点 ── */
        const root = new Node('CompletionRoot');
        parent.addChild(root);
        root.addComponent(UITransform).setContentSize(viewW, viewH);

        /* ── 半透明暗色遮罩（拦截输入） ── */
        const overlay = new Node('Overlay');
        root.addChild(overlay);
        overlay.addComponent(UITransform).setContentSize(viewW, viewH);
        const oSp = overlay.addComponent(Sprite);
        oSp.sizeMode = Sprite.SizeMode.CUSTOM;
        oSp.spriteFrame = sf;
        oSp.color = new Color(0, 0, 0, 128);
        const oW = overlay.addComponent(Widget);
        oW.isAlignTop = true;    oW.top = 0;
        oW.isAlignBottom = true; oW.bottom = 0;
        oW.isAlignLeft = true;   oW.left = 0;
        oW.isAlignRight = true;  oW.right = 0;
        oW.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;
        const blocker = overlay.addComponent(Button);
        blocker.target = overlay;
        blocker.transition = Button.Transition.NONE;
        const overlayOp = overlay.addComponent(UIOpacity);
        overlayOp.opacity = 0;

        /* ── 白色卡片 ── */
        const card = new Node('Card');
        root.addChild(card);
        card.addComponent(UITransform).setContentSize(cardW, cardH);

        const cardBg = new Node('CardBg');
        card.addChild(cardBg);
        cardBg.addComponent(UITransform).setContentSize(cardW, cardH);
        const bgSp = cardBg.addComponent(Sprite);
        bgSp.sizeMode = Sprite.SizeMode.CUSTOM;
        bgSp.spriteFrame = sf;
        bgSp.color = Color.WHITE;

        /* ── 标题（回放后 fade-in） ── */
        const titleY = cardH / 2 - TITLE_H / 2 - 10;
        const titleNode = new Node('Title');
        card.addChild(titleNode);
        titleNode.setPosition(0, titleY, 0);
        titleNode.addComponent(UITransform).setContentSize(cardW, TITLE_H);
        const titleLab = titleNode.addComponent(Label);
        titleLab.string = '恭喜完成!';
        titleLab.fontSize = 42;
        titleLab.horizontalAlign = Label.HorizontalAlign.CENTER;
        titleLab.verticalAlign = Label.VerticalAlign.CENTER;
        titleLab.color = new Color(60, 60, 60, 255);
        const titleOp = titleNode.addComponent(UIOpacity);
        titleOp.opacity = 0;

        /* ── 回放画布 ── */
        const canvasY = titleY - TITLE_H / 2 - CARD_PAD - imgSize / 2 + 10;
        const canvasNode = new Node('ReplayCanvas');
        card.addChild(canvasNode);
        canvasNode.setPosition(0, canvasY, 0);
        canvasNode.addComponent(UITransform).setContentSize(imgSize, imgSize);
        const canvasSp = canvasNode.addComponent(Sprite);
        canvasSp.sizeMode = Sprite.SizeMode.CUSTOM;

        /* ── 按钮组（回放后 fade-in） ── */
        const btnY = -cardH / 2 + BTN_H / 2 + CARD_PAD;
        const btnGroup = new Node('BtnGroup');
        card.addChild(btnGroup);
        btnGroup.setPosition(0, btnY, 0);
        btnGroup.addComponent(UITransform).setContentSize(cardW, BTN_H);
        const btnGroupOp = btnGroup.addComponent(UIOpacity);
        btnGroupOp.opacity = 0;

        let animator: ReplayAnimator | null = null;

        const showResults = (): void => {
            tween(titleOp)
                .delay(C.settlementActionFadeInDelay)
                .to(C.settlementActionFadeInDur, { opacity: 255 })
                .start();
            tween(btnGroupOp)
                .delay(C.settlementActionFadeInDelay)
                .to(C.settlementActionFadeInDur, { opacity: 255 })
                .start();
        };

        const replayNode = this._createButton(sf, '再看一次', new Color(220, 220, 220, 255), new Color(60, 60, 60, 255));
        btnGroup.addChild(replayNode);
        replayNode.setPosition(-130, 0, 0);
        replayNode.getComponent(Button)!.node.on(Button.EventType.CLICK, () => {
            if (animator && !animator.playing) animator.play();
        });

        const backNode = this._createButton(sf, '返回首页', new Color(76, 175, 80, 255), Color.WHITE);
        btnGroup.addChild(backNode);
        backNode.setPosition(130, 0, 0);
        backNode.getComponent(Button)!.node.on(Button.EventType.CLICK, () => onBack());

        /* ── 回放动画器 ── */
        animator = canvasNode.addComponent(ReplayAnimator);
        animator.setup(puzzle, history, canvasSp, showResults, C.settlementReplayDur);

        /* ── 进入动画：遮罩渐显 + 卡片 scale 弹入 → delay → 回放 ── */
        const cardOp = card.addComponent(UIOpacity);
        cardOp.opacity = 0;
        card.setScale(0.9, 0.9, 1);

        tween(overlayOp).to(C.settlementFadeInDur, { opacity: 255 }).start();
        tween(cardOp).to(C.settlementFadeInDur, { opacity: 255 }).start();
        tween(card)
            .to(C.settlementFadeInDur, { scale: new Vec3(1, 1, 1) })
            .delay(C.settlementReplayStartDelay)
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
