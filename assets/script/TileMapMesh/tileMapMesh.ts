import { _decorator, BoxCollider2D, Color, Component, EventTouch, Graphics, instantiate, Node,Prefab,Rect,UITransform, Vec2, Vec3 } from 'cc';
import { Astar, Point } from './Astar';
const { ccclass, property } = _decorator;
/** 网格大小 */
const GRID_SIZE = 32;
/** 网格 */
export class GRID{
    public x: number;
    public y: number;
    public width: number;
    public height: number;
    public canMove: boolean;
    public rold:boolean=false;
    public constructor(x: number, y: number, width: number, height: number,canMove?:boolean) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.canMove = canMove??true;
    }
}
@ccclass('tileMapMesh')
export class tileMapMesh extends Component {
    private static _instance:tileMapMesh = null!;
    get instance():tileMapMesh{
        if(!tileMapMesh._instance){
            tileMapMesh._instance = this.getComponent(tileMapMesh);
        }
        return tileMapMesh._instance;
    }
    /** 地图 */
    @property(Node)
    public tileMap: Node = null!;
    /** 建筑父节点 */
    @property(Node)
    public buidParent: Node = null!;
    @property(Node)
    public startNode:Node=null;
    @property(Node)
    public endNode:Node=null;
    @property(Prefab)
    public buildPrefab:Prefab=null;

    private gridList: GRID[][];
    private graphics:Graphics;
    private astar:Astar;
    protected onLoad(): void {
        this.initTileMap();
        this.graphics = this.getComponent(Graphics);
        this.calculateBuildingGrid();
        let pointList =this.intiAstar(this.gridList);
        this.astar=new Astar(pointList);
        this.clickStartAstar();
       
        // this.astar = new Astar(this.gridList);
    }
    /**把网格转化为A*的格子 */
    intiAstar(gridList:GRID[][]){
        let pointList :Point[][]=[];
        for(let i=0;i<gridList.length;i++){
            pointList[i]=[];
            for(let f=0;f<gridList[0].length;f++){
                let point = new Point(i,f);
                point.is_close=!gridList[i][f].canMove;
                pointList[i].push(point);
            }
        }
        return pointList;
    }

    /**初始化地图 */
    initTileMap(){
        this.gridList = [];
        const xCount = this.tileMap.getComponent(UITransform).width / GRID_SIZE;
        const yCount = this.tileMap.getComponent(UITransform).height / GRID_SIZE;
        for (let x = 0; x < xCount; x++) {
            this.gridList[x] = []; // 先初始化每一行为空数组
            for (let y = 0; y < yCount; y++) {
                this.gridList[x].push(new GRID(x * GRID_SIZE, y * GRID_SIZE, GRID_SIZE, GRID_SIZE));
            }
        }
    }
    /**计算建筑物覆盖的网格 */
    calculateBuildingGrid(){
        this.handleBuildings();
        this.drawGrid(this.gridList);
    }

