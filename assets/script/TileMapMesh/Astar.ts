import { _decorator, Component, Node, Vec2 } from 'cc';
const { ccclass, property } = _decorator;
export class Point {
    // 格子X坐标
    x: number;
    // 格子Y坐标
    y: number;
    // G值
    G: number = 0;
    // H值
    H: number = 0;
    // F值
    F: number = 0;
    // 父节点
    father: Point = null;
    /**是否是障碍物 */
    is_close: boolean = false;
    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }
}

@ccclass('Astar')
export class Astar {
    private pointlist: Point[][];
    constructor(pointlist: Point[][]) {
        this.pointlist = pointlist;
    }
    private arr_open: Array<Point> = [];
    /**方向 */
    dir: number[][] = [
        [0, 1],
        [1, 0],
        [0, -1],
        [-1, 0]
    ];

     astar(start: Vec2, end: Vec2) {
        console.log("开始A*算法",start,end);
        this.arr_open = [];
        let startPoint = new Point(start.x, start.y);
        let endPoint = new Point(end.x, end.y);
        this.arr_open.push(startPoint);
        startPoint.is_close=true;
        let resultPoint: Point[] = [];
        while (this.arr_open.length > 0) {
            let point = this.arr_open[0];
            this.arr_open.splice(0, 1);
            if (point.x == endPoint.x && point.y == endPoint.y) {
                console.log("找到路径",point);
                resultPoint=[];
                resultPoint.push(point);
                while(point.father!=null){
                    resultPoint.push(point.father);
                    point=point.father;
                }
                return resultPoint;
            }
            for (let i = 0; i < this.dir.length; i++) {
                let m = point.x + this.dir[i][0];
                let n = point.y + this.dir[i][1];
                if(m>=0&&m<this.pointlist.length&&n>=0&&n<this.pointlist[0].length){
                    if(this.pointlist[m][n].is_close!=true){
                        let newPoint =new Point(m,n);
                        newPoint.G=point.G+1;
                        newPoint.H=Math.abs(newPoint.x-endPoint.x)+Math.abs(newPoint.y-endPoint.y);
                        newPoint.F=newPoint.G+newPoint.H;
                        newPoint.is_close=true;
                        newPoint.father=point;
                        this.pointlist[m][n].is_close=true;
                        this.arr_open.push(newPoint);
                        this.arr_open.sort((point1:Point,point2:Point)=>{
                            return point1.F>point2.F?1:-1;
                        })
                    }
                }
            }
        }
        //没找到 返回空数组
        resultPoint=[];
        console.log("没找到路径");
        return resultPoint;
    }
    updatePointList(pointlist: Point[][]) {
        this.pointlist = pointlist;
    }
}


