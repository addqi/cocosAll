import { Button, Node, Sprite, SpriteFrame, Texture2D, UITransform } from 'cc';
import { PixelBuffer } from '../core/PixelBuffer';

/** Brush 层：最上层子节点；初始全透明以露出灰底，涂色后盖住数字 */
export class BrushLayer {
    readonly pixelBuffer: PixelBuffer;
    readonly node: Node;
    private readonly _texture: Texture2D;

    constructor(
        parent: Node,
        gridCols: number,
        gridRows: number,
        cellDisplayW: number,
        cellDisplayH: number,
    ) {
        this.pixelBuffer = new PixelBuffer(gridCols, gridRows);
        this.pixelBuffer.fill(0, 0, 0, 0);

        this._texture = new Texture2D();
        this._texture.reset({ width: gridCols, height: gridRows, format: Texture2D.PixelFormat.RGBA8888 });
        this._texture.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
        this._texture.uploadData(this.pixelBuffer.getFlippedData());

        this.node = new Node('Brush');
        parent.addChild(this.node);
        const ut = this.node.addComponent(UITransform);
        ut.setContentSize(gridCols * cellDisplayW, gridRows * cellDisplayH);

        const sprite = this.node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.type = Sprite.Type.SIMPLE;
        const sf = new SpriteFrame();
        sf.texture = this._texture;
        sprite.spriteFrame = sf;

        // 全透明 Sprite 常无法命中；Button 按 UITransform 整块接收触摸
        const btn = this.node.addComponent(Button);
        btn.target = this.node;
        btn.transition = Button.Transition.NONE;
    }

    flush(): void {
        this._texture.uploadData(this.pixelBuffer.getFlippedData());
    }
}
