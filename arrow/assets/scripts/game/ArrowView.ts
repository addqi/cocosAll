import {
    _decorator, Component, UITransform, Graphics, Color, Vec3,
} from 'cc';
import { ArrowData } from '../core/LevelData';
import { gridToPixel } from '../core/Coord';
import { Config } from '../common/Config';
const { ccclass } = _decorator;

/** 箭头 Idle 状态的默认颜色：纯白 */
const IDLE_COLOR = new Color(0xff, 0xff, 0xff, 0xff);

/**
 * 一根箭头的视图。
 * 本章只画静态：一条线 + 一个三角形箭头头。
 * 后续章节会加上 moveMode 状态驱动的颜色变化和位置更新。
 */
@ccclass('ArrowView')
export class ArrowView extends Component {
    private _graphics: Graphics | null = null;
    private _data: ArrowData | null = null;
    private _rows = 0;
    private _cols = 0;

    /** 由 GameController / BoardView 注入数据，注入后立即画一次 */
    public initData(data: ArrowData, rows: number, cols: number) {
        if (!this._graphics) {
            this._graphics = this.getComponent(Graphics) ?
                this.getComponent(Graphics) : this.addComponent(Graphics);
        }
        if (!this.node.getComponent(UITransform)) {
            this.node.addComponent(UITransform);
        }
        this._data = data;
        this._rows = rows;
        this._cols = cols;
        this._redraw();
    }
    private _redraw() {
        if (!this._data || !this._graphics) {
            console.error("ArrowView: _data or _graphics is null");
        }
        const g = this._graphics;
        g.clear();
        const { direction, coords } = this._data;
        const tail = coords[0];
        const head = coords[coords.length - 1];

        const tailPx = gridToPixel(tail[0], tail[1], this._rows, this._cols);
        const headPx = gridToPixel(head[0], head[1], this._rows, this._cols);

        // 像素方向向量：格子 [dr, dc] → 像素 (dc, -dr)
        const pdx = direction[1];
        const pdy = -direction[0];

        // 1) 画线条身体
        g.strokeColor = IDLE_COLOR;
        g.lineWidth = Config.arrowLineWidth;
        g.moveTo(tailPx.x, tailPx.y);
        g.lineTo(headPx.x, headPx.y);
        g.stroke();

        // 2) 画三角形箭头头
        const s = Config.arrowHeadSize;
        const nx = -pdy, ny = pdx;  // 垂直方向（逆时针 90°）
        const tipX = headPx.x + pdx * s;
        const tipY = headPx.y + pdy * s;
        const leftX = headPx.x + nx * s / 2;
        const leftY = headPx.y + ny * s / 2;
        const rightX = headPx.x - nx * s / 2;
        const rightY = headPx.y - ny * s / 2;

        g.fillColor = IDLE_COLOR;
        g.moveTo(tipX, tipY);
        g.lineTo(leftX, leftY);
        g.lineTo(rightX, rightY);
        g.close();
        g.fill();
    }
}