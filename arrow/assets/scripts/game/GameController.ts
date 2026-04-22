import { _decorator, Component, resources, JsonAsset, Node } from 'cc';
import { LevelData, validateLevelData } from '../core/LevelData';
import { BoardView } from './BoardView';
const { ccclass } = _decorator;

@ccclass('GameController')
export class GameController extends Component {
    private levelData: LevelData | null = null;
    private boardView: BoardView | null = null;

    onLoad() {
        this.boardView = this.createBoardView();
        this.loadLevel(1);
    }

    private createBoardView(): BoardView {
        const node = new Node('BoardView');
        this.node.addChild(node);
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
        this.boardView?.render(data);
    }
}