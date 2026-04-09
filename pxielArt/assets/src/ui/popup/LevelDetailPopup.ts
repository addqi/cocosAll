import {
    Button, Color, JsonAsset, Label, Node, resources,
    Sprite, SpriteFrame, tween, UIOpacity, UITransform, Vec3, view,
} from 'cc';
import { LevelEntry } from '../../config/LevelManifest';
import { PuzzleData } from '../../types/types';
import { PuzzlePreview } from '../../util/PuzzlePreview';
import { StorageService } from '../../storage/StorageService';
import { getWhitePixelSF } from '../../util/WhitePixel';
import { BundleManager } from '../../config/BundleManager';

const INFO_FONT = 24;
const INFO_COLOR = new Color(120, 120, 120, 255);
const CARD_PAD = 30;

export class LevelDetailPopup {

    static show(
        parent: Node,
        entry: LevelEntry,
        previewFrame: SpriteFrame | null,
        onStart: (entry: LevelEntry, puzzle: PuzzleData | null) => void,
    ): void {
        const vs = view.getVisibleSize();
        const sf = getWhitePixelSF();

        const cardW = vs.width * 0.8;
        const previewSize = cardW * 0.65;
        const cardH = CARD_PAD + previewSize + 160 + 70 + CARD_PAD;

        /* ── 根 ── */
        const root = new Node('LevelDetail');
        parent.addChild(root);
        root.addComponent(UITransform).setContentSize(vs.width, vs.height);

        /* ── 遮罩 ── */
        const overlay = new Node('Overlay');
        root.addChild(overlay);
        overlay.addComponent(UITransform).setContentSize(vs.width, vs.height);
        const oSp = overlay.addComponent(Sprite);
        oSp.sizeMode = Sprite.SizeMode.CUSTOM;
        oSp.spriteFrame = sf;
        oSp.color = new Color(0, 0, 0, 128);
        const overlayOp = overlay.addComponent(UIOpacity);
        overlayOp.opacity = 0;
        const oBtn = overlay.addComponent(Button);
        oBtn.target = overlay;
        oBtn.transition = Button.Transition.NONE;
        oBtn.node.on(Button.EventType.CLICK, () => dismiss());

        /* ── 卡片 ── */
        const card = new Node('Card');
        root.addChild(card);
        card.addComponent(UITransform).setContentSize(cardW, cardH);

        const cardBg = new Node('Bg');
        card.addChild(cardBg);
        cardBg.addComponent(UITransform).setContentSize(cardW, cardH);
        const bgSp = cardBg.addComponent(Sprite);
        bgSp.sizeMode = Sprite.SizeMode.CUSTOM;
        bgSp.spriteFrame = sf;
        bgSp.color = Color.WHITE;

        /* ── 右上角关闭按钮 ── */
        const CLOSE_SIZE = 44;
        const closeNode = new Node('CloseBtn');
        card.addChild(closeNode);
        closeNode.setPosition(cardW / 2 - CLOSE_SIZE / 2 - 12, cardH / 2 - CLOSE_SIZE / 2 - 12, 0);
        closeNode.addComponent(UITransform).setContentSize(CLOSE_SIZE, CLOSE_SIZE);
        const closeLab = closeNode.addComponent(Label);
        closeLab.string = '✕';
        closeLab.fontSize = 28;
        closeLab.horizontalAlign = Label.HorizontalAlign.CENTER;
        closeLab.verticalAlign = Label.VerticalAlign.CENTER;
        closeLab.color = new Color(160, 160, 160, 255);
        const closeBtn = closeNode.addComponent(Button);
        closeBtn.target = closeNode;
        closeBtn.transition = Button.Transition.SCALE;
        closeBtn.zoomScale = 0.85;
        closeBtn.node.on(Button.EventType.CLICK, () => dismiss());

        /* ── 预览图 ── */
        let yOff = cardH / 2 - CARD_PAD - previewSize / 2;
        const imgNode = new Node('Preview');
        card.addChild(imgNode);
        imgNode.setPosition(0, yOff, 0);
        imgNode.addComponent(UITransform).setContentSize(previewSize, previewSize);
        const imgSp = imgNode.addComponent(Sprite);
        imgSp.sizeMode = Sprite.SizeMode.CUSTOM;
        if (previewFrame) imgSp.spriteFrame = previewFrame;
        else imgSp.color = new Color(230, 230, 230, 255);

        /* ── 信息区域 ── */
        yOff -= previewSize / 2 + 24;

        const nameLab = this._label(card, entry.name, 32, new Color(50, 50, 50, 255), cardW, 40);
        nameLab.setPosition(0, yOff, 0);

        yOff -= 36;
        const infoLabel = this._label(card, '加载中...', INFO_FONT, INFO_COLOR, cardW, 30);
        infoLabel.setPosition(0, yOff, 0);

        yOff -= 32;
        const progressLabel = this._label(card, '', INFO_FONT, INFO_COLOR, cardW, 30);
        progressLabel.setPosition(0, yOff, 0);

        /* ── 开始按钮 ── */
        const hasProgress = StorageService.hasPaintRecord(entry.id);
        const startBtn = new Node('StartBtn');
        card.addChild(startBtn);
        startBtn.setPosition(0, -cardH / 2 + 35 + CARD_PAD, 0);
        startBtn.addComponent(UITransform).setContentSize(200, 56);
        const sBgSp = startBtn.addComponent(Sprite);
        sBgSp.sizeMode = Sprite.SizeMode.CUSTOM;
        sBgSp.spriteFrame = sf;
        sBgSp.color = new Color(76, 175, 80, 255);

        const sLabNode = new Node('Label');
        startBtn.addChild(sLabNode);
        sLabNode.addComponent(UITransform).setContentSize(200, 56);
        const sLab = sLabNode.addComponent(Label);
        sLab.string = hasProgress ? '继续挑战' : '开始挑战';
        sLab.fontSize = 26;
        sLab.horizontalAlign = Label.HorizontalAlign.CENTER;
        sLab.verticalAlign = Label.VerticalAlign.CENTER;
        sLab.color = Color.WHITE;

        const sBtn = startBtn.addComponent(Button);
        sBtn.target = startBtn;
        sBtn.transition = Button.Transition.SCALE;
        sBtn.zoomScale = 0.9;

        /* ── 弹出动画 ── */
        const cardOp = card.addComponent(UIOpacity);
        cardOp.opacity = 0;
        card.setScale(0.85, 0.85, 1);

        tween(overlayOp).to(0.25, { opacity: 255 }).start();
        tween(cardOp).to(0.25, { opacity: 255 }).start();
        tween(card).to(0.25, { scale: new Vec3(1, 1, 1) }).start();

        /* ── 预加载 JSON ── */
        let loadedPuzzle: PuzzleData | null = null;
        BundleManager.loadPuzzle(entry.jsonPath).then(jsonAsset => {
            loadedPuzzle = jsonAsset.json as PuzzleData;
            const p = loadedPuzzle;

            infoLabel.getComponent(Label)!.string =
                `${p.gridSize} × ${p.gridSize}    ${p.palette.length} 种颜色`;

            if (StorageService.hasPaintRecord(entry.id)) {
                const records = StorageService.loadPaintRecord(entry.id);
                const total = p.gridSize * p.gridSize;
                const pct = Math.round(records.length / total * 100);
                progressLabel.getComponent(Label)!.string = `进度: ${pct}%`;
            } else {
                progressLabel.getComponent(Label)!.string = '全新关卡';
            }

            if (!previewFrame) {
                let paintedSet: Set<number> | undefined;
                if (StorageService.hasPaintRecord(entry.id)) {
                    paintedSet = new Set<number>();
                    for (const r of StorageService.loadPaintRecord(entry.id)) {
                        paintedSet.add(r.row * p.gridSize + r.col);
                    }
                }
                imgSp.spriteFrame = PuzzlePreview.createSpriteFrame(p, paintedSet);
            }
        });

        /* ── 点击开始 ── */
        sBtn.node.on(Button.EventType.CLICK, () => {
            dismiss(() => onStart(entry, loadedPuzzle));
        });

        /* ── 关闭逻辑 ── */
        let dismissing = false;
        function dismiss(afterClose?: () => void) {
            if (dismissing) return;
            dismissing = true;
            tween(overlayOp).to(0.2, { opacity: 0 }).start();
            tween(cardOp).to(0.2, { opacity: 0 }).start();
            tween(card)
                .to(0.2, { scale: new Vec3(0.85, 0.85, 1) })
                .call(() => { root.destroy(); afterClose?.(); })
                .start();
        }
    }

    private static _label(
        parent: Node, text: string, fontSize: number, color: Color, w: number, h: number,
    ): Node {
        const node = new Node('Info');
        parent.addChild(node);
        node.addComponent(UITransform).setContentSize(w, h);
        const lab = node.addComponent(Label);
        lab.string = text;
        lab.fontSize = fontSize;
        lab.horizontalAlign = Label.HorizontalAlign.CENTER;
        lab.verticalAlign = Label.VerticalAlign.CENTER;
        lab.color = color;
        return node;
    }
}
