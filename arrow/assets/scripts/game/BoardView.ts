import {
    _decorator, Component, Node, UITransform, Graphics, Color, Vec3,
} from 'cc';
import { LevelData } from '../core/LevelData';
import { gridToPixel } from '../core/Coord';
import { Config } from '../common/Config';
import { ArrowView } from './ArrowView';
const { ccclass } = _decorator;

/**
 * 棋盘点阵视图。
 * 根据 LevelData 里所有箭头占据的格子，生成对应数量的蓝色小圆点。
 * 对应 G3_FBase 的 CombatPointDomain + CombatPointRender。
 */
@ccclass('BoardView')
export class BoardView extends Component {
    /** 已生成的点视图， */
    private dots: Node[] = [];
    /** 已生成的箭头视图，*/
    private arrowViews: ArrowView[] = [];

    render(data: LevelData) {
        this._clear();
        this.renderDots(data);
        this.renderArrows(data);
    }
    renderDots(data: LevelData) {
        const allCells: [number, number][] = [];
        for (const a of data.arrows) {
            for (const c of a.coords) allCells.push(c);
        }
        for (const [row, col] of allCells) {
            const dot = this.createDot(row, col, data.rows, data.cols);
            this.node.addChild(dot);
            this.dots.push(dot);
        }
    }
    renderArrows(data: LevelData) {
        for (let i = 0; i < data.arrows.length; i++) {
            const node = new Node(`Arrow_${i}`);
            this.node.addChild(node);
            const view = node.addComponent(ArrowView);
            view.initData(data.arrows[i], data.rows, data.cols);
            this.arrowViews.push(view);
        }
    }
    private createDot(row: number, col: number, rows: number, cols: number): Node {
        const p = gridToPixel(row, col, rows, cols);
        
        const dot = new Node(`Dot_${row}_${col}`)
        dot.setPosition(new Vec3(p.x, p.y, 0));
        dot.addComponent(UITransform).setContentSize(Config.pointSize, Config.pointSize);

        const g = dot.addComponent(Graphics);
        g.fillColor = new Color(86, 101, 246, 80);
        const r = Config.pointSize / 2;
        g.circle(0, 0, r);
        g.fill();
        return dot;
    }


    private _clear() {
        for (const d of this.dots) d.destroy();
        this.dots = [];
        for (const a of this.arrowViews) a.node.destroy();
        this.arrowViews = [];
    }
}
