import { _decorator, Color, Component, Node, UITransform, Button, EventHandler, Label, Graphics } from 'cc';
import { RedCom } from '../RedCom';
import { GameEvents } from './GameEvents';
import { registerLevelReds, LEVEL_COUNT } from './LevelRed';

const { ccclass } = _decorator;

const COLS = 5;
const ROWS = 2;
const BTN_SIZE = 60;
const GAP = 10;
const GROUP_OFFSET_Y = -100;

@ccclass('TestRedRunner')
export class TestRedRunner extends Component {

    start(): void {
        registerLevelReds();
        this._buildButtons();
        this._buildAnyLevelButton();
    }

    private _buildButtons(): void {
        const totalW = COLS * BTN_SIZE + (COLS - 1) * GAP;
        const totalH = ROWS * BTN_SIZE + (ROWS - 1) * GAP;
        const startX = -totalW / 2 + BTN_SIZE / 2;
        const startY = totalH / 2 - BTN_SIZE / 2 + GROUP_OFFSET_Y;

        for (let i = 0; i < LEVEL_COUNT; i++) {
            const row = Math.floor(i / COLS);
            const col = i % COLS;
            const x = startX + col * (BTN_SIZE + GAP);
            const y = startY - row * (BTN_SIZE + GAP);
            this._createButton(i, x, y);
        }
    }

    private _buildAnyLevelButton(): void {
        const totalH = ROWS * BTN_SIZE + (ROWS - 1) * GAP;
        const topY = totalH / 2 + GROUP_OFFSET_Y + BTN_SIZE + 20;

        const node = new Node('AnyLevelBtn');
        node.setPosition(0, topY, 0);

        const ut = node.addComponent(UITransform);
        ut.setContentSize(120, BTN_SIZE);
        ut.setAnchorPoint(0.5, 0.5);

        const g = node.addComponent(Graphics);
        g.fillColor = new Color(80, 80, 200, 255);
        g.fillRect(-60, -BTN_SIZE / 2, 120, BTN_SIZE);

        this._addLabel(node, 'Any', 120);

        const rc = node.addComponent(RedCom);
        rc.redKey = 'AnyLevel';

        this.node.addChild(node);
    }

    private _createButton(levelId: number, x: number, y: number): void {
        const node = new Node(`Btn_${levelId}`);
        node.setPosition(x, y, 0);

        const ut = node.addComponent(UITransform);
        ut.setContentSize(BTN_SIZE, BTN_SIZE);
        ut.setAnchorPoint(0.5, 0.5);

        const g = node.addComponent(Graphics);
        g.fillColor = new Color(120, 120, 120, 255);
        g.fillRect(-BTN_SIZE / 2, -BTN_SIZE / 2, BTN_SIZE, BTN_SIZE);

        this._addLabel(node, String(levelId), BTN_SIZE);

        node.addComponent(Button);
        const handler = new EventHandler();
        handler.target = this.node;
        handler.component = 'TestRedRunner';
        handler.handler = 'onBtnClick';
        handler.customEventData = String(levelId);
        node.getComponent(Button)!.clickEvents.push(handler);

        const rc = node.addComponent(RedCom);
        rc.redKey = `Level_${levelId}`;

        this.node.addChild(node);
    }

    private _addLabel(parent: Node, text: string, width: number): void {
        const labelNode = new Node('Label');
        labelNode.setPosition(0, 0, 0);

        const ut = labelNode.addComponent(UITransform);
        ut.setContentSize(width, BTN_SIZE);

        const label = labelNode.addComponent(Label);
        label.string = text;
        label.fontSize = 24;
        label.color = new Color(255, 255, 255, 255);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;

        parent.addChild(labelNode);
    }

    onBtnClick(_event: unknown, customData: string): void {
        const id = Number(customData);
        GameEvents.levelClicked.dispatch(id);
    }
}
