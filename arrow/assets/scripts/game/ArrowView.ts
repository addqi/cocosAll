import {
    _decorator, Component, UITransform, Graphics, Color,
} from 'cc';
import { ArrowData, Cell } from '../core/LevelData';
import { ArrowRuntime, ArrowMoveMode } from '../core/ArrowState';
import { gridToPixel, Pixel } from '../core/Coord';
import { Config } from '../common/Config';
const { ccclass } = _decorator;

/** 三种箭头颜色。数值取自 G3_FBase */
const COLOR_IDLE = new Color(0xff, 0xff, 0xff, 0xff); // 空闲：白
const COLOR_MOVE = new Color(0x5b, 0x72, 0xfe, 0xff); // 飞行 / 逃脱：蓝
const COLOR_STOP = new Color(0xfe, 0x4b, 0x5e, 0xff); // 撞击 / 回弹 / 曾失败：红

@ccclass('ArrowView')
export class ArrowView extends Component {
    private _graphics: Graphics | null = null;
    private _data: ArrowData | null = null;
    private _rows = 0;
    private _cols = 0;
    /** 当前用于绘制的 runtime 引用。null 时按 Idle 画（首次 initData 用）*/
    private _rt: ArrowRuntime | null = null;

    /** 由 BoardView 注入数据，注入后按 Idle 颜色画一次 */
    public initData(data: ArrowData, rows: number, cols: number) {
        if (!this._graphics) {
            this._graphics = this.getComponent(Graphics) ?? this.addComponent(Graphics);
        }
        if (!this.node.getComponent(UITransform)) {
            this.node.addComponent(UITransform);
        }
        this._data = data;
        this._rows = rows;
        this._cols = cols;
        this._redraw();
    }

    /** 由 GameController 在每次状态变化时调用，按 runtime 重绘 */
    public refresh(rt: ArrowRuntime) {
        this._rt = rt;
        this._redraw();
    }

    private _redraw() {
        if (!this._data || !this._graphics) {
            console.error('ArrowView: _data or _graphics is null');
            return;
        }
        const g = this._graphics;
        // 1) 决定 coords 从哪来：有 runtime 优先用 runtime（动态），否则用 data（静态初始态）
        const coords: Cell[] = this._rt ? this._rt.coords : this._data.coords;
        if (coords.length < 2) return;
    
        g.clear();
    
        const color = this._pickColor();
        const pixels: Pixel[] = coords.map(
            ([r, c]) => gridToPixel(r, c, this._rows, this._cols),
        );
    
        // 2) 计算"头的视觉位置"：head 像素 + progress 方向延伸
        const progress = this._rt?.progress ?? 0;
        const dr = coords[coords.length - 1][0] - coords[coords.length - 2][0];
        const dc = coords[coords.length - 1][1] - coords[coords.length - 2][1];
        const tipPx: Pixel = {
            x: pixels[pixels.length - 1].x + dc * Config.gap * progress,
            y: pixels[pixels.length - 1].y - dr * Config.gap * progress,
        };
    
        // 3) 画折线：pixels[0] → ... → pixels[last]（→ tipPx 如果有延伸）
        g.strokeColor = color;
        g.lineWidth = Config.arrowLineWidth;
        const tailPx: Pixel = {
            x: pixels[0].x + progress * (pixels[1].x - pixels[0].x),
            y: pixels[0].y + progress * (pixels[1].y - pixels[0].y),
        };
        g.moveTo(tailPx.x, tailPx.y);
        for (let i = 1; i < pixels.length; i++) {
            g.lineTo(pixels[i].x, pixels[i].y);
        }
        if (progress > 0) {
            g.lineTo(tipPx.x, tipPx.y);
        }
        g.stroke();
    
        // 4) 三角头画在 tipPx 上
        this._drawHeadAt(g, tipPx, dr, dc, color);
    }

    /** 按当前 runtime 派生颜色。无 runtime 时按 Idle。*/
    private _pickColor(): Color {
        const rt = this._rt;
        if (!rt) return COLOR_IDLE;
        if (rt.mode === ArrowMoveMode.Start || rt.mode === ArrowMoveMode.End) {
            return COLOR_MOVE;
        }
        if (rt.mode === ArrowMoveMode.Collide || rt.mode === ArrowMoveMode.Back) {
            return COLOR_STOP;
        }
        if (rt.hasFailed) return COLOR_STOP;
        return COLOR_IDLE;
    }
    private _drawHeadAt(g: Graphics, at: Pixel, dr: number, dc: number, color: Color) {
        const pdx = dc;
        const pdy = -dr;
        const nx = -pdy;
        const ny = pdx;
        const s = Config.arrowHeadSize;
        const tipX = at.x + pdx * s;
        const tipY = at.y + pdy * s;
        const leftX = at.x + nx * s / 2;
        const leftY = at.y + ny * s / 2;
        const rightX = at.x - nx * s / 2;
        const rightY = at.y - ny * s / 2;
    
        g.fillColor = color;
        g.moveTo(tipX, tipY);
        g.lineTo(leftX, leftY);
        g.lineTo(rightX, rightY);
        g.close();
        g.fill();
    }

    /** 在折线头端画三角箭头。方向从 coords 末尾两格派生。*/
    private _drawHead(g: Graphics, coords: Cell[], pixels: Pixel[], color: Color) {
        const n = coords.length;
        const [hr, hc] = coords[n - 1];
        const [pr, pc] = coords[n - 2];
        const dr = hr - pr;
        const dc = hc - pc;

        const pdx = dc;
        const pdy = -dr;
        const nx = -pdy;
        const ny = pdx;

        const headPx = pixels[n - 1];
        const s = Config.arrowHeadSize;
        const tipX = headPx.x + pdx * s;
        const tipY = headPx.y + pdy * s;
        const leftX = headPx.x + nx * s / 2;
        const leftY = headPx.y + ny * s / 2;
        const rightX = headPx.x - nx * s / 2;
        const rightY = headPx.y - ny * s / 2;

        g.fillColor = color;
        g.moveTo(tipX, tipY);
        g.lineTo(leftX, leftY);
        g.lineTo(rightX, rightY);
        g.close();
        g.fill();
    }
}
