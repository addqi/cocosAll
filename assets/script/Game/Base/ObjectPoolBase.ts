import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('ObjectPoolBase')
export class ObjectPoolBase extends Component {
    /**对象池 */
    objectPool:Array<any> = [];
    /**获取对象 */
    get():any{
        if(this.objectPool.length > 0){
            return this.objectPool.pop();
        }
        instantiate(this.prefab).getComponent(this.component);
    }
    /**回收对象 */
    recycle(obj:any){
        this.objectPool.push(obj);
    }
}


