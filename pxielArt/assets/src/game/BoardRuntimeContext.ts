import { Node } from 'cc';
import { GameConfig } from '../config/GameConfig';
import { quantizeZoomFadeAlpha, smoothstep } from '../core/viewport/ZoomFadeMath';
import { BoardData } from '../core/data/BoardData';
import { BrushState } from '../core/data/BrushState';
import { PaintExecutor } from '../core/paint/PaintExecutor';
import { CellConverter } from '../core/paint/CellConverter';
import { BrushLayer } from '../render/BrushLayer';
import { DigitLayer } from '../render/DigitLayer';
import { BoardLayer } from '../render/BoardLayer';
import { ViewportController } from '../core/viewport/ViewportController';
import { PaintSaveManager } from '../storage/PaintSaveManager';

export class BoardRuntimeContext {
    readonly boardRoot: Node;
    readonly contentNode: Node;
    readonly cellDisplayW: number;
    readonly cellDisplayH: number;
    readonly boardData: BoardData;
    readonly brushState: BrushState;
    readonly boardLayer: BoardLayer;
    readonly brushLayer: BrushLayer;
    readonly digitLayer: DigitLayer;
    readonly cellConverter: CellConverter;
    readonly paintExecutor: PaintExecutor;
    readonly viewport: ViewportController;
    readonly saveManager: PaintSaveManager;

    constructor(params: {
        boardRoot: Node;
        contentNode: Node;
        cellDisplayW: number;
        cellDisplayH: number;
        boardData: BoardData;
        brushState: BrushState;
        boardLayer: BoardLayer;
        brushLayer: BrushLayer;
        digitLayer: DigitLayer;
        cellConverter: CellConverter;
        paintExecutor: PaintExecutor;
        viewport: ViewportController;
        saveManager: PaintSaveManager;
    }) {
        this.boardRoot = params.boardRoot;
        this.contentNode = params.contentNode;
        this.cellDisplayW = params.cellDisplayW;
        this.cellDisplayH = params.cellDisplayH;
        this.boardData = params.boardData;
        this.brushState = params.brushState;
        this.boardLayer = params.boardLayer;
        this.brushLayer = params.brushLayer;
        this.digitLayer = params.digitLayer;
        this.cellConverter = params.cellConverter;
        this.paintExecutor = params.paintExecutor;
        this.viewport = params.viewport;
        this.saveManager = params.saveManager;
    }

    /**
     * G15 ZoomFade 语义 + pxielArt 量纲：对 zoom 归一化 t=(scale-min)/(max-min) 做 smoothstep；
     * Digit 层 rawAlpha；Board 用量化 alpha 做底色 lerp。
     */
    refreshDetailVisibility(): void {
        const scale = this.viewport.scale;
        const minS = this.viewport.minScale;
        const maxS = this.viewport.maxScale;
        const span = maxS - minS;
        let rawAlpha: number;
        if (span < 1e-8) {
            rawAlpha = 1;
        } else {
            const t = (scale - minS) / span;
            const lowT = GameConfig.viewportDetailSmoothLowT;
            const highT = Math.max(lowT + 1e-4, GameConfig.viewportDetailSmoothHighT);
            rawAlpha = smoothstep(lowT, highT, t);
        }
        const steps = GameConfig.viewportZoomFadeAlphaSteps;
        const qAlpha = quantizeZoomFadeAlpha(rawAlpha, steps);

        this.digitLayer.setDetailOpacity(rawAlpha);

        const f = GameConfig.boardFadeColor;
        const s0 = GameConfig.selectedCellColor;
        const s1 = GameConfig.selectedCellFadeColor;
        this.boardLayer.applyZoomFade(
            this.brushState.currentIndex,
            qAlpha,
            steps,
            (f >> 16) & 0xff,
            (f >> 8) & 0xff,
            f & 0xff,
            (s0 >> 16) & 0xff,
            (s0 >> 8) & 0xff,
            s0 & 0xff,
            (s1 >> 16) & 0xff,
            (s1 >> 8) & 0xff,
            s1 & 0xff,
        );
    }

    flushPaintLayers(): void {
        const ex = this.paintExecutor;
        if (ex.brushDirty) {
            this.brushLayer.flush();
        }
        if (ex.digitDirty) {
            this.digitLayer.flush();
        }
        ex.resetDirty();
    }
}
