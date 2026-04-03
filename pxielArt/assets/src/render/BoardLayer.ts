import { Node, Sprite, SpriteFrame, Texture2D, UITransform } from 'cc';
import { BoardData } from '../core/data/BoardData';
import { PixelBuffer } from '../core/PixelBuffer';
import { nonSelectedBoardFadeAlpha } from '../core/viewport/ZoomFadeMath';

/** Board 灰度底图；缩放时按 G15_FBase_ZoomFadeLogic 向 boardFadeColor / 选中格目标色渐变 */
export class BoardLayer {
    readonly pixelBuffer: PixelBuffer;
    readonly node: Node;
    private readonly _texture: Texture2D;
    private readonly _boardData: BoardData;
    /** 每格 3 字节 RGB，仅 idx>=0 的格有效 */
    private readonly _baseRgb: Uint8Array;
    private _lastQuantizedAlpha = -1;
    private _lastBrushIndex = -2;

    constructor(parent: Node, boardData: BoardData, cellDisplayW: number, cellDisplayH: number) {
        this._boardData = boardData;
        const cols = boardData.gridCols;
        const rows = boardData.gridRows;

        this.pixelBuffer = new PixelBuffer(cols, rows);
        this._baseRgb = new Uint8Array(cols * rows * 3);

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const idx = boardData.getBrushIndex(r, c);
                const flat = (r * cols + c) * 3;
                if (idx < 0) {
                    this.pixelBuffer.setPixel(r, c, 238, 238, 238, 255);
                } else {
                    let hex = boardData.palette[idx] ?? '#888888';
                    if (!hex.startsWith('#')) hex = `#${hex}`;
                    const g = BoardData.hexToGray(hex);
                    const v = Math.round(90 + (g / 255) * 110);
                    this.pixelBuffer.setPixel(r, c, v, v, v, 255);
                    this._baseRgb[flat] = v;
                    this._baseRgb[flat + 1] = v;
                    this._baseRgb[flat + 2] = v;
                }
            }
        }

        this._texture = new Texture2D();
        this._texture.reset({ width: cols, height: rows, format: Texture2D.PixelFormat.RGBA8888 });
        this._texture.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
        this._texture.uploadData(this.pixelBuffer.getFlippedData());

        this.node = new Node('Board');
        parent.addChild(this.node);
        const ut = this.node.addComponent(UITransform);
        ut.setContentSize(cols * cellDisplayW, rows * cellDisplayH);

        const sp = this.node.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.type = Sprite.Type.SIMPLE;
        const sf = new SpriteFrame();
        sf.texture = this._texture;
        sp.spriteFrame = sf;
    }

    /**
     * G15 ZoomFade 盘面像素更新；digit 层用 rawAlpha，此处用量化 alpha。
     * @returns 是否执行了纹理上传
     */
    applyZoomFade(
        brushIndex: number,
        quantizedAlpha: number,
        alphaSteps: number,
        fadeR: number,
        fadeG: number,
        fadeB: number,
        selR: number,
        selG: number,
        selB: number,
        selFadeR: number,
        selFadeG: number,
        selFadeB: number,
    ): boolean {
        if (quantizedAlpha === this._lastQuantizedAlpha && brushIndex === this._lastBrushIndex) {
            return false;
        }
        this._lastQuantizedAlpha = quantizedAlpha;
        this._lastBrushIndex = brushIndex;

        const cols = this._boardData.gridCols;
        const rows = this._boardData.gridRows;
        const alpha = quantizedAlpha;
        const nonSelAlpha = nonSelectedBoardFadeAlpha(alpha, alphaSteps);

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const idx = this._boardData.getBrushIndex(r, c);
                if (idx < 0) continue;

                const flat = (r * cols + c) * 3;
                const gray = this._baseRgb[flat];

                if (idx === brushIndex) {
                    this.pixelBuffer.setPixel(
                        r,
                        c,
                        (selR + (selFadeR - selR) * alpha + 0.5) | 0,
                        (selG + (selFadeG - selG) * alpha + 0.5) | 0,
                        (selB + (selFadeB - selB) * alpha + 0.5) | 0,
                        255,
                    );
                } else {
                    this.pixelBuffer.setPixel(
                        r,
                        c,
                        (gray + (fadeR - gray) * nonSelAlpha + 0.5) | 0,
                        (gray + (fadeG - gray) * nonSelAlpha + 0.5) | 0,
                        (gray + (fadeB - gray) * nonSelAlpha + 0.5) | 0,
                        255,
                    );
                }
            }
        }

        this._texture.uploadData(this.pixelBuffer.getFlippedData());
        return true;
    }

    flush(): void {
        this._texture.uploadData(this.pixelBuffer.getFlippedData());
    }
}
