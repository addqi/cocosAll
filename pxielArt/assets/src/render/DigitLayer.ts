import { Material, Node, Sprite, SpriteFrame, Texture2D, UITransform, Vec2, Vec4 } from 'cc';
import { BoardData } from '../core/data/BoardData';
import { PixelBuffer } from '../core/PixelBuffer';

/** Digit 层：网格+数字同层；detailParams.x 为整层透明度（对齐 G15 digitComp.alpha） */
export class DigitLayer {
    readonly pixelBuffer: PixelBuffer;
    readonly node: Node;
    private readonly _texture: Texture2D;
    private readonly _sprite: Sprite;

    constructor(
        parent: Node,
        boardData: BoardData,
        digitMaterial: Material,
        cellDisplayW: number,
        cellDisplayH: number,
    ) {
        const cols = boardData.gridCols;
        const rows = boardData.gridRows;

        this.pixelBuffer = new PixelBuffer(cols, rows);
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const brushIndex = boardData.getBrushIndex(r, c);
                const digitVal = brushIndex >= 0 ? brushIndex + 1 : 0;
                this.pixelBuffer.setPixel(r, c, digitVal, 0, 0, 0);
            }
        }

        this._texture = new Texture2D();
        this._texture.reset({ width: cols, height: rows, format: Texture2D.PixelFormat.RGBA8888 });
        this._texture.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
        this._texture.uploadData(this.pixelBuffer.getFlippedData());

        this.node = new Node('Digit');
        parent.addChild(this.node);
        const ut = this.node.addComponent(UITransform);
        ut.setContentSize(cols * cellDisplayW, rows * cellDisplayH);

        this._sprite = this.node.addComponent(Sprite);
        this._sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        this._sprite.type = Sprite.Type.SIMPLE;
        const sf = new SpriteFrame();
        sf.texture = this._texture;
        this._sprite.spriteFrame = sf;
        this._sprite.customMaterial = digitMaterial;

        const matInst = this._sprite.getMaterialInstance(0)!;
        matInst.setProperty('gridSize', new Vec2(cols, rows));
        matInst.setProperty('detailParams', new Vec4(0, 0, 0, 0));
    }

    /** 0~1：网格线与数字共用（G15 rawAlpha） */
    setDetailOpacity(opacity: number): void {
        const matInst = this._sprite.getMaterialInstance(0);
        if (matInst) {
            matInst.setProperty('detailParams', new Vec4(opacity, 0, 0, 0));
        }
    }

    flush(): void {
        this._texture.uploadData(this.pixelBuffer.getFlippedData());
    }
}
