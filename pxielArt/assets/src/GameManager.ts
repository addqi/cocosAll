import { _decorator, Material, Component, EventTouch, Node, Sprite, SpriteFrame, Texture2D, UITransform, Vec3, JsonAsset, Vec2, Widget } from 'cc';
import { CellConverter } from './core/paint/CellConverter';
import { PaintExecutor } from './core/paint/PaintExecutor';
import { BoardData } from './core/data/BoardData';
import { BrushState } from './core/data/BrushState';
import { PixelBuffer } from './core/PixelBuffer';
import { PalettePanel } from './ui/palette/PalettePanel';

const { ccclass, property } = _decorator;

@ccclass('GameManager')
export class GameManager extends Component {
    @property gridCols = 10;
    @property gridRows = 10;
    @property cellDisplaySize = 20;

    @property({ type: Material, displayName: 'Digit 材质' })
    digitMaterial: Material = null!;


    @property({ type: JsonAsset, displayName: '谜题数据' })
    puzzleJson: JsonAsset = null!;

    /** 调色块底图：拖入 assets/res/splash 的 SpriteFrame */
    @property({ type: SpriteFrame, displayName: '调色块底图' })
    paletteItemSprite: SpriteFrame | null = null;

    private _pixelBuffer!: PixelBuffer;
    private _texture!: Texture2D;
    private _converter!: CellConverter;
    private _executor!: PaintExecutor;
    private _boardData!: BoardData;
    private _brushState!: BrushState;
    /** Digit 层纹理 */
    private _digitPixels!: PixelBuffer;

    start() {
        const puzzle = this.puzzleJson.json as any;
        const cols = puzzle.gridSize;  // 30
        const rows = puzzle.gridSize;  // 30
        const cellSize = this.cellDisplaySize;  // 在检查器里改成 20
        // 1. 用 PixelBuffer 创建全白像素
        this._pixelBuffer = new PixelBuffer(cols, rows);
        this._pixelBuffer.fill(255, 255, 255, 255);

        // 2. 创建动态纹理
        const tex = new Texture2D();
        tex.reset({ width: cols, height: rows, format: Texture2D.PixelFormat.RGBA8888 });
        tex.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
        tex.uploadData(this._pixelBuffer.getFlippedData());
        this._texture = tex;

        // 3. 绑定到 Sprite
        const sprite = this.node.getComponent(Sprite) || this.node.addComponent(Sprite);
        sprite.spriteFrame = new SpriteFrame();
        sprite.spriteFrame.texture = tex;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        this.node.getComponent(UITransform)!.setContentSize(cols * cellSize, rows * cellSize);

        // 4. 谜题数据（前3行分别是红/绿/蓝，其余空格）
        this._boardData = new BoardData(puzzle);
        this._brushState = new BrushState();
        this._brushState.palette = this._boardData.palette;
        this._brushState.currentIndex = 0; // 默认红色画笔

        // 5. 创建涂色执行器 + 坐标转换器
        this._converter = new CellConverter(cols, rows, cellSize, cellSize);
        this._executor = new PaintExecutor(
            this._pixelBuffer, null, null,
            this._boardData, this._brushState,
        );

        // 6. 监听触摸
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);

        // 创建 digit
        this._digitPixels = new PixelBuffer(cols, rows);
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const brushIndex = this._boardData.getBrushIndex(r, c);
                const digitVal = brushIndex >= 0 ? brushIndex + 1 : 0;
                this._digitPixels.setPixel(r, c, digitVal, 0, 0, 0);
            }
        }
        // 创建 Digit 覆盖层节点
        const digitNode = new Node('Digit');
        this.node.addChild(digitNode);
        const digitSprite = digitNode.addComponent(Sprite);
        digitSprite.spriteFrame = new SpriteFrame();
        const digitTex = new Texture2D();
        digitTex.reset({ width: cols, height: rows, format: Texture2D.PixelFormat.RGBA8888 });
        digitTex.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
        digitTex.uploadData(this._digitPixels.getFlippedData());
        digitSprite.spriteFrame.texture = digitTex; // 再换
        digitSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        digitSprite.customMaterial = this.digitMaterial;  // ← 关键：用自定义 shader！
        digitNode.addComponent(UITransform).setContentSize(cols * cellSize, rows * cellSize);
        const matInst = digitSprite.getMaterialInstance(0)!;
        matInst.setProperty('gridSize', new Vec2(cols, rows));

        this._setupPalette();
    }

    /** 底部横向滑动调色板（2 行，颜色来自谜题 palette） */
    private _setupPalette(): void {
        if (!this.paletteItemSprite) {
            console.warn('[GameManager] 未指定调色块底图 paletteItemSprite，请拖入 res/splash 的 SpriteFrame');
            return;
        }
        const canvas = this.node.parent;
        if (!canvas) {
            console.warn('[GameManager] 未找到 Canvas 父节点，无法创建调色板');
            return;
        }
        const bar = new Node('PaletteBar');
        canvas.addChild(bar);
        bar.setSiblingIndex(canvas.children.length - 1);

        const widget = bar.addComponent(Widget);
        widget.isAlignBottom = true;
        widget.isAlignLeft = true;
        widget.isAlignRight = true;
        widget.bottom = 0;
        widget.left = 0;
        widget.right = 0;
        widget.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;

        const panel = bar.addComponent(PalettePanel);
        panel.setup(this._boardData.palette, this._brushState, this.paletteItemSprite);
    }

    private onTouchEnd(event: EventTouch) {
        const ut = this.node.getComponent(UITransform)!;
        const loc = event.getUILocation();
        const local = ut.convertToNodeSpaceAR(new Vec3(loc.x, loc.y, 0));

        const cell = this._converter.pointerToCell(local.x, local.y, 0, 0, 1);
        if (!cell) return;

        // 涂色！
        const cells = [{ row: cell.row, col: cell.col, brushIndex: this._brushState.currentIndex }];
        const results = this._executor.paintCells(cells);

        // 刷新纹理
        if (this._executor.brushDirty) {
            this._texture.uploadData(this._pixelBuffer.getFlippedData());
            this._executor.resetDirty();
        }

        const color = this._brushState.palette[this._brushState.currentIndex];
        console.log(`涂色 (${cell.row},${cell.col}) 颜色=${color} matched=${results[0]}`);
    }
}