import { Material, Node, Sprite, UITransform, view } from 'cc';
import { GameConfig } from '../config/GameConfig';
import { BoardData } from '../core/data/BoardData';
import { BrushState } from '../core/data/BrushState';
import { PaintExecutor } from '../core/paint/PaintExecutor';
import { CellConverter } from '../core/paint/CellConverter';
import { PuzzleData } from '../types/types';
import { BrushLayer } from '../render/BrushLayer';
import { DigitLayer } from '../render/DigitLayer';
import { BoardLayer } from '../render/BoardLayer';
import { BoardRuntimeContext } from './BoardRuntimeContext';
import { ViewportController } from '../core/viewport/ViewportController';

export interface BoardViewportParams {
    zoomStep: number;
    zoomSpeedPerSecond: number;
    autoFitInitial: boolean;
}

export interface BoardBootstrapParams {
    boardRoot: Node;
    puzzle: PuzzleData;
    cellDisplaySize: number;
    digitMaterial: Material;
    viewport: BoardViewportParams;
}

/** 建 Content → Board → Digit → Brush，接视口缩放 */
export class BoardBootstrap {
    static run(p: BoardBootstrapParams): BoardRuntimeContext {
        const cols = p.puzzle.gridSize;
        const rows = p.puzzle.gridSize;
        const cell = p.cellDisplaySize;
        const bw = cols * cell;
        const bh = rows * cell;

        const oldSprite = p.boardRoot.getComponent(Sprite);
        if (oldSprite) {
            oldSprite.destroy();
        }

        const boardData = new BoardData(p.puzzle);
        const brushState = new BrushState();
        brushState.palette = boardData.palette;
        brushState.currentIndex = 0;

        const content = new Node('BoardContent');
        p.boardRoot.addChild(content);
        const cUt = content.addComponent(UITransform);
        cUt.setContentSize(bw, bh);

        const boardLayer = new BoardLayer(content, boardData, cell, cell);
        const digitLayer = new DigitLayer(content, boardData, p.digitMaterial, cell, cell);
        const brushLayer = new BrushLayer(content, cols, rows, cell, cell);

        const paintExecutor = new PaintExecutor(
            brushLayer.pixelBuffer,
            null,
            digitLayer.pixelBuffer,
            boardData,
            brushState,
        );

        const cellConverter = new CellConverter(cols, rows, cell, cell);

        const vs = view.getVisibleSize();
        const fitMin =
            Math.min(vs.width / bw, vs.height / bh) * GameConfig.viewportAutoFitScreenRatio;
        const vmin = Math.min(vs.width, vs.height);
        const k = GameConfig.viewportMaxZoomVisibleCells;
        const maxByCells = vmin / (k * cell);
        const minScale = fitMin;
        const maxScale = Math.max(maxByCells, minScale);

        let ctx!: BoardRuntimeContext;
        const viewport = new ViewportController(content, {
            minScale,
            maxScale,
            zoomStep: p.viewport.zoomStep,
            zoomSpeedPerSecond: p.viewport.zoomSpeedPerSecond,
            autoFitInitial: p.viewport.autoFitInitial,
            boardWidthPx: bw,
            boardHeightPx: bh,
            viewportPadding: GameConfig.viewportPadding,
            onScaleChanged: () => {
                ctx.refreshDetailVisibility();
            },
        });

        ctx = new BoardRuntimeContext({
            boardRoot: p.boardRoot,
            contentNode: content,
            cellDisplayW: cell,
            cellDisplayH: cell,
            boardData,
            brushState,
            boardLayer,
            brushLayer,
            digitLayer,
            cellConverter,
            paintExecutor,
            viewport,
        });

        ctx.refreshDetailVisibility();
        return ctx;
    }
}
