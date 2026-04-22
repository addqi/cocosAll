import { _decorator, Component, resources, JsonAsset, Node, Widget } from 'cc';
import { LevelData, validateLevelData, ArrowData } from '../core/LevelData';
import { BoardView } from './BoardView';
import {
    ArrowMoveMode, ArrowRuntime, createRuntime, canFire, fire,
    markEnd, markCollide, markBack, resetToIdle,
    tickStart,
} from '../core/ArrowState';
import { InputController } from './InputController';
import { Config } from '../common/Config';
import { findCollision } from '../core/CollisionCheck';
const { ccclass } = _decorator;

@ccclass('GameController')
export class GameController extends Component {
    private levelData: LevelData | null = null;
    private boardView: BoardView | null = null;
    private input: InputController | null = null;
    /** 箭头运行时状态，按索引和 levelData.arrows 一一对应 */
    private runtimes: ArrowRuntime[] = [];

    onLoad() {
        this.boardView = this.createBoardView();
        this.input = this.boardView.node.addComponent(InputController);
        this.loadLevel(2);
        this.stateMachineSelfTest();
    }
    update(dt: number) {
        for (let i = 0; i < this.runtimes.length; i++) {
            const rt = this.runtimes[i];
            if (rt.mode !== ArrowMoveMode.Start) continue;
            tickStart(rt, dt, Config.arrowSpeed, this.levelData?.rows ?? 0, this.levelData?.cols ?? 0);
            this.refreshArrow(i);
        }
    }
    private createBoardView(): BoardView {
        const node = new Node('BoardView');
        this.node.addChild(node);
        if (!this.node.getComponent(Widget)) {
            this.node.addComponent(Widget);
        }
        let widget = this.node.getComponent(Widget);
        if (!widget) {
            widget = this.node.addComponent(Widget);
        }
        widget.enabled = true;
        widget.top = 0;
        widget.left = 0;
        widget.right = 0;
        widget.bottom = 0;
        widget.isAlignTop = true;
        widget.isAlignLeft = true;
        widget.isAlignRight = true;
        widget.isAlignBottom = true;
        widget.updateAlignment();
        return node.addComponent(BoardView);
    }

    private loadLevel(levelNo: number) {
        const no = levelNo < 10 ? `0${levelNo}` : `${levelNo}`;
        const path = `levels/level_${no}`;
        resources.load(path, JsonAsset, (err, asset) => {
            if (err) {
                console.error(`[Arrow] Load level failed: ${path}`, err);
                return;
            }
            let data: LevelData;
            try {
                data = validateLevelData(asset.json);
            } catch (e) {
                console.error(`[Arrow] Level data invalid:`, e);
                return;
            }
            this.levelData = data;
            this.onLevelLoaded(data);
        });
    }

    private onLevelLoaded(data: LevelData) {
        console.log(`[Arrow] Level loaded: ${data.rows} x ${data.cols}, arrows = ${data.arrows.length}`);
        this.runtimes = data.arrows.map(a => createRuntime(a));
        this.boardView?.render(data);
        this.refreshAllArrows();
        this.input?.setup(this.runtimes, data.rows, data.cols, (idx) => this.onArrowClick(idx));
    }

    private onArrowClick(idx: number) {
        const rt = this.runtimes[idx];
        if (!canFire(rt)) return;
        const blocked = findCollision(
            idx, this.runtimes,
            this.levelData!.rows, this.levelData!.cols,
        ) >= 0;
        fire(rt, blocked);
        console.log(`[Arrow] Arrow ${idx} fired. mode = ${ArrowMoveMode[rt.mode]}, blocked=${blocked}`);
        this.refreshArrow(idx);
    }

    private refreshAllArrows() {
        const views = this.boardView?.getArrowViews() ?? [];
        for (let i = 0; i < views.length; i++) {
            views[i].refresh(this.runtimes[i]);
        }
    }

    private refreshArrow(idx: number) {
        const views = this.boardView?.getArrowViews() ?? [];
        views[idx]?.refresh(this.runtimes[idx]);
    }

    /** 07 章引入的状态机自测。可保留，可删。 */
    private stateMachineSelfTest() {
        const fakeArrow: ArrowData = {
            direction: [0, 1],
            origin: [1, 3],
            coords: [[1, 1], [1, 2], [1, 3]],
        };
        const rt = createRuntime(fakeArrow);
        const lines: string[] = [];
        const pad = (s: string) => (s + '                    ').substring(0, 20);
        const step = (label: string) => lines.push(`${pad(label)} ${ArrowMoveMode[rt.mode]}`);

        step('init:');
        fire(rt, true); step('after fire(blocked):');
        markCollide(rt); step('after markCollide:');
        markBack(rt); step('after markBack:');
        fire(rt, false); step('after fire(false):');
        markEnd(rt); step('after markEnd:');
        resetToIdle(rt, fakeArrow); step('after resetToIdle:');

        console.log('[Arrow] StateMachine self-test:\n  ' + lines.join('\n  '));
    }
}