    /**处理建筑物 */
    handleBuildings(){
        const buildings = this.buidParent.children;
        const tileUT = this.tileMap.getComponent(UITransform);
        
        // 计算 tileMap 左下角的世界坐标（与 drawGrid 中保持一致）
        const tilePos = this.tileMap.getWorldPosition();
        const tileLeftDown = new Vec3(
            tilePos.x - tileUT.width * 0.5,
            tilePos.y - tileUT.height * 0.5,
            0
        );
        
        buildings.forEach(build => {
            const collider = build.getComponent(BoxCollider2D);
            if (collider) {
                const collideSize = collider.size;
                const collideOffset = collider.offset;
                
                // 获取建筑物节点的世界坐标
                const buildWorldPos = build.getWorldPosition();
                
                // 计算碰撞体左下角的世界坐标
                // 注意：collideOffset 是相对于节点中心的偏移
                const colliderWorldLeftDown = new Vec3(
                    buildWorldPos.x + collideOffset.x - collideSize.x * 0.5,
                    buildWorldPos.y + collideOffset.y - collideSize.y * 0.5,
                    0
                );
                
                // 转换为相对于 tileMap 左下角的本地坐标
                const localX = colliderWorldLeftDown.x - tileLeftDown.x;
                const localY = colliderWorldLeftDown.y - tileLeftDown.y;
                
                // 计算网格索引（网格坐标从 0 开始，每个网格大小为 GRID_SIZE）
                const iMin: number = Math.floor(localX / GRID_SIZE);
                const fMin: number = Math.floor(localY / GRID_SIZE);
                const iMax: number = Math.ceil((localX + collideSize.x) / GRID_SIZE);
                const fMax: number = Math.ceil((localY + collideSize.y) / GRID_SIZE);
                
                console.log("碰撞体本地坐标", localX, localY);
                console.log("大小", collideSize.x, collideSize.y);
                console.log("网格范围", iMin, iMax, fMin, fMax);
                
                // 确保索引在有效范围内
                for(let i = Math.max(0, iMin); i < Math.min(this.gridList.length, iMax); i++){
                    if (this.gridList[i]) {
                        for(let f = Math.max(0, fMin); f < Math.min(this.gridList[i].length, fMax); f++){
                            this.gridList[i][f].canMove = false;
                            console.log("建筑物覆盖了网格", i, f);
                        }
                    }
                }
            }
        });
    }
    /**画地图 */
    public drawGrid(gridList: GRID[][]) {
        if (!this.graphics) return;
    
        const uiTrans = this.node.getComponent(UITransform);
        if (!uiTrans) {
            console.error("[GridRenderer] Node 必须有 UITransform");
            return;
        }
    
        const tileUT = this.tileMap.getComponent(UITransform);
    
        // tileMap 左下角世界坐标
        const tilePos = this.tileMap.getWorldPosition();
        const tileLeftDown = new Vec3(
            tilePos.x - tileUT.width * 0.5,
            tilePos.y - tileUT.height * 0.5,
            0
        );
    
        this.graphics.clear();
        this.graphics.lineWidth = 3;
        let gridListRed:Rect[] = [];
        for (let i = 0; i < gridList.length; i++) {
            const row = gridList[i];
            for (let j = 0; j < row.length; j++) {
                const cell = row[j];
    
                // cell 世界坐标 = tileMap 左下角 + 偏移
                const worldPos = new Vec3(
                    tileLeftDown.x + cell.x,
                    tileLeftDown.y + cell.y,
                    0
                );
    
                // 世界 → 本地（this.node）
                const localPos = uiTrans.convertToNodeSpaceAR(worldPos);
    
                const left = localPos.x;
                const bottom = localPos.y;
    
                // 设置边框颜色
                this.graphics.strokeColor = cell.canMove
                    ? new Color(0, 200, 0)
                    : new Color(200, 0, 0);
                if(!cell.canMove){
                    gridListRed.push(new Rect(left, bottom, cell.width, cell.height));
                }
                // 画边框（不填充）
                this.graphics.rect(left, bottom, cell.width, cell.height);
                if(cell.rold){
                    this.graphics.strokeColor = new Color(200, 200, 200);
                    this.graphics.fill();
                    console.log("画了路径",cell.x,cell.y);
                }
                this.graphics.stroke();
            }
        }
        for(let i=0;i<gridListRed.length;i++){
            const rect = gridListRed[i];
            this.graphics.rect(rect.x, rect.y, rect.width, rect.height);
            this.graphics.strokeColor = new Color(200, 0, 0);
            this.graphics.stroke();
        }
        
    }
    /**点击建造建筑物 */
    onClickBuild(touch:EventTouch){
        let build = instantiate(this.buildPrefab);
        build.setParent(this.buidParent);
        let touchPos = touch.getUILocation();
        let worldPos = new Vec3(touchPos.x,touchPos.y,0);
        let localPos = this.node.getComponent(UITransform).convertToNodeSpaceAR(worldPos);
        build.setPosition(localPos);
        this.calculateBuildingGrid();
    }
    /**点击开始A* */
    clickStartAstar(){
        this.astar.updatePointList(this.intiAstar(this.gridList));
        let startPos = new Vec2(this.startNode.getWorldPosition().x,this.startNode.getWorldPosition().y);
        let endPos = new Vec2(this.endNode.getWorldPosition().x,this.endNode.getWorldPosition().y);
        startPos = new Vec2(Math.floor(startPos.x/GRID_SIZE),Math.floor(startPos.y/GRID_SIZE));
        endPos = new Vec2(Math.floor(endPos.x/GRID_SIZE),Math.floor(endPos.y/GRID_SIZE));
        console.log("开始位置",startPos);
        console.log("结束位置",endPos);
        let pointList= this.astar.astar(startPos,endPos);
        for(let i=0;i<this.gridList.length;i++){
            for(let f=0;f<this.gridList[0].length;f++){
                this.gridList[i][f].rold=false;
            }
        }
        for(let i=0;i<pointList.length;i++){
            let point = pointList[i];
            this.gridList[point.x][point.y].rold=true;
        }
        this.drawGrid(this.gridList);
    }
    /**移除建筑物 */
    onClickRemoveBuild(touch:EventTouch){
        this.buidParent.children.forEach(child => {
            child.destroy();
        });
        this.calculateBuildingGrid();
    }
    /**点击开始建造 */
    onClickStartBuild(){
        this.node.targetOff(this);
        this.node.on(Node.EventType.MOUSE_DOWN,this.onClickBuild,this);
    }
    /**点击结束建造 */
    onClickEndBuild(){
        this.node.off(Node.EventType.MOUSE_DOWN,this.onClickBuild,this);
    }

    /**点击修改开始位置 */
    onClickModifyStart(touch:EventTouch){
        this.node.targetOff(this);
        this.node.on(Node.EventType.MOUSE_DOWN,this.onClickChangeModifyStart,this);
    }
    private onClickChangeModifyStart(touch:EventTouch){
        let touchPos = touch.getUILocation();
        let worldPos = new Vec3(touchPos.x,touchPos.y,0);
        let localPos = this.node.getComponent(UITransform).convertToNodeSpaceAR(worldPos);
        this.startNode.setPosition(localPos);
        this.node.targetOff(this);
    }
    /**点击修改结束位置 */
    onClickModifyEnd(touch:EventTouch){
        this.node.targetOff(this);
        this.node.on(Node.EventType.MOUSE_DOWN,this.onClickChangeModifyEnd,this);
    }
    private onClickChangeModifyEnd(touch:EventTouch){
        let touchPos = touch.getUILocation();
        let worldPos = new Vec3(touchPos.x,touchPos.y,0);
        let localPos = this.node.getComponent(UITransform).convertToNodeSpaceAR(worldPos);
        this.endNode.setPosition(localPos);
        this.node.targetOff(this);
    }

}