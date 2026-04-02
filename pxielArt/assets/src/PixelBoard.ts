import { _decorator, Component, EventTouch, ImageAsset, Node, Sprite, SpriteFrame, Texture2D, UITransform, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('PixelBoard')
export class PixelBoard extends Component {
    /** 网格尺寸 */
    @property gridCols = 10;
    @property gridRows = 10;
    /** 每个格子在屏幕上的显示尺寸（像素） */
    @property cellDisplaySize = 60;

    private _pixels!: Uint8Array;
    private _texture!: Texture2D;

    start() {
        const cols = this.gridCols;
        const rows = this.gridRows;
        this._pixels = new Uint8Array(cols * rows * 4);
        for (let i = 0; i < cols * rows; i++) {
            this._pixels[i * 4]     = 255; // R
            this._pixels[i * 4 + 1] = 255; // G
            this._pixels[i * 4 + 2] = 255; // B
            this._pixels[i * 4 + 3] = 255; // A
        }
        const tex = new Texture2D();
        tex.reset({
            width: cols,
            height: rows,
            format: Texture2D.PixelFormat.RGBA8888,
        });
        tex.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
        tex.uploadData(this._pixels);  // 直接上传像素数据
        this._texture = tex;

            const sprite = this.node.getComponent(Sprite)||this.node.addComponent(Sprite);
            sprite.spriteFrame = new SpriteFrame();
            sprite.spriteFrame.texture = tex;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;

            const uiTransform = this.node.getComponent(UITransform)!;
            uiTransform.setContentSize(
                cols * this.cellDisplaySize,
                rows * this.cellDisplaySize
            );
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    }
    private onTouchEnd(event: EventTouch) {
        const uiTransform = this.node.getComponent(UITransform)!;
        // 触摸点 → 节点本地坐标（锚点在中心，左下角为 -w/2, -h/2）
        const local = uiTransform.convertToNodeSpaceAR(new Vec3(event.getUILocation().x, event.getUILocation().y, 0));
        const w = uiTransform.contentSize.width;
        const h = uiTransform.contentSize.height;
        // 本地坐标 → 格子行列（纹理行0在顶部，Y轴需要翻转）
        const col = Math.floor((local.x + w / 2) / this.cellDisplaySize);
        const row = Math.floor((h / 2 - local.y) / this.cellDisplaySize);
        if (col < 0 || col >= this.gridCols || row < 0 || row >= this.gridRows) return;
        this.paintCell(row, col);
    }

    private paintCell(row: number, col: number) {
        const idx = (row * this.gridCols + col) * 4;
        this._pixels[idx]     = 0;
        this._pixels[idx + 1] = 0;
        this._pixels[idx + 2] = 0;
        this._pixels[idx + 3] = 255;
    
        this._texture.uploadData(this._pixels);  // 原地上传，不重建
    }
}

