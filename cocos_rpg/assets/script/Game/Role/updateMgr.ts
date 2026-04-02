import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;
/**中央更新管理器 */
@ccclass('updateMgr')
export class updateMgr extends Component {
     private static _instance:updateMgr;
    static get():updateMgr {
        return updateMgr._instance;
    }

    private _updateList: Array<(dt: number) => void> = [];

    protected onLoad(): void {
        // 设置单例实例
        updateMgr._instance = this;
    }

    /** 添加一个函数 */
    public addUpdate(func: (dt: number) => void) {
        this._updateList.push(func);
    }

    /** 移除函数 */
    public removeUpdate(func: (dt: number) => void) {
        const index = this._updateList.indexOf(func);
        if (index !== -1) {
            this._updateList.splice(index, 1);
        }
    }

    /** 每帧更新 */
    public update(dt: number) {
        for (let i = 0; i < this._updateList.length; i++) {
            this._updateList[i](dt); // 直接调用函数
        }
    }
}


