import { _decorator, Component, Node, Prefab, Vec2, instantiate, Button } from 'cc';
import { Box } from './Box';
const { ccclass, property } = _decorator;

@ccclass('FlowFieldMgr')
export class FlowFieldMgr extends Component {

    @property(Prefab)
    gridPrefab: Prefab = null!;

    @property(Node)
    targetNode: Node = null!;

    @property(Button)
    rebuildBtn: Button = null!;

    @property(Button)
    enemyMoveBtn: Button = null!;

    /** 单例 */
    public static Instance: FlowFieldMgr;

    /** 地图参数 */
    GRID_SIZE = 50;
    MAP_COL = 25;
    MAP_ROW = 14;

    /** 地图数据：1可走 0障碍 */
    mapData: number[][] = [];

    /** 积分场 */
    integrationField: number[][] = [];

    /** 流场方向 */
    flowField: Vec2[][] = [];

    /** 目标格子坐标 */
    targetGrid: Vec2 = new Vec2();

    /** 敌人是否可以移动 */
    public enemyCanMove = false;

    onLoad() {
        FlowFieldMgr.Instance = this;
        this.initMap();
        this.updateFlowField();

        // 按钮事件
        this.rebuildBtn?.node.on(Button.EventType.CLICK, this.onClickRebuild, this);
        this.enemyMoveBtn?.node.on(Button.EventType.CLICK, this.onClickEnemyMove, this);
    }

    // ================= 初始化地图 =================
    initMap() {
        for (let x = 0; x < this.MAP_COL; x++) {
            this.mapData[x] = [];
            this.integrationField[x] = [];
            this.flowField[x] = [];

            for (let y = 0; y < this.MAP_ROW; y++) {
                this.mapData[x][y] = 1;
                this.integrationField[x][y] = 0;
                this.flowField[x][y] = new Vec2(0, 0);

                this.createGridNode(x, y);
            }
        }
        console.log("✅地图初始化完成");
    }

    createGridNode(x: number, y: number) {
        const node = instantiate(this.gridPrefab);
        node.parent = this.node;

        const pos = this.gridToLocal(new Vec2(x, y));
        node.setPosition(pos.x, pos.y);

        const box = node.getComponent(Box);
        if (box) box.init(x, y);
    }

    // ================= 坐标转换 =================
    LocalToGrid(pos: Vec2): Vec2 {
        const offsetX = -(this.MAP_COL * this.GRID_SIZE) / 2;
        const offsetY = -(this.MAP_ROW * this.GRID_SIZE) / 2;

        const x = Math.floor((pos.x - offsetX) / this.GRID_SIZE);
        const y = Math.floor((pos.y - offsetY) / this.GRID_SIZE);

        return new Vec2(x, y);
    }

    gridToLocal(grid: Vec2): Vec2 {
        const offsetX = -(this.MAP_COL * this.GRID_SIZE) / 2;
        const offsetY = -(this.MAP_ROW * this.GRID_SIZE) / 2;

        return new Vec2(
            offsetX + grid.x * this.GRID_SIZE + this.GRID_SIZE / 2,
            offsetY + grid.y * this.GRID_SIZE + this.GRID_SIZE / 2
        );
    }

    // ================= 按钮事件 =================
    onClickRebuild() {
        console.log("🔄重新计算流场");
        this.updateFlowField();
    }

    onClickEnemyMove() {
        this.enemyCanMove = true;
        console.log("👾敌人开始移动");
    }

    // ================= 更新流场 =================
    updateFlowField() {
        this.updateTargetGrid();
        this.buildIntegrationField();
        this.buildFlowField();
        this.updateAllBoxDirection();
        this.updateAllBoxText();  // 
    }

    updateTargetGrid() {
        const wp = this.targetNode.position;
        this.targetGrid = this.LocalToGrid(new Vec2(wp.x, wp.y));
        console.log(this.targetGrid);
    }

    buildIntegrationField() {
        const queue: Vec2[] = [];

        for (let x = 0; x < this.MAP_COL; x++) {
            for (let y = 0; y < this.MAP_ROW; y++) {
                this.integrationField[x][y] = Infinity;
            }
        }

        this.integrationField[this.targetGrid.x][this.targetGrid.y] = 0;
        queue.push(this.targetGrid.clone());

        const dirs = [
            new Vec2(0, 1),
            new Vec2(0, -1),
            new Vec2(1, 0),
            new Vec2(-1, 0),
            new Vec2(1, 1),
            new Vec2(1, -1),
            new Vec2(1, 1),
            new Vec2(-1, 1),
        ];

        while (queue.length > 0) {
            const cur = queue.shift()!;

            for (const d of dirs) {
                const nx = cur.x + d.x;
                const ny = cur.y + d.y;

                if (!this.isInBounds(nx, ny)) continue;
                if (this.mapData[nx][ny] === 0) continue;

                const cost = this.integrationField[cur.x][cur.y] + 1;
                if (cost < this.integrationField[nx][ny]) {
                    this.integrationField[nx][ny] = cost;
                    queue.push(new Vec2(nx, ny));
                }
            }
        }
    }

    buildFlowField() {
        const dirs = [
            new Vec2(0, 1),
            new Vec2(0, -1),
            new Vec2(1, 0),
            new Vec2(-1, 0),
            new Vec2(1, 1),
            new Vec2(1, -1),
            new Vec2(1, 1),
            new Vec2(-1, 1),
        ];

        for (let x = 0; x < this.MAP_COL; x++) {
            for (let y = 0; y < this.MAP_ROW; y++) {

                let bestDir = new Vec2(0, 0);
                let bestCost = this.integrationField[x][y];

                for (const d of dirs) {
                    const nx = x + d.x;
                    const ny = y + d.y;
                    
                    if (!this.isInBounds(nx, ny)) continue;
                    if (this.mapData[nx][ny] === 0) continue;
                    
                    // 斜向移动禁止穿角
                    if (Math.abs(d.x) === 1 && Math.abs(d.y) === 1) {
                        if (this.mapData[x + d.x][y] === 0 || this.mapData[x][y + d.y] === 0) {
                            continue;
                        }
                    }
                    
                    const cost = this.integrationField[nx][ny];
                    if (cost <= bestCost) {
                        bestCost = cost;
                        bestDir = d.clone();
                    }
                }

                this.flowField[x][y] = bestDir;
            }
        }
        console.log(this.flowField);
    }

    updateAllBoxDirection() {
        for (const node of this.node.children) {
            const box = node.getComponent(Box);
            if (!box) continue;

            const dir = this.flowField[box.gridX][box.gridY];
            box.setDirection(dir);
        }
    }
    updateAllBoxText() {
        for (const node of this.node.children) {
            const box = node.getComponent(Box);
            if (!box) continue;

            const cost = this.integrationField[box.gridX][box.gridY];
            box.updateText(cost);
        }
    }

    getDirectionByWorldPos(pos: Vec2): Vec2 {
        const grid = this.LocalToGrid(pos);
        if (!this.isInBounds(grid.x, grid.y)) return Vec2.ZERO;
        return this.flowField[grid.x][grid.y];
    }

    setBlock(x: number, y: number, walkable: boolean) {
        if (!this.isInBounds(x, y)) return;
        this.mapData[x][y] = walkable ? 1 : 0;
    }
    isInBounds(x: number, y: number): boolean {
        return x >= 0 && y >= 0 && x < this.MAP_COL && y < this.MAP_ROW;
    }
}
