import { _decorator } from 'cc';
import { IProperty } from './BaseValueProperty';
const { ccclass, property } = _decorator;


@ccclass('ProPertyMgr')
export class ProPertyMgr  {
    /**属性映射 */
    private properties: Map<string, IProperty<any>> = new Map();
    /**注册属性 */
    register(prop: IProperty<number>){
        this.properties.set(prop.propertyId, prop);
    }
    /**获取属性值 */
    get(id:string):number{
        const p = this.properties.get(id);
        return p?.getValue() ?? 0;
    }
    /**获取属性对象 */
    getProperty(id:string):IProperty<number>|undefined{
        return this.properties.get(id);
    }
}